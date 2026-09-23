import os
import json
import re
import requests
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator

# =========================================================
# Load Environment Variables from .env file
# =========================================================
def load_env():
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip()

load_env()

# =========================================================
# 1. DEFINE PYDANTIC SCHEMA
# =========================================================
class ServiceItem(BaseModel):
    name: str = Field(..., description="Description of the service item or part")
    cost: Optional[float] = Field(None, description="Cost associated with this item")

class StructuringSchema(BaseModel):
    date: Optional[str] = Field(None, description="Service date formatted as YYYY-MM-DD")
    mileage: Optional[int] = Field(None, description="Odometer/mileage reading as an integer")
    items: List[ServiceItem] = Field(default_factory=list, description="List of individual service items/parts replaced")
    cost: Optional[float] = Field(None, description="Total cost of the invoice as a float")

    @field_validator("date", mode="before")
    @classmethod
    def normalize_date(cls, v):
        if not v or str(v).lower() in ["null", "none", "n/a", ""]:
            return None
        cleaned = str(v).strip()
        # Regex to match YYYY-MM-DD
        match = re.search(r"\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b", cleaned)
        if match:
            return f"{match.group(1)}-{int(match.group(2)):02d}-{int(match.group(3)):02d}"
        return cleaned

    @field_validator("mileage", mode="before")
    @classmethod
    def normalize_mileage(cls, v):
        if v is None or str(v).lower() in ["null", "none", "???"]:
            return None
        if isinstance(v, (int, float)):
            return int(v)
        cleaned = re.sub(r"[^\d]", "", str(v))
        return int(cleaned) if cleaned else None

    @field_validator("cost", mode="before")
    @classmethod
    def normalize_cost(cls, v):
        if v is None:
            return None
        if isinstance(v, (int, float)):
            return float(v)
        cleaned = re.sub(r"[^\d.]", "", str(v))
        return float(cleaned) if cleaned else None

# =========================================================
# 2. DEFINE SYSTEM & USER PROMPTS
# =========================================================
SYSTEM_PROMPT = """You are an expert AI extraction agent.
Your task is to take raw, messy OCR text from vehicle service receipts/slips and structure it into a clean JSON object matching the requested schema.

RULES:
1. NEVER hallucinate or invent data. If a field is missing, set it to null.
2. Normalize the date to YYYY-MM-DD.
3. Extract mileage as a clean integer.
4. Extract the total invoice cost as a float.
5. Extract all list items (parts/labor/services) with their specific names and individual costs (if listed).
6. Return ONLY valid JSON. No conversational text, no markdown block wrappers (like ```json).

JSON SCHEMA:
{
  "date": "YYYY-MM-DD or null",
  "mileage": integer or null,
  "items": [
    {
      "name": "string",
      "cost": float or null
    }
  ],
  "cost": float or null
}"""

def build_user_prompt(raw_ocr: str) -> str:
    return f"Extract structured data from this raw OCR text:\n\n---\n{raw_ocr}\n---"

# =========================================================
# 3. DEFINE 10 MOCK OCR SAMPLES
# =========================================================
SAMPLES = [
    # Sample 1: Perfect Receipt
    """APEX AUTO SERVICE
Date: 2026-08-15
Odometer: 45210 km
--------------------------
1. Oil Change       $65.00
2. Tire Rotation    $45.00
--------------------------
TOTAL: $110.00""",

    # Sample 2: Messy Handwritten Receipt with missing mileage
    """JOE'S GARAGE & REPAIR
Date: 12/04/2026
Mileage: ??? (unclear reading)
Rear Brake Pads       $140.00
Brake Rotor Refacing  $90.00
Total: $230.00""",

    # Sample 3: Invoice with multiple dates and mileage in miles
    """MIDAS AUTOMOTIVE
Inv #: 89283
Date of Service: Oct 24, 2025
Odom: 104,230 mi
Synthetic Oil Service: $49.99
Air Filter: $19.99
Tax: $5.00
Invoice Total: $74.98""",

    # Sample 4: Blurry OCR with symbol errors ($ -> s, 0 -> O)
    """QUICK LUBE INC.
DATE: 2O26-O7-12
MILEAGE: 88,OOO miles
-----------------
Filter Swap: s12.5O
5W3O Oil: s35.OO
Total paid: s47.5O""",

    # Sample 5: European Receipt with currency symbol (€) and format
    """AUTOHAUS SCHMIDT
Datum: 18.08.2026
Kilometerstand: 120450 km
Inspektion: 150.00 EUR
Bremsflüssigkeit: 40.00 EUR
Gesamtsumme: 190.00 EUR""",

    # Sample 6: Multi-item receipt with missing individual item costs
    """SUPER SERVICE STATION
Date: 2026-05-30
Odo: 12430 km
Services Performed:
- Wheel Alignment
- Brake Caliper Check
- Engine Diagnostic Flush
--------------------
Total Charge: $320.00""",

    # Sample 7: Blank or illegible OCR output
    """[NOISY STATIC]
#@!$#@!
ERROR CODE 404
[IMAGE OBSCURED]""",

    # Sample 8: Minimalist receipt
    """10/10/2025
Odometer 33100
Spark Plugs $80.00
Total $80.00""",

    # Sample 9: Receipt with parts list separate from labor
    """DOWNTOWN MOTORS
Date: 09/15/2026
Mileage: 61000
Labor Charges: $120.00
Parts Installed:
* Brake Rotors (Pair) $90.00
* Brake Pads (Front) $40.00
-------------------
GRAND TOTAL: $250.00""",

    # Sample 10: Heavy formatting noise & text wrap
    """Car Care Center
Inv Date: 2026-01-20
Mile:
75420
Oil change service
package special
price: $39.99
Wiper blades: $25.00
Total: $64.99"""
]

# =========================================================
# 4. RUN LLM EXTRACTION
# =========================================================
def run_extraction(raw_ocr: str) -> Optional[dict]:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        print("Error: OPENROUTER_API_KEY not found in environment.")
        return None

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "anthropic/claude-3-haiku",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_prompt(raw_ocr)}
        ],
        "temperature": 0.0
    }

    try:
        resp = requests.post("https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers, timeout=30)
        if resp.status_code == 200:
            content = resp.json()["choices"][0]["message"]["content"].strip()
            # Clean markdown codeblocks
            content = re.sub(r"^```json\s*", "", content)
            content = re.sub(r"\s*```$", "", content)
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                # If LLM returned text instead of JSON (e.g. "I can't read this"), fallback to default nulls
                return {"date": None, "mileage": None, "items": [], "cost": None}
        else:
            print(f"API Error ({resp.status_code}): {resp.text}")
    except Exception as e:
        print(f"Connection error: {e}")
    return {"date": None, "mileage": None, "items": [], "cost": None}

# =========================================================
# 5. TEST RUNNER
# =========================================================
def main():
    print("=" * 60)
    print("TESTING LLM OCR STRUCTURING PROMPT ON 10 SAMPLES")
    print("=" * 60)

    for i, sample in enumerate(SAMPLES, 1):
        print(f"\n--- TEST CASE {i} ---")
        print("Raw OCR Input:")
        print(sample)
        print("-" * 30)

        # Call LLM
        raw_json = run_extraction(sample)
        if not raw_json:
            print("Failed to get response from LLM.")
            continue

        print("Extracted LLM Output (Raw):")
        print(json.dumps(raw_json, indent=2))

        # Validate with Pydantic
        try:
            validated = StructuringSchema(**raw_json)
            print("\nValidated & Normalized Output:")
            print(validated.model_dump_json(indent=2))
            print("STATUS: SUCCESS [OK]")
        except Exception as e:
            print(f"\nValidation Failed: {e}")
            print("STATUS: FAILED [ERROR]")
        print("-" * 60)

if __name__ == "__main__":
    main()

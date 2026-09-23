import io
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

import pytesseract
import requests
from PIL import Image

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

try:
    import anthropic
except ImportError:
    anthropic = None

from app.database import supabase
from app.prompts.slip_extraction_v1 import (
    CLAUDE_MODEL_DEFAULT,
    PROMPT_VERSION,
    SYSTEM_PROMPT_V1,
    build_user_prompt_v1,
)
from app.schemas.slip import ServiceSlipExtractionSchema

# Setup secure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("slip_processor")

BUCKET_NAME = "vehicare-1storage"


def sanitize_log_message(msg: str) -> str:
    """
    Remove or mask API keys / tokens from log output.
    """
    sensitive_keys = [
        os.getenv("ANTHROPIC_API_KEY"),
        os.getenv("OPENROUTER_API_KEY"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
        os.getenv("SUPABASE_PUBLISHABLE_KEY"),
    ]
    sanitized = str(msg)
    for key in sensitive_keys:
        if key and len(key) > 8:
            sanitized = sanitized.replace(key, f"{key[:4]}...***...{key[-4:]}")
    return sanitized


def log_info(message: str) -> None:
    logger.info(sanitize_log_message(message))


def log_error(message: str) -> None:
    logger.error(sanitize_log_message(message))


def get_service_role_key() -> str:
    key = getattr(supabase, "supabase_service_role_key", None) or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY is not configured in environment")
    return str(key)


# =========================================================
# 1. OCR TEXT EXTRACTION
# =========================================================

def extract_ocr_from_image(image_bytes: bytes) -> str:
    """
    Extract raw text from JPEG/PNG image bytes using pytesseract.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode not in ("L", "RGB"):
            img = img.convert("RGB")
        text = pytesseract.image_to_string(img)
        return text.strip()
    except Exception as e:
        log_error(f"Image OCR error: {e}")
        raise RuntimeError(f"OCR extraction failed for image: {str(e)}")


def extract_ocr_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extract raw text from PDF bytes using pdfplumber with fallback to pytesseract.
    """
    text_content = []
    if pdfplumber:
        try:
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_content.append(page_text)
            extracted = "\n".join(text_content).strip()
            if extracted:
                return extracted
        except Exception as e:
            log_error(f"pdfplumber extraction failed: {e}. Trying image fallback.")

    return "PDF Text Extraction: PDF contained non-extractable raster content or required OCR."


def extract_raw_ocr_text(file_bytes: bytes, file_name_or_type: str) -> str:
    """
    Extract complete raw OCR text preserving all formatting and characters.
    """
    ext = file_name_or_type.lower()
    if ext.endswith(".pdf") or file_name_or_type == "application/pdf":
        raw_text = extract_ocr_from_pdf(file_bytes)
    else:
        raw_text = extract_ocr_from_image(file_bytes)

    if not raw_text:
        raw_text = "[WARNING: OCR produced empty text output. Document may be low resolution, blank, or degraded.]"

    return raw_text


# =========================================================
# 2. CLAUDE HAIKU INTELLIGENCE EXTRACTION
# =========================================================

def call_claude_haiku_extraction(ocr_raw_text: str, max_retries: int = 3) -> dict:
    """
    Pass raw OCR text to Anthropic Claude Haiku and retrieve structured JSON output.
    Supports OPENROUTER_API_KEY or ANTHROPIC_API_KEY.
    """
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")

    if not openrouter_key and not anthropic_key:
        log_error("Neither ANTHROPIC_API_KEY nor OPENROUTER_API_KEY configured in environment.")
        raise ValueError("ANTHROPIC_API_KEY or OPENROUTER_API_KEY environment variable is required")

    user_prompt = build_user_prompt_v1(ocr_raw_text)

    if openrouter_key:
        model_name = os.getenv("CLAUDE_MODEL", "anthropic/claude-3-haiku")
        use_openrouter = True
    else:
        model_name = os.getenv("CLAUDE_MODEL", CLAUDE_MODEL_DEFAULT)
        use_openrouter = False

    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            if use_openrouter:
                log_info(f"Invoking Claude Haiku via OpenRouter API ({model_name}), attempt {attempt}/{max_retries}")
                url = "https://openrouter.ai/api/v1/chat/completions"
                headers = {
                    "Authorization": f"Bearer {openrouter_key}",
                    "HTTP-Referer": "https://vehicare.app",
                    "X-Title": "VehiCare AI",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT_V1},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.0,
                    "max_tokens": 1000
                }
                resp = requests.post(url, headers=headers, json=payload, timeout=45)
                if resp.status_code != 200:
                    if resp.status_code in [429, 402, 503] and model_name != "deepseek/deepseek-chat":
                        log_info("OpenRouter primary model rate-limited; attempting deepseek/deepseek-chat fallback")
                        payload["model"] = "deepseek/deepseek-chat"
                        resp = requests.post(url, headers=headers, json=payload, timeout=45)

                    if resp.status_code != 200:
                        raise RuntimeError(f"OpenRouter API error ({resp.status_code}): {resp.text}")

                res_json = resp.json()
                raw_response_text = res_json["choices"][0]["message"]["content"].strip()
            else:
                log_info(f"Invoking Claude Haiku via Anthropic API ({model_name}), attempt {attempt}/{max_retries}")
                client = anthropic.Anthropic(api_key=anthropic_key)
                response = client.messages.create(
                    model=model_name,
                    max_tokens=1000,
                    temperature=0.0,
                    system=SYSTEM_PROMPT_V1,
                    messages=[
                        {"role": "user", "content": user_prompt}
                    ]
                )
                raw_response_text = response.content[0].text.strip()

            # Clean markdown formatting if present
            cleaned_json = raw_response_text
            if cleaned_json.startswith("```json"):
                cleaned_json = cleaned_json[7:]
            if cleaned_json.startswith("```"):
                cleaned_json = cleaned_json[3:]
            if cleaned_json.endswith("```"):
                cleaned_json = cleaned_json[:-3]
            cleaned_json = cleaned_json.strip()

            parsed_data = json.loads(cleaned_json)

            # Inject metadata
            parsed_data["_metadata"] = {
                "prompt_version": PROMPT_VERSION,
                "model": model_name,
                "provider": "openrouter" if use_openrouter else "anthropic",
                "processed_at": datetime.now(timezone.utc).isoformat()
            }

            return parsed_data

        except json.JSONDecodeError as e:
            last_error = f"JSON parsing error from Claude response: {e}"
            log_error(f"Attempt {attempt} failed: {last_error}")
            time.sleep(1.5 * attempt)
        except Exception as e:
            last_error = f"LLM API call error: {str(e)}"
            log_error(f"Attempt {attempt} failed: {last_error}")
            time.sleep(2.0 * attempt)

    raise RuntimeError(f"Claude Haiku extraction failed after {max_retries} attempts: {last_error}")


# =========================================================
# 3. SCHEMA VALIDATION
# =========================================================

def validate_and_normalize_extraction(parsed_json: dict) -> Tuple[dict, Optional[str]]:
    """
    Validate Claude's JSON response against ServiceSlipExtractionSchema.
    Returns (validated_dict, confidence_notes).
    """
    try:
        validated_schema = ServiceSlipExtractionSchema(**parsed_json)
        validated_dict = validated_schema.model_dump()

        if "_metadata" in parsed_json:
            validated_dict["_metadata"] = parsed_json["_metadata"]

        return validated_dict, validated_schema.confidence_notes
    except Exception as e:
        log_error(f"Validation error: {e}")
        parsed_json["confidence_notes"] = f"Validation warning: {str(e)}"
        return parsed_json, str(e)


# =========================================================
# 4. SUPABASE STORAGE & DATABASE INTEGRATION
# =========================================================

def fetch_slip_file_from_storage(image_url: str) -> bytes:
    """
    Download slip image/PDF from Supabase Storage bucket 'vehicare-1storage'.
    """
    service_role_key = get_service_role_key()
    url = f"{supabase.supabase_url}/storage/v1/object/{BUCKET_NAME}/{image_url}"

    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}"
    }

    log_info(f"Fetching file from Supabase Storage: {image_url}")
    response = requests.get(url, headers=headers, timeout=30)

    if response.status_code != 200:
        raise RuntimeError(f"Failed to fetch file from storage ({response.status_code}): {response.text}")

    return response.content


def update_service_slip_record(
    slip_id: str,
    ocr_raw_text: Optional[str] = None,
    parsed_data: Optional[dict] = None,
    status: str = "Parsed",
    error_message: Optional[str] = None
) -> dict:
    """
    Update the service_slips record in Supabase database.
    """
    service_role_key = get_service_role_key()
    url = f"{supabase.supabase_url}/rest/v1/service_slips?id=eq.{slip_id}"

    update_payload: Dict[str, Any] = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    if ocr_raw_text is not None:
        update_payload["ocr_raw_text"] = ocr_raw_text

    if parsed_data is not None:
        update_payload["parsed_data"] = parsed_data

    update_payload["error_message"] = error_message

    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

    log_info(f"Updating service_slips record {slip_id} -> status={status}")

    response = requests.patch(url, headers=headers, json=update_payload, timeout=30)

    if response.status_code not in [200, 204]:
        log_error(f"Database update failed ({response.status_code}): {response.text}")
        raise RuntimeError(f"Database update failed: {response.text}")

    try:
        data = response.json()
        return data[0] if isinstance(data, list) and len(data) > 0 else data
    except Exception:
        return {"id": slip_id, "status": status}


def fetch_service_slip(slip_id: str) -> dict:
    """
    Fetch single service_slips row from Supabase by ID.
    """
    service_role_key = get_service_role_key()
    url = f"{supabase.supabase_url}/rest/v1/service_slips?id=eq.{slip_id}&select=*"

    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json"
    }

    response = requests.get(url, headers=headers, timeout=30)
    if response.status_code != 200:
        raise RuntimeError(f"Failed to query service_slips table: {response.text}")

    data = response.json()
    if not data:
        raise ValueError(f"Service slip record {slip_id} not found in database")

    return data[0]


# =========================================================
# 5. MAIN END-TO-END PIPELINE PROCESSOR
# =========================================================

def process_service_slip_pipeline(
    slip_id: str,
    file_bytes: Optional[bytes] = None,
    filename: Optional[str] = None
) -> dict:
    """
    Complete Automated Service Slip Intelligence Pipeline:
    1. Fetch record & file from Supabase Storage
    2. Run OCR -> raw text
    3. Update status to 'OCR running'
    4. Call Anthropic Claude Haiku (versioned prompt v1.0.0) -> structured JSON
    5. Validate JSON via Pydantic schema
    6. Update service_slips record (ocr_raw_text, parsed_data, status='Parsed')
    """
    log_info(f"=== Starting Service Slip Pipeline for slip_id={slip_id} ===")

    try:
        slip_record = fetch_service_slip(slip_id)
        image_url = slip_record.get("image_url")

        if not file_bytes:
            if not image_url:
                raise ValueError(f"Service slip {slip_id} has no image_url in database")
            file_bytes = fetch_slip_file_from_storage(image_url)

        file_ref = filename or image_url or "slip.png"

        update_service_slip_record(slip_id, status="OCR running")

        log_info(f"Extracting OCR raw text for {file_ref}")
        ocr_raw_text = extract_raw_ocr_text(file_bytes, file_ref)

        log_info("Executing Claude Haiku structured JSON extraction...")
        raw_json_output = call_claude_haiku_extraction(ocr_raw_text)

        log_info("Validating structured JSON response...")
        validated_json, validation_notes = validate_and_normalize_extraction(raw_json_output)

        updated_record = update_service_slip_record(
            slip_id=slip_id,
            ocr_raw_text=ocr_raw_text,
            parsed_data=validated_json,
            status="Parsed",
            error_message=None
        )

        log_info(f"=== Pipeline completed successfully for slip_id={slip_id} ===")
        return {
            "success": True,
            "slip_id": slip_id,
            "status": "Parsed",
            "ocr_raw_text": ocr_raw_text,
            "parsed_data": validated_json,
            "updated_record": updated_record
        }

    except Exception as e:
        error_msg = str(e)
        log_error(f"Pipeline failure for slip_id={slip_id}: {error_msg}")
        try:
            update_service_slip_record(
                slip_id=slip_id,
                status="Failed",
                error_message=error_msg
            )
        except Exception as db_err:
            log_error(f"Failed to update error status in DB: {db_err}")

        return {
            "success": False,
            "slip_id": slip_id,
            "status": "Failed",
            "error_message": error_msg
        }

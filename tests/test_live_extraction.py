"""
Live Service Slip Extraction Test using credentials from .env
"""

import json
import os
import sys
from dotenv import load_dotenv

# Add current working directory to sys.path
sys.path.insert(0, os.path.abspath("."))

# Load environment variables from .env
load_dotenv()

from app.services.slip_processor import (
    extract_raw_ocr_text,
    call_claude_haiku_extraction,
    validate_and_normalize_extraction
)

def run_live_test():
    sample_path = "samples/sample_invoice_1.png"

    if not os.path.exists(sample_path):
        from samples.generate_sample_slips import create_sample_invoice_1
        os.makedirs("samples", exist_ok=True)
        create_sample_invoice_1(sample_path)

    print("==================================================")
    print("LIVE SERVICE SLIP EXTRACTION TEST")
    print("==================================================")

    # 1. Read sample invoice
    with open(sample_path, "rb") as f:
        image_bytes = f.read()

    # 2. Extract OCR Raw Text
    print("\n--- STEP 1: OCR Text Extraction ---")
    raw_ocr_text = extract_raw_ocr_text(image_bytes, "sample_invoice_1.png")
    print("OCR Raw Text Length:", len(raw_ocr_text))
    print("OCR Snippet:\n", raw_ocr_text[:200])

    # 3. Call LLM (Claude Haiku / OpenRouter)
    print("\n--- STEP 2: LLM Extraction ---")
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")

    if openrouter_key and "your-openrouter" not in openrouter_key:
        print("Using OpenRouter API key...")
    elif anthropic_key and "your-anthropic" not in anthropic_key:
        print("Using direct Anthropic API key...")
    else:
        print("Warning: Placeholder API key detected in .env.")

    try:
        raw_json_output = call_claude_haiku_extraction(raw_ocr_text)
        print("\nLLM Extraction Response:")
        print(json.dumps(raw_json_output, indent=2))

        # 4. Validate & Normalize
        print("\n--- STEP 3: Schema Validation & Normalization ---")
        validated_dict, confidence_notes = validate_and_normalize_extraction(raw_json_output)
        print("\nValidated JSON Output:")
        print(json.dumps(validated_dict, indent=2))
        print("\n==================================================")
        print("SUCCESS: Live extraction pipeline test completed!")
        print("==================================================")

    except Exception as e:
        print("\n==================================================")
        print("LIVE EXTRACTION TEST ERROR:", e)
        print("==================================================")

if __name__ == "__main__":
    run_live_test()

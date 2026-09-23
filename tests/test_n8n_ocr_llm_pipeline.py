"""
End-to-End Test Suite for n8n Webhook -> FastAPI OCR API (/slips/ocr) -> rawText -> OpenRouter/Claude -> Supabase Pipeline
"""

import json
import os
import sys
import unittest
from dotenv import load_dotenv

# Ensure sys.path includes project root
sys.path.insert(0, os.path.abspath("."))
load_dotenv()

from fastapi.testclient import TestClient
from app.main import app
from app.services.slip_processor import (
    call_claude_haiku_extraction,
    validate_and_normalize_extraction,
)
from app.schemas.slip import ServiceSlipExtractionSchema


class TestN8nOcrLlmPipeline(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

        # Generate sample slips if missing
        if not os.path.exists("samples/sample_invoice_1.png"):
            from samples.generate_sample_slips import (
                create_sample_invoice_1,
                create_sample_invoice_2,
                create_sample_invoice_3,
            )
            os.makedirs("samples", exist_ok=True)
            create_sample_invoice_1("samples/sample_invoice_1.png")
            create_sample_invoice_2("samples/sample_invoice_2.png")
            create_sample_invoice_3("samples/sample_invoice_3.png")

    # =========================================================
    # STAGE 1: TEST n8n -> FASTAPI OCR API (/slips/ocr)
    # =========================================================

    def test_01_backend_ocr_endpoint_clear_slip(self):
        """
        Stage 1: Submit binary image to POST /slips/ocr (multipart/form-data)
        Verifies HTTP 200 and {"rawText": "..."} output.
        """
        with open("samples/sample_invoice_1.png", "rb") as f:
            response = self.client.post(
                "/slips/ocr",
                files={"file": ("sample_invoice_1.png", f, "image/png")}
            )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("rawText", data)
        raw_text = data["rawText"]
        self.assertIn("APEX AUTOMOTIVE", raw_text.upper())

        print("\n[STAGE 1 PASSED] POST /slips/ocr returned rawText successfully.")
        print(f"rawText Snippet:\n{raw_text[:120]}...")

    # =========================================================
    # STAGE 2: TEST MESSY INVOICE OCR
    # =========================================================

    def test_02_backend_ocr_endpoint_messy_slip(self):
        """
        Stage 2: Test messy slip against POST /slips/ocr
        """
        with open("samples/sample_invoice_2.png", "rb") as f:
            response = self.client.post(
                "/slips/ocr",
                files={"file": ("sample_invoice_2.png", f, "image/png")}
            )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("rawText", data)
        raw_text = data["rawText"]
        self.assertTrue(len(raw_text) > 10)

        print("\n[STAGE 2 PASSED] Messy slip OCR returned rawText successfully.")

    # =========================================================
    # STAGE 3: TEST MISSING FIELDS SLIP OCR
    # =========================================================

    def test_03_backend_ocr_endpoint_missing_fields_slip(self):
        """
        Stage 3: Test slip with missing fields (no date, no mileage)
        """
        with open("samples/sample_invoice_3.png", "rb") as f:
            response = self.client.post(
                "/slips/ocr",
                files={"file": ("sample_invoice_3.png", f, "image/png")}
            )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("rawText", data)
        raw_text = data["rawText"]
        self.assertIn("LUBE", raw_text.upper())

        print("\n[STAGE 3 PASSED] Missing fields slip OCR returned rawText successfully.")

    # =========================================================
    # STAGE 4: TEST LLM STRUCTURING WITH FEW-SHOT EXAMPLES
    # =========================================================

    def test_04_llm_structuring_from_raw_ocr_text(self):
        """
        Stage 4: Pass rawText to OpenRouter/Claude Haiku & Pydantic schema validation.
        Verifies non-hallucination, date normalization, and numeric fields.
        """
        raw_ocr_sample = (
            "APEX AUTOMOTIVE SERVICE CENTER\n"
            "Date: 2026-08-15\n"
            "Odometer: 45,210 km\n"
            "1. Full Synthetic Oil & Filter Change $ 65.00\n"
            "2. Tire Rotation & Wheel Balance $ 45.00\n"
            "Engine Oil Filter (P/N: 90915-YZZN1) $ 12.50\n"
            "TOTAL COST: $ 122.50\n"
            "Notes: Customer reported slight brake squeak."
        )

        openrouter_key = os.getenv("OPENROUTER_API_KEY")
        anthropic_key = os.getenv("ANTHROPIC_API_KEY")

        if not openrouter_key and not anthropic_key:
            self.skipTest("No LLM API key available in .env")

        raw_json_output = call_claude_haiku_extraction(raw_ocr_sample)
        validated_dict, _ = validate_and_normalize_extraction(raw_json_output)

        self.assertEqual(validated_dict["service_date"], "2026-08-15")
        self.assertEqual(validated_dict["mileage"], 45210)
        self.assertIsNotNone(validated_dict["cost"])
        self.assertTrue(len(validated_dict["service_items"]) >= 1)

        print("\n[STAGE 4 PASSED] OpenRouter/Claude Haiku LLM Structuring verified.")
        print(f"Structured JSON: {json.dumps(validated_dict, indent=2)}")


if __name__ == "__main__":
    unittest.main()

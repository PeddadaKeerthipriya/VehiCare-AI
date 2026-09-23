"""
Comprehensive End-to-End Test Suite for Week 2 AI & Automation Scope
Service Slip Intelligence Pipeline
"""

import os

# Ensure default environment variables for test execution if not set
os.environ.setdefault("SUPABASE_URL", "https://dummy-project.supabase.co")
os.environ.setdefault("SUPABASE_PUBLISHABLE_KEY", "dummy-publishable-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "dummy-service-role-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "dummy-anthropic-api-key")

import json
import unittest
from unittest.mock import MagicMock, patch

from app.prompts.slip_extraction_v1 import (
    CLAUDE_MODEL_DEFAULT,
    PROMPT_VERSION,
    build_user_prompt_v1,
)
from app.schemas.slip import ServiceSlipExtractionSchema
from app.services.slip_processor import (
    call_claude_haiku_extraction,
    extract_raw_ocr_text,
    process_service_slip_pipeline,
    validate_and_normalize_extraction,
)


class TestServiceSlipPipeline(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.sample_1_path = "samples/sample_invoice_1.png"
        cls.sample_2_path = "samples/sample_invoice_2.png"

        # Generate sample files if not present
        if not os.path.exists(cls.sample_1_path):
            from samples.generate_sample_slips import create_sample_invoice_1, create_sample_invoice_2
            os.makedirs("samples", exist_ok=True)
            create_sample_invoice_1(cls.sample_1_path)
            create_sample_invoice_2(cls.sample_2_path)

    # =========================================================
    # TEST 1: OCR TEXT EXTRACTION
    # =========================================================

    def test_01_ocr_raw_text_extraction(self):
        """
        Verify pytesseract extracts readable text from sample service slip.
        """
        with open(self.sample_1_path, "rb") as f:
            image_bytes = f.read()

        raw_ocr_text = extract_raw_ocr_text(image_bytes, "sample_invoice_1.png")

        self.assertIsNotNone(raw_ocr_text)
        self.assertIn("APEX AUTOMOTIVE", raw_ocr_text.upper())
        self.assertIn("TOYOTA", raw_ocr_text.upper())
        self.assertIn("TOTAL", raw_ocr_text.upper())
        print("\n[TEST 1 PASSED] OCR raw text extracted successfully from invoice 1.")
        print(f"OCR snippet: {raw_ocr_text[:150]}...")

    # =========================================================
    # TEST 2: SCHEMAS & VALUE NORMALIZATION
    # =========================================================

    def test_02_schema_validation_and_normalization(self):
        """
        Verify Pydantic schema normalizes messy dates, costs, and mileages.
        """
        raw_json_input = {
            "service_date": "15/08/2026",
            "mileage": "45,210 km",
            "service_type": "Scheduled Maintenance",
            "cost": "$ 187.50",
            "service_items": [
                {"description": "Full Synthetic Oil & Filter Change", "cost": 65.0},
                {"description": "Tire Rotation", "cost": 45.0}
            ],
            "parts": [
                {"part_name": "Engine Oil Filter", "part_number": "90915-YZZN1", "cost": 12.50}
            ],
            "notes": "Brakes inspected, 7mm remaining.",
            "confidence_notes": None
        }

        validated_dict, confidence_notes = validate_and_normalize_extraction(raw_json_input)

        self.assertEqual(validated_dict["service_date"], "2026-08-15")
        self.assertEqual(validated_dict["mileage"], 45210)
        self.assertEqual(validated_dict["cost"], 187.50)
        self.assertEqual(len(validated_dict["service_items"]), 2)
        self.assertEqual(len(validated_dict["parts"]), 1)

        print("\n[TEST 2 PASSED] Pydantic schema validation & normalization verified.")

    # =========================================================
    # TEST 3: PROMPT VERSIONING & CLAUDE EXTRACTION
    # =========================================================

    def test_03_prompt_versioning_and_structure(self):
        """
        Verify versioned prompt build and metadata injection.
        """
        self.assertEqual(PROMPT_VERSION, "v1.0.0")

        ocr_sample = "INVOICE DATE: 2026-08-15 TOTAL: $100.00"
        user_prompt = build_user_prompt_v1(ocr_sample)

        self.assertIn(ocr_sample, user_prompt)
        self.assertIn("RAW OCR TEXT START", user_prompt)

        print("\n[TEST 3 PASSED] Prompt v1.0.0 template and structure verified.")

    # =========================================================
    # TEST 4: END-TO-END PIPELINE WITH MOCKED SUPABASE & CLAUDE
    # =========================================================

    @patch("app.services.slip_processor.fetch_service_slip")
    @patch("app.services.slip_processor.update_service_slip_record")
    @patch("app.services.slip_processor.call_claude_haiku_extraction")
    def test_04_end_to_end_pipeline_flow(
        self, mock_claude, mock_update_db, mock_fetch_db
    ):
        """
        Verify end-to-end service slip processing flow.
        """
        test_slip_id = "11111111-2222-3333-4444-555555555555"

        mock_fetch_db.return_value = {
            "id": test_slip_id,
            "image_url": "test-user/sample_invoice_1.png",
            "status": "Uploaded"
        }

        mock_claude.return_value = {
            "service_date": "2026-08-15",
            "mileage": 45210,
            "service_type": "Scheduled Maintenance",
            "cost": 187.50,
            "service_items": [
                {"description": "Oil Change", "cost": 65.0}
            ],
            "parts": [
                {"part_name": "Oil Filter", "part_number": "90915-YZZN1", "cost": 12.50}
            ],
            "notes": "All checks passed.",
            "confidence_notes": None,
            "_metadata": {
                "prompt_version": "v1.0.0",
                "model": "claude-3-haiku-20240307"
            }
        }

        mock_update_db.return_value = {
            "id": test_slip_id,
            "status": "Parsed"
        }

        with open(self.sample_1_path, "rb") as f:
            file_bytes = f.read()

        result = process_service_slip_pipeline(
            slip_id=test_slip_id,
            file_bytes=file_bytes,
            filename="sample_invoice_1.png"
        )

        self.assertTrue(result["success"])
        self.assertEqual(result["status"], "Parsed")
        self.assertIn("APEX AUTOMOTIVE", result["ocr_raw_text"].upper())

        parsed_data = result["parsed_data"]
        self.assertEqual(parsed_data["service_date"], "2026-08-15")
        self.assertEqual(parsed_data["cost"], 187.50)
        self.assertEqual(parsed_data["mileage"], 45210)

        # Verify DB updates called with correct params
        mock_update_db.assert_any_call(test_slip_id, status="OCR running")

        print("\n[TEST 4 PASSED] End-to-End Pipeline execution verified.")

    def test_05_messy_invoice_ocr_handling(self):
        """
        Verify OCR raw text extraction on messy invoice sample 2.
        """
        with open(self.sample_2_path, "rb") as f:
            image_bytes = f.read()

        raw_ocr_text = extract_raw_ocr_text(image_bytes, "sample_invoice_2.png")
        self.assertIsNotNone(raw_ocr_text)
        self.assertTrue(len(raw_ocr_text) > 10)
        self.assertIn("JOE", raw_ocr_text.upper())

        print("\n[TEST 5 PASSED] Messy OCR raw text handling verified.")
        print(f"Messy OCR snippet: {raw_ocr_text[:120]}...")


if __name__ == "__main__":
    unittest.main()


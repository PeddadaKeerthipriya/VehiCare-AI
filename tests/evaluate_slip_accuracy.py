"""
10-Sample Service Slip Intelligence Accuracy Evaluator
Benchmarks OCR + LLM Extraction across 10 distinct service slip layouts.
"""

import json
import os
import sys
import time
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath("."))
load_dotenv()

from app.services.slip_processor import (
    extract_raw_ocr_text,
    call_claude_haiku_extraction,
    validate_and_normalize_extraction,
)

EXPECTED_GROUND_TRUTH = {
    "sample_01_clear_standard.png": {
        "expected_date": "2026-08-15",
        "expected_mileage": 45210,
        "expected_cost": 122.50,
        "allow_null_mileage": False,
        "allow_null_date": False,
    },
    "sample_02_messy_handwritten.png": {
        "expected_date": "2026-04-12",
        "expected_mileage": 68000,
        "expected_cost": 275.00,
        "allow_null_mileage": False,
        "allow_null_date": False,
    },
    "sample_03_missing_mileage.png": {
        "expected_date": "2026-07-20",
        "expected_mileage": None,
        "expected_cost": 145.00,
        "allow_null_mileage": True,
        "allow_null_date": False,
    },
    "sample_04_missing_date.png": {
        "expected_date": None,
        "expected_mileage": 52400,
        "expected_cost": 210.00,
        "allow_null_mileage": False,
        "allow_null_date": True,
    },
    "sample_05_missing_costs.png": {
        "expected_date": "2026-05-10",
        "expected_mileage": 30000,
        "expected_cost": 15.00,
        "allow_null_mileage": False,
        "allow_null_date": False,
    },
    "sample_06_blurry_ocr.png": {
        "expected_date": "2026-03-18",
        "expected_mileage": 78900,
        "expected_cost": 300.00,
        "allow_null_mileage": False,
        "allow_null_date": False,
    },
    "sample_07_custom_parts.png": {
        "expected_date": "2026-06-22",
        "expected_mileage": 12000,
        "expected_cost": 865.00,
        "allow_null_mileage": False,
        "allow_null_date": False,
    },
    "sample_08_heavy_noise.png": {
        "expected_date": "2026-02-14",
        "expected_mileage": 88500,
        "expected_cost": 500.00,
        "allow_null_mileage": False,
        "allow_null_date": False,
    },
    "sample_09_multi_item_long.png": {
        "expected_date": "2026-08-01",
        "expected_mileage": 64100,
        "expected_cost": 480.00,
        "allow_null_mileage": False,
        "allow_null_date": False,
    },
    "sample_10_illegible_damaged.png": {
        "expected_date": None,
        "expected_mileage": None,
        "expected_cost": 85.00,
        "allow_null_mileage": True,
        "allow_null_date": True,
    },
}


def run_accuracy_evaluation():
    print("======================================================================")
    print("      VEHICARE AI - 10-SAMPLE SERVICE SLIP ACCURACY BENCHMARK        ")
    print("======================================================================")

    # Ensure 10 samples exist
    if not os.path.exists("samples/slips_10/sample_01_clear_standard.png"):
        from samples.generate_10_sample_slips import generate_all_10_sample_slips
        generate_all_10_sample_slips()

    total_fields_evaluated = 0
    total_fields_passed = 0
    slip_results = []

    files = sorted(os.listdir("samples/slips_10"))
    for idx, fname in enumerate(files, 1):
        if not fname.endswith(".png"):
            continue

        filepath = os.path.join("samples/slips_10", fname)
        gt = EXPECTED_GROUND_TRUTH.get(fname, {})

        print(f"\n[{idx}/10] Evaluating Slip: {fname}...")
        with open(filepath, "rb") as f:
            img_bytes = f.read()

        raw_ocr_text = extract_raw_ocr_text(img_bytes, fname)
        print(f"   OCR Text Length: {len(raw_ocr_text)} chars")

        try:
            raw_llm_json = call_claude_haiku_extraction(raw_ocr_text)
            val_json, _ = validate_and_normalize_extraction(raw_llm_json)

            extracted_date = val_json.get("service_date")
            extracted_mileage = val_json.get("mileage")
            extracted_cost = val_json.get("cost")

            # Field checks
            passed_checks = 0
            total_checks = 3

            # 1. Date Check
            expected_date = gt.get("expected_date")
            if gt.get("allow_null_date"):
                if extracted_date is None or "null" in str(extracted_date).lower() or extracted_date == expected_date:
                    passed_checks += 1
            else:
                if extracted_date == expected_date:
                    passed_checks += 1

            # 2. Mileage Check
            expected_mileage = gt.get("expected_mileage")
            if gt.get("allow_null_mileage"):
                if extracted_mileage is None or extracted_mileage == expected_mileage:
                    passed_checks += 1
            else:
                if extracted_mileage and abs(extracted_mileage - (expected_mileage or 0)) < 1000:
                    passed_checks += 1

            # 3. Cost Check
            expected_cost = gt.get("expected_cost")
            if extracted_cost and abs(extracted_cost - (expected_cost or 0)) < 5.0:
                passed_checks += 1

            accuracy_pct = (passed_checks / total_checks) * 100
            total_fields_evaluated += total_checks
            total_fields_passed += passed_checks

            print(f"   Date Extracted:    {extracted_date} (Expected: {expected_date})")
            print(f"   Mileage Extracted: {extracted_mileage} (Expected: {expected_mileage})")
            print(f"   Cost Extracted:    ${extracted_cost} (Expected: ${expected_cost})")
            print(f"   Slip Accuracy:     {accuracy_pct:.1f}% ({passed_checks}/{total_checks})")

            slip_results.append({
                "filename": fname,
                "accuracy": accuracy_pct,
                "extracted": val_json
            })

        except Exception as e:
            print(f"   ERROR processing {fname}: {e}")

    overall_accuracy = (total_fields_passed / total_fields_evaluated) * 100 if total_fields_evaluated else 0

    print("\n======================================================================")
    print("                     BENCHMARK EVALUATION SUMMARY                     ")
    print("======================================================================")
    print(f"Total Slips Evaluated:    {len(slip_results)} / 10")
    print(f"Total Fields Checked:     {total_fields_evaluated}")
    print(f"Total Fields Correct:     {total_fields_passed}")
    print(f"OVERALL PIPELINE ACCURACY: {overall_accuracy:.2f}%")
    print("======================================================================")


if __name__ == "__main__":
    run_accuracy_evaluation()

"""
Master Production Smoke Test Suite for All 3 LLM Pipelines (Thursday Milestone)
Validates:
- Pipeline 1: Service Slip OCR & Document Intelligence Extraction
- Pipeline 2: Fault Diagnosis Intelligence Pipeline (RAG + Claude 3 Haiku)
- Pipeline 3: Vehicle Health Reporter Pipeline (Timeline Evaluation + 0-100 Score)
"""

import json
import os
import sys
import time
from dotenv import load_dotenv

# Add current directory to path
sys.path.insert(0, os.path.abspath("."))

load_dotenv()


def smoke_test_pipeline_1_slip_extraction():
    """Smoke test Pipeline 1: Service Slip OCR & Structured Extraction"""
    print("\n=======================================================")
    print(">> PIPELINE 1: SERVICE SLIP OCR & DOCUMENT EXTRACTION")
    print("=======================================================")

    from app.services.slip_processor import (
        extract_raw_ocr_text,
        call_claude_haiku_extraction,
        validate_and_normalize_extraction,
    )

    sample_ocr = """APEX AUTOMOTIVE SERVICE CENTER
Date: 2026-08-15
Odometer: 45,210 km
1. Full Synthetic Oil Change $ 65.00
2. Tire Rotation $ 45.00
Parts: Engine Oil Filter (P/N: 90915-YZZN1) $ 12.50
TOTAL COST: $ 122.50
Notes: Pads good at 7mm."""

    start_t = time.time()
    try:
        raw_json = call_claude_haiku_extraction(sample_ocr)
        validated_dict, _ = validate_and_normalize_extraction(raw_json)
        elapsed = time.time() - start_t

        print(f"[OK] Pipeline 1 Executed Successfully in {elapsed:.2f}s")
        print(f"  Extracted Service Type: {validated_dict.get('service_type')}")
        print(f"  Extracted Cost: ${validated_dict.get('cost')}")
        print(f"  Line Items Extracted: {len(validated_dict.get('service_items', []))}")
        return {"status": "PASSED", "pipeline": "1. Slip OCR", "latency": f"{elapsed:.2f}s"}
    except Exception as e:
        elapsed = time.time() - start_t
        print(f"[FAIL] Pipeline 1 Failed ({elapsed:.2f}s): {e}")
        return {"status": "FAILED", "pipeline": "1. Slip OCR", "error": str(e)}


def smoke_test_pipeline_2_fault_diagnosis():
    """Smoke test Pipeline 2: Fault Diagnosis Intelligence"""
    print("\n=======================================================")
    print(">> PIPELINE 2: FAULT DIAGNOSIS INTELLIGENCE")
    print("=======================================================")

    from app.services.diagnosis_processor import call_claude_diagnosis
    from app.services.retrieval import format_retrieved_knowledge_context, retrieve_relevant_knowledge
    from app.schemas.diagnosis import DiagnosisLLMResponse

    vehicle_info = {"make": "Toyota", "model": "RAV4", "year": 2022, "odometer_km": 45000}
    symptom = "Steering wheel vibrates heavily when applying brakes at high speeds."

    start_t = time.time()
    try:
        knowledge = retrieve_relevant_knowledge(symptom=symptom, make="Toyota", model="RAV4")
        knowledge_text = format_retrieved_knowledge_context(knowledge)

        raw_diag = call_claude_diagnosis(
            symptom=symptom,
            vehicle_info=vehicle_info,
            service_history=[],
            retrieved_knowledge_text=knowledge_text,
        )

        diag_dict_data = raw_diag.get("diagnosis", raw_diag)
        validated_schema = DiagnosisLLMResponse(**diag_dict_data).apply_safety_rules()
        diag_out = validated_schema.model_dump()
        elapsed = time.time() - start_t

        print(f"[OK] Pipeline 2 Executed Successfully in {elapsed:.2f}s")
        print(f"  Severity: {diag_out.get('severity')}")
        print(f"  Confidence Score: {diag_out.get('confidence_score')}")
        print(f"  Possible Cause: {diag_out.get('possible_cause')}")
        print(f"  Mechanic Required: {diag_out.get('mechanic_required')}")
        return {"status": "PASSED", "pipeline": "2. Fault Diagnosis", "latency": f"{elapsed:.2f}s"}
    except Exception as e:
        elapsed = time.time() - start_t
        print(f"[FAIL] Pipeline 2 Failed ({elapsed:.2f}s): {e}")
        return {"status": "FAILED", "pipeline": "2. Fault Diagnosis", "error": str(e)}


def smoke_test_pipeline_3_health_reporter():
    """Smoke test Pipeline 3: Weekly Vehicle Health Reporter"""
    print("\n=======================================================")
    print(">> PIPELINE 3: VEHICLE HEALTH REPORTER")
    print("=======================================================")

    from app.prompts.health_reporter_v1 import format_health_prompt_context
    from app.schemas.health_report import VehicleHealthReportLLMResponse
    from app.services.health_reporter import call_claude_health_summary

    sample_vehicle = {
        "make": "Honda",
        "model": "City",
        "year": 2021,
        "odometer_km": 52400,
        "maintenance_schedules": [{"task_name": "Coolant Flush", "status": "due_soon"}],
        "fault_diagnoses": [],
        "service_records": [{"service_type": "Oil Change", "service_date": "2026-01-15"}],
    }

    start_t = time.time()
    try:
        context = format_health_prompt_context(sample_vehicle)
        raw_health = call_claude_health_summary(context)
        validated = VehicleHealthReportLLMResponse(**raw_health).model_dump()
        elapsed = time.time() - start_t

        print(f"[OK] Pipeline 3 Executed Successfully in {elapsed:.2f}s")
        print(f"  Health Score: {validated.get('health_score')}/100")
        print(f"  Status: {validated.get('status')}")
        print(f"  Summary: {validated.get('summary')}")
        return {"status": "PASSED", "pipeline": "3. Health Reporter", "latency": f"{elapsed:.2f}s"}
    except Exception as e:
        elapsed = time.time() - start_t
        print(f"[FAIL] Pipeline 3 Failed ({elapsed:.2f}s): {e}")
        return {"status": "FAILED", "pipeline": "3. Health Reporter", "error": str(e)}


def run_all_smoke_tests():
    print("================================================================")
    print(">> PRODUCTION SMOKE TEST RUNNER - ALL 3 LLM PIPELINES")
    print("================================================================")

    results = []
    results.append(smoke_test_pipeline_1_slip_extraction())
    results.append(smoke_test_pipeline_2_fault_diagnosis())
    results.append(smoke_test_pipeline_3_health_reporter())

    print("\n================================================================")
    print("SMOKE TEST SUMMARY RESULTS")
    print("================================================================")
    all_passed = True
    for r in results:
        status_icon = "[PASS]" if r["status"] == "PASSED" else "[FAIL]"
        info = r.get("latency") or r.get("error", "Error")
        print(f"{status_icon} {r['pipeline']}: {r['status']} ({info})")
        if r["status"] != "PASSED":
            all_passed = False

    print("================================================================")
    if all_passed:
        print("[SUCCESS] ALL 3 LLM PIPELINES PASSED PRODUCTION SMOKE TESTING!")
    else:
        print("[WARNING] SOME SMOKE TESTS ENCOUNTERED ERRORS (CHECK API KEYS / SERVICES)")
    print("================================================================")
    return all_passed


if __name__ == "__main__":
    success = run_all_smoke_tests()
    sys.exit(0 if success else 1)

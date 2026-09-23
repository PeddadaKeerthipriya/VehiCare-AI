"""
Live Production Smoke Test for Pipeline 3: Vehicle Health Reporter
Evaluates real/mocked vehicle timeline data through Claude 3 Haiku and validates the 0-100 Health Score output.
"""

import json
import os
import sys
from dotenv import load_dotenv

# Add current working directory to sys.path
sys.path.insert(0, os.path.abspath("."))

load_dotenv()

from app.prompts.health_reporter_v1 import format_health_prompt_context
from app.schemas.health_report import VehicleHealthReportLLMResponse
from app.services.health_reporter import call_claude_health_summary


def run_live_health_reporter_test():
    print("==================================================")
    print("LIVE SMOKE TEST — PIPELINE 3: VEHICLE HEALTH REPORTER")
    print("==================================================")

    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")

    if openrouter_key and "your-openrouter" not in openrouter_key:
        print("Using OpenRouter API key...")
    elif anthropic_key and "your-anthropic" not in anthropic_key:
        print("Using direct Anthropic API key...")
    else:
        print("Warning: Placeholder or mock API key detected in .env.")

    # 1. Prepare Realistic Multi-Entity Vehicle Timeline Fixture
    sample_vehicle_timeline = {
        "id": "00000000-0000-0000-0000-000000000001",
        "make": "Honda",
        "model": "City",
        "year": 2021,
        "vin": "MAKGM2657M0123456",
        "odometer_km": 52400,
        "user_id": "11111111-2222-3333-4444-555555555555",
        "service_records": [
            {
                "service_date": "2026-03-10",
                "service_type": "Scheduled Maintenance",
                "notes": "Engine oil changed, oil filter replaced, 50,000 km general service.",
            },
            {
                "service_date": "2025-09-18",
                "service_type": "Brake Service",
                "notes": "Front brake pads replaced.",
            },
        ],
        "fault_diagnoses": [
            {
                "symptom": "Slight whistling sound from AC vents at high blower speed",
                "possible_cause": "Cabin air filter clogged or blower motor debris",
                "severity": "Advisory",
                "confidence_score": 0.82,
            }
        ],
        "maintenance_schedules": [
            {
                "task_name": "Engine Coolant Flush",
                "due_km": 55000,
                "status": "due_soon",
            },
            {
                "task_name": "Tire Rotation & Wheel Balancing",
                "due_km": 50000,
                "status": "overdue",
            },
        ],
        "insurance_policies": [
            {
                "policy_number": "POL-HND-9921",
                "provider": "HDFC ERGO",
                "expiry_date": "2026-11-30",
            }
        ],
        "puc_certificates": [
            {
                "certificate_number": "PUC-2026-4432",
                "expiry_date": "2026-10-15",
            }
        ],
    }

    # 2. Format Health Prompt Context
    print("\n--- STEP 1: Format Vehicle Timeline Prompt Context ---")
    prompt_context = format_health_prompt_context(sample_vehicle_timeline)
    print(prompt_context)

    # 3. Invoke Live Claude Haiku Health Report LLM
    print("\n--- STEP 2: Invoking Claude 3 Haiku for Health Summary ---")
    try:
        raw_output = call_claude_health_summary(prompt_context)
        print("\nRaw LLM Output:")
        print(json.dumps(raw_output, indent=2))

        # 4. Validate Schema & Health Score Bounds
        print("\n--- STEP 3: Schema Validation & Score Verification ---")
        validated = VehicleHealthReportLLMResponse(**raw_output)
        report = validated.model_dump()

        print(f"\n[Validated Report Summary]")
        print(f"- Vehicle Health Score: {report['health_score']}/100")
        print(f"- Vehicle Status: {report['status']}")
        print(f"- Summary: {report['summary']}")
        print(f"- Key Concerns ({len(report['key_concerns'])}): {report['key_concerns']}")
        print(f"- Recommended Actions ({len(report['recommended_actions'])}): {report['recommended_actions']}")

        assert 0 <= report["health_score"] <= 100, "Health score must be between 0 and 100"
        assert len(report["summary"]) > 10, "Summary must be non-empty"

        print("\n==================================================")
        print("SUCCESS: Pipeline 3 (Vehicle Health Reporter) Passed!")
        print("==================================================")
        return True

    except Exception as e:
        print("\n==================================================")
        print("PIPELINE 3 SMOKE TEST ERROR:", e)
        print("==================================================")
        return False


if __name__ == "__main__":
    success = run_live_health_reporter_test()
    sys.exit(0 if success else 1)

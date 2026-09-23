"""
Live Vehicle Fault Diagnosis Test using .env credentials
"""

import json
import os
import sys
from dotenv import load_dotenv

# Add current directory to sys.path
sys.path.insert(0, os.path.abspath("."))

# Load environment variables
load_dotenv()

from app.services.diagnosis_processor import call_claude_diagnosis
from app.services.retrieval import format_retrieved_knowledge_context, retrieve_relevant_knowledge
from app.schemas.diagnosis import DiagnosisResponseSchema


def run_live_diagnosis_test():
    print("==================================================")
    print("LIVE FAULT DIAGNOSIS PIPELINE TEST")
    print("==================================================")

    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")

    if openrouter_key and "your-openrouter" not in openrouter_key:
        print("Using OpenRouter API key...")
    elif anthropic_key and "your-anthropic" not in anthropic_key:
        print("Using direct Anthropic API key...")
    else:
        print("Warning: Placeholder API key detected in .env.")

    sample_vehicle = {
        "make": "Toyota",
        "model": "RAV4",
        "year": 2022,
        "odometer_km": 45000,
        "vin": "4T1B11HK5NW123456"
    }

    sample_service_history = [
        {
            "service_date": "2026-06-15",
            "service_type": "Scheduled Maintenance",
            "notes": "Full synthetic oil change and multi-point inspection."
        }
    ]

    sample_symptom = "My steering wheel vibrates heavily when I apply the brakes at 60 mph."

    print(f"\nUser Symptom: '{sample_symptom}'")
    print(f"Vehicle: {sample_vehicle['year']} {sample_vehicle['make']} {sample_vehicle['model']}")

    # 1. Retrieve Knowledge Base context
    print("\n--- STEP 1: Knowledge Base Retrieval ---")
    knowledge_entries = retrieve_relevant_knowledge(
        symptom=sample_symptom,
        make=sample_vehicle["make"],
        model=sample_vehicle["model"]
    )
    print(f"Retrieved {len(knowledge_entries)} relevant knowledge passages:")
    for entry in knowledge_entries:
        print(f"- [{entry.get('id')}] System: {entry.get('system')} | Cause: {entry.get('possible_cause')[:60]}...")

    knowledge_text = format_retrieved_knowledge_context(knowledge_entries)

    # 2. Invoke Live LLM Diagnosis
    print("\n--- STEP 2: Invoking Claude Diagnosis ---")
    try:
        raw_diagnosis = call_claude_diagnosis(
            symptom=sample_symptom,
            vehicle_info=sample_vehicle,
            service_history=sample_service_history,
            retrieved_knowledge_text=knowledge_text
        )

        print("\nRaw LLM Diagnosis Output:")
        print(json.dumps(raw_diagnosis, indent=2))

        # 3. Validate & Apply Safety Rules
        print("\n--- STEP 3: Validation & Safety Enforcement ---")
        validated_schema = DiagnosisResponseSchema(**raw_diagnosis)
        validated_schema = validated_schema.apply_safety_rules()
        final_output = validated_schema.model_dump()

        print("\nFinal Validated Diagnosis Output:")
        print(json.dumps(final_output, indent=2))

        print("\n==================================================")
        print("SUCCESS: Live Fault Diagnosis Test Passed!")
        print("==================================================")

    except Exception as e:
        print("\n==================================================")
        print("LIVE DIAGNOSIS TEST ERROR:", e)
        print("==================================================")


if __name__ == "__main__":
    run_live_diagnosis_test()

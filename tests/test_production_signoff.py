import pytest
from pathlib import Path
from app.services.token_cost_audit import TASK_MODEL_SPLIT
from app.services.google_maps_guardrails import GoogleMapsGuardrailManager
from app.services.llm_cost_monitoring import LLMCostMonitoringManager
from app.services.prompt_injection_defense import detect_prompt_injection_threat
from app.services.prompt_defect_remediation import enforce_p0_p1_prompt_remediation


def test_production_readiness_all_5_n8n_workflows_signed_off():
    n8n_dir = Path("n8n")
    workflows = [
        "service_slip_workflow.json",
        "fault_diagnosis_workflow.json",
        "predictive_maintenance_trigger_workflow.json",
        "reminder_notifier_workflow.json",
        "vehicle_health_reporter_workflow.json",
    ]
    for wf in workflows:
        path = n8n_dir / wf
        assert path.exists(), f"Production workflow missing: {wf}"


def test_production_readiness_security_and_cost_modules():
    # 1. Model split configured
    assert "fault_diagnosis" in TASK_MODEL_SPLIT
    assert TASK_MODEL_SPLIT["fault_diagnosis"] == "claude-3-haiku"

    # 2. Maps API Guardrail manager initializable
    maps_manager = GoogleMapsGuardrailManager()
    assert maps_manager.daily_request_limit == 1000
    assert maps_manager.daily_spend_limit_usd == 10.00

    # 3. Cost monitoring initializable
    cost_manager = LLMCostMonitoringManager()
    assert cost_manager.daily_budget_usd == 25.00

    # 4. Security threat scanner operational
    threat = detect_prompt_injection_threat("Standard symptom input")
    assert threat["threat_detected"] is False

    # 5. Defect remediation operational
    remediated = enforce_p0_p1_prompt_remediation({"confidence_score": 0.5, "severity": "Critical"})
    assert remediated["severity"] == "Advisory"

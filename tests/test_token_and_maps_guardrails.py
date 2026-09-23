import pytest
from app.services.token_cost_audit import calculate_llm_cost, audit_prompt_task_split
from app.services.google_maps_guardrails import GoogleMapsGuardrailManager, COST_PER_NEARBY_SEARCH_REQUEST_USD


def test_llm_cost_calculation_haiku():
    # 100,000 input tokens, 20,000 output tokens for Haiku
    result = calculate_llm_cost("claude-3-haiku", input_tokens=100_000, output_tokens=20_000)
    assert result["model"] == "claude-3-haiku"
    assert result["input_cost_usd"] == 0.025  # 0.1M * $0.25
    assert result["output_cost_usd"] == 0.025  # 0.02M * $1.25
    assert result["total_cost_usd"] == 0.05


def test_llm_cost_calculation_sonnet():
    # 100,000 input tokens, 20,000 output tokens for Sonnet
    result = calculate_llm_cost("claude-3-5-sonnet", input_tokens=100_000, output_tokens=20_000)
    assert result["model"] == "claude-3-5-sonnet"
    assert result["input_cost_usd"] == 0.30   # 0.1M * $3.00
    assert result["output_cost_usd"] == 0.30  # 0.02M * $15.00
    assert result["total_cost_usd"] == 0.60


def test_task_model_split_audit():
    diag_audit = audit_prompt_task_split("fault_diagnosis")
    assert diag_audit["assigned_model"] == "claude-3-haiku"
    assert diag_audit["cost_tier"] == "low_cost_high_throughput"

    complex_ocr_audit = audit_prompt_task_split("complex_slip_extraction")
    assert complex_ocr_audit["assigned_model"] == "claude-3-5-sonnet"
    assert complex_ocr_audit["cost_tier"] == "high_reasoning_complex_ocr"


def test_google_maps_guardrail_allowed():
    manager = GoogleMapsGuardrailManager(daily_request_limit=1000, daily_spend_limit_usd=10.00)
    status = manager.evaluate_request_guardrail(current_daily_requests=500, current_daily_spend_usd=5.00)
    assert status["allowed"] is True
    assert status["code"] == "OK"


def test_google_maps_guardrail_quota_exceeded():
    manager = GoogleMapsGuardrailManager(daily_request_limit=1000, daily_spend_limit_usd=10.00)
    status = manager.evaluate_request_guardrail(current_daily_requests=1000, current_daily_spend_usd=5.00)
    assert status["allowed"] is False
    assert status["code"] == "QUOTA_EXCEEDED"


def test_google_maps_guardrail_budget_exceeded():
    manager = GoogleMapsGuardrailManager(daily_request_limit=1000, daily_spend_limit_usd=10.00)
    status = manager.evaluate_request_guardrail(current_daily_requests=200, current_daily_spend_usd=10.05)
    assert status["allowed"] is False
    assert status["code"] == "BUDGET_EXCEEDED"


def test_google_maps_cache_key_generation():
    manager = GoogleMapsGuardrailManager()
    key1 = manager.build_cache_key(lat=12.9715987, lng=77.5945627, radius_m=5000)
    key2 = manager.build_cache_key(lat=12.9716123, lng=77.5945999, radius_m=5000)
    assert key1 == key2  # Rounded to 3 decimals match ~110m proximity

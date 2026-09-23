import pytest
from app.services.llm_cost_monitoring import LLMCostMonitoringManager


def test_cost_monitoring_expense_recording():
    manager = LLMCostMonitoringManager(daily_budget_usd=10.00)
    result = manager.record_llm_expense(
        task_name="fault_diagnosis",
        model_name="claude-3-haiku",
        input_tokens=100_000,
        output_tokens=20_000
    )
    assert result["expense_record"]["task_name"] == "fault_diagnosis"
    assert result["cost_info"]["total_cost_usd"] == 0.05
    assert result["alert_status"]["alert_level"] == "NORMAL"


def test_cost_monitoring_80_percent_warning_alert():
    manager = LLMCostMonitoringManager(daily_budget_usd=1.00)  # $1.00 budget
    # Record $0.85 expense (85% of budget)
    manager.record_llm_expense("complex_ocr", "claude-3-5-sonnet", input_tokens=150_000, output_tokens=26_667)
    alert = manager.evaluate_budget_alerts()
    assert alert["trigger_alert"] is True
    assert alert["alert_level"] == "WARNING_80_PERCENT"
    assert "80%" in alert["alert_message"]


def test_cost_monitoring_critical_budget_exceeded_alert():
    manager = LLMCostMonitoringManager(daily_budget_usd=0.50)  # $0.50 budget
    # Record $0.60 expense (120% of budget)
    manager.record_llm_expense("complex_ocr", "claude-3-5-sonnet", input_tokens=100_000, output_tokens=20_000)
    alert = manager.evaluate_budget_alerts()
    assert alert["trigger_alert"] is True
    assert alert["alert_level"] == "CRITICAL_BUDGET_EXCEEDED"
    assert "HARD CEILING EXCEEDED" in alert["alert_message"]


def test_supabase_budget_notification_generation():
    manager = LLMCostMonitoringManager(daily_budget_usd=0.04)  # $0.04 budget
    # $0.05 expense triggers alert
    manager.record_llm_expense("fault_diagnosis", "claude-3-haiku", input_tokens=100_000, output_tokens=20_000)
    notification = manager.generate_supabase_budget_notification(user_id="admin_123")
    assert notification is not None
    assert notification["type"] == "budget_alert"
    assert notification["user_id"] == "admin_123"

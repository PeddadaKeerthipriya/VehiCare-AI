"""
AI LLM & API Cost-Monitoring and Budget Alerts Module
Monitors real-time API spending, enforces daily/monthly budget ceilings, and triggers automated alerts.
"""

import time
from typing import Dict, Any, List, Optional
from app.services.token_cost_audit import calculate_llm_cost

# Default Budget Thresholds
DEFAULT_DAILY_LLM_BUDGET_USD = 25.00
DEFAULT_MONTHLY_LLM_BUDGET_USD = 500.00


class LLMCostMonitoringManager:
    def __init__(
        self,
        daily_budget_usd: float = DEFAULT_DAILY_LLM_BUDGET_USD,
        monthly_budget_usd: float = DEFAULT_MONTHLY_LLM_BUDGET_USD
    ):
        self.daily_budget_usd = daily_budget_usd
        self.monthly_budget_usd = monthly_budget_usd
        self.expense_logs: List[Dict[str, Any]] = []

    def record_llm_expense(
        self,
        task_name: str,
        model_name: str,
        input_tokens: int,
        output_tokens: int
    ) -> Dict[str, Any]:
        """
        Records an LLM execution expense log and checks for budget alerts.
        """
        cost_info = calculate_llm_cost(model_name, input_tokens, output_tokens)
        timestamp = time.time()

        entry = {
            "timestamp": timestamp,
            "task_name": task_name,
            "model_name": cost_info["model"],
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": cost_info["total_cost_usd"],
        }
        self.expense_logs.append(entry)

        alert_status = self.evaluate_budget_alerts()
        return {
            "expense_record": entry,
            "cost_info": cost_info,
            "alert_status": alert_status,
        }

    def get_accumulated_daily_cost(self) -> float:
        """
        Calculates total USD spending logged for the current day.
        """
        return sum(log["cost_usd"] for log in self.expense_logs)

    def evaluate_budget_alerts(self) -> Dict[str, Any]:
        """
        Evaluates cumulative spending against 50%, 80%, and 100% budget thresholds.
        """
        total_daily_spend = sum(log["cost_usd"] for log in self.expense_logs)
        usage_pct = (total_daily_spend / self.daily_budget_usd) * 100.0 if self.daily_budget_usd > 0 else 0.0

        alert_level = "NORMAL"
        trigger_alert = False
        message = f"Daily AI API spending: ${total_daily_spend:.4f} of ${self.daily_budget_usd:.2f} ({usage_pct:.1f}%)."

        if usage_pct >= 100.0:
            alert_level = "CRITICAL_BUDGET_EXCEEDED"
            trigger_alert = True
            message = f"🚨 HARD CEILING EXCEEDED: Daily AI API budget cap of ${self.daily_budget_usd:.2f} reached (${total_daily_spend:.4f} spent)."
        elif usage_pct >= 80.0:
            alert_level = "WARNING_80_PERCENT"
            trigger_alert = True
            message = f"⚠️ BUDGET ALERT (80%): Daily AI API spend at ${total_daily_spend:.4f} ({usage_pct:.1f}% of ${self.daily_budget_usd:.2f} budget)."
        elif usage_pct >= 50.0:
            alert_level = "NOTICE_50_PERCENT"
            trigger_alert = False
            message = f"ℹ️ BUDGET NOTICE (50%): Daily AI API spend at ${total_daily_spend:.4f} ({usage_pct:.1f}% of ${self.daily_budget_usd:.2f} budget)."

        return {
            "total_daily_spend_usd": round(total_daily_spend, 6),
            "daily_budget_limit_usd": self.daily_budget_usd,
            "usage_percentage": round(usage_pct, 2),
            "alert_level": alert_level,
            "trigger_alert": trigger_alert,
            "alert_message": message,
        }

    def generate_supabase_budget_notification(self, user_id: str = "system_admin") -> Optional[Dict[str, Any]]:
        """
        Generates a notification payload ready for Supabase notifications table if budget alert is triggered.
        """
        alert = self.evaluate_budget_alerts()
        if not alert["trigger_alert"]:
            return None

        return {
            "user_id": user_id,
            "channel": "email",
            "type": "budget_alert",
            "title": f"AI API Budget Alert: {alert['alert_level']}",
            "message": alert["alert_message"],
            "is_sent": False,
        }

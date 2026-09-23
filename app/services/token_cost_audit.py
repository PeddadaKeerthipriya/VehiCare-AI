"""
AI Token & Cost Audit Module
Tracks token consumption, model splits (Haiku vs Sonnet), and estimated costs for VehiCare AI pipelines.
"""

from typing import Dict, Any, Optional

# Pricing per 1,000,000 tokens (USD)
MODEL_PRICING = {
    "claude-3-haiku": {
        "input_per_1m": 0.25,
        "output_per_1m": 1.25,
    },
    "claude-3-5-sonnet": {
        "input_per_1m": 3.00,
        "output_per_1m": 15.00,
    },
}

# Task Model Split Allocations
TASK_MODEL_SPLIT = {
    "fault_diagnosis": "claude-3-haiku",
    "weekly_health_reporter": "claude-3-haiku",
    "simple_slip_extraction": "claude-3-haiku",
    "complex_slip_extraction": "claude-3-5-sonnet",
    "predictive_maintenance_rules": "deterministic_rules_engine",
}


def calculate_llm_cost(model_name: str, input_tokens: int, output_tokens: int) -> Dict[str, Any]:
    """
    Calculates estimated cost in USD based on input/output token usage and model pricing.
    """
    normalized_model = "claude-3-5-sonnet" if "sonnet" in model_name.lower() else "claude-3-haiku"
    pricing = MODEL_PRICING.get(normalized_model, MODEL_PRICING["claude-3-haiku"])

    input_cost = (input_tokens / 1_000_000.0) * pricing["input_per_1m"]
    output_cost = (output_tokens / 1_000_000.0) * pricing["output_per_1m"]
    total_cost = input_cost + output_cost

    return {
        "model": normalized_model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "input_cost_usd": round(input_cost, 6),
        "output_cost_usd": round(output_cost, 6),
        "total_cost_usd": round(total_cost, 6),
    }


def audit_prompt_task_split(task_name: str) -> Dict[str, Any]:
    """
    Returns the designated model split and cost tier for a given AI task.
    """
    assigned_model = TASK_MODEL_SPLIT.get(task_name, "claude-3-haiku")
    pricing = MODEL_PRICING.get(assigned_model, {"input_per_1m": 0.0, "output_per_1m": 0.0})

    return {
        "task_name": task_name,
        "assigned_model": assigned_model,
        "cost_tier": "low_cost_high_throughput" if assigned_model == "claude-3-haiku" else "high_reasoning_complex_ocr",
        "pricing_input_per_1m": pricing["input_per_1m"],
        "pricing_output_per_1m": pricing["output_per_1m"],
    }

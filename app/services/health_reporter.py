"""
Vehicle Health Reporter Pipeline Service
Evaluates full vehicle context, computes 0-100 Health Score with Claude 3 Haiku,
applies schema validation & retries, and queues weekly health notifications.
"""

import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests

try:
    import anthropic
except ImportError:
    anthropic = None

from app.database import supabase
from app.prompts.health_reporter_v1 import (
    CLAUDE_HEALTH_REPORTER_MODEL_DEFAULT,
    HEALTH_REPORTER_PROMPT_VERSION,
    HEALTH_REPORTER_SYSTEM_PROMPT_V1,
    HEALTH_REPORTER_TEMPERATURE,
    build_health_reporter_user_prompt_v1,
    format_health_prompt_context,
)
from app.schemas.health_report import (
    VehicleHealthReportLLMResponse,
    VehicleHealthReportResponseSchema,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("health_reporter")


# =========================================================
# 1. FETCH FULL VEHICLE CONTEXT
# =========================================================

def fetch_vehicle_full_timeline(vehicle_id: str) -> Dict[str, Any]:
    """
    Fetch vehicle record along with all related tables (service records, diagnoses, maintenance, insurance, PUC).
    """
    try:
        res = (
            supabase
            .table("vehicles")
            .select("id, make, model, year, vin, odometer_km, user_id, service_records(*), fault_diagnoses(*), maintenance_schedules(*), insurance_policies(*), puc_certificates(*)")
            .eq("id", vehicle_id)
            .limit(1)
            .execute()
        )
        if res.data:
            return res.data[0]
    except Exception as err:
        logger.warning(f"Failed to fetch nested vehicle timeline for {vehicle_id}: {err}")

    # Fallback to single vehicle fetch
    try:
        v_res = supabase.table("vehicles").select("*").eq("id", vehicle_id).limit(1).execute()
        if v_res.data:
            v_data = v_res.data[0]
            v_data["service_records"] = []
            v_data["fault_diagnoses"] = []
            v_data["maintenance_schedules"] = []
            v_data["insurance_policies"] = []
            v_data["puc_certificates"] = []
            return v_data
    except Exception as fallback_err:
        logger.error(f"Fallback vehicle query failed: {fallback_err}")

    raise ValueError(f"Vehicle not found or database unreachable: {vehicle_id}")


# =========================================================
# 2. CALL CLAUDE 3 HAIKU HEALTH SUMMARY
# =========================================================

def call_claude_health_summary(
    prompt_context: str,
    max_retries: int = 3,
) -> Dict[str, Any]:
    """
    Invokes Claude 3 Haiku via OpenRouter or Anthropic API to generate structured health report.
    Includes exponential retry loop and JSON cleaning.
    """
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")

    if not openrouter_key and not anthropic_key:
        raise ValueError("ANTHROPIC_API_KEY or OPENROUTER_API_KEY environment variable is required")

    user_prompt = build_health_reporter_user_prompt_v1(prompt_context)
    use_openrouter = bool(openrouter_key and "your-openrouter" not in openrouter_key)
    model_name = os.getenv("CLAUDE_HEALTH_MODEL", "anthropic/claude-3-haiku" if use_openrouter else CLAUDE_HEALTH_REPORTER_MODEL_DEFAULT)

    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            if use_openrouter:
                logger.info(f"Invoking Claude Health Reporter via OpenRouter ({model_name}), attempt {attempt}/{max_retries}")
                url = "https://openrouter.ai/api/v1/chat/completions"
                headers = {
                    "Authorization": f"Bearer {openrouter_key}",
                    "HTTP-Referer": "https://vehicare.app",
                    "X-Title": "VehiCare AI Health Reporter",
                    "Content-Type": "application/json",
                }
                payload = {
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": HEALTH_REPORTER_SYSTEM_PROMPT_V1},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": HEALTH_REPORTER_TEMPERATURE,
                    "max_tokens": 1000,
                }
                resp = requests.post(url, headers=headers, json=payload, timeout=45)
                if resp.status_code != 200:
                    raise RuntimeError(f"OpenRouter API error ({resp.status_code}): {resp.text}")

                res_json = resp.json()
                raw_text = res_json["choices"][0]["message"]["content"].strip()
            else:
                logger.info(f"Invoking Claude Health Reporter via Anthropic API ({model_name}), attempt {attempt}/{max_retries}")
                client = anthropic.Anthropic(api_key=anthropic_key)
                response = client.messages.create(
                    model=model_name,
                    max_tokens=1000,
                    temperature=HEALTH_REPORTER_TEMPERATURE,
                    system=HEALTH_REPORTER_SYSTEM_PROMPT_V1,
                    messages=[{"role": "user", "content": user_prompt}],
                )
                raw_text = response.content[0].text.strip()

            # Clean markdown code fences if present
            cleaned = raw_text
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

            parsed = json.loads(cleaned)
            parsed["_metadata"] = {
                "prompt_version": HEALTH_REPORTER_PROMPT_VERSION,
                "model": model_name,
                "provider": "openrouter" if use_openrouter else "anthropic",
                "processed_at": datetime.now(timezone.utc).isoformat(),
            }
            return parsed

        except json.JSONDecodeError as jde:
            last_error = f"JSON parse error from Claude response: {jde}"
            logger.warning(f"Attempt {attempt} failed: {last_error}")
            time.sleep(1)
        except Exception as e:
            last_error = f"LLM API call error: {str(e)}"
            logger.warning(f"Attempt {attempt} failed: {last_error}")
            time.sleep(1)

    raise RuntimeError(f"Claude Health Reporter failed after {max_retries} attempts: {last_error}")


# =========================================================
# 3. MAIN HEALTH REPORTER PIPELINE
# =========================================================

def process_vehicle_health_report_pipeline(vehicle_id: str, vehicle_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    End-to-end pipeline execution for Weekly Vehicle Health Reporter:
    1. Fetch full timeline
    2. Format prompt context
    3. Call Claude 3 Haiku
    4. Validate schema
    5. Return structured report
    """
    logger.info(f"=== Starting Vehicle Health Reporter Pipeline for vehicle_id={vehicle_id} ===")

    try:
        # 1. Fetch data
        if vehicle_data:
            timeline_data = vehicle_data
        else:
            timeline_data = fetch_vehicle_full_timeline(vehicle_id)

        # 2. Format context
        prompt_context = format_health_prompt_context(timeline_data)

        # 3. Call LLM
        raw_llm_output = call_claude_health_summary(prompt_context)

        # 4. Schema Validation
        validated = VehicleHealthReportLLMResponse(**raw_llm_output)
        report_dict = validated.model_dump()

        response = VehicleHealthReportResponseSchema(
            success=True,
            vehicle_id=str(vehicle_id),
            health_score=report_dict["health_score"],
            status=report_dict["status"],
            summary=report_dict["summary"],
            key_concerns=report_dict.get("key_concerns", []),
            recommended_actions=report_dict.get("recommended_actions", []),
            generated_at=datetime.now(timezone.utc),
        )

        return response.model_dump()

    except Exception as e:
        logger.error(f"Health reporter pipeline failed: {e}")
        return {
            "success": False,
            "vehicle_id": str(vehicle_id),
            "error": str(e),
        }

import logging
import os
from typing import Optional

import requests

from app.database import supabase
from app.prompts.diagnosis_v1 import (
    DIAGNOSIS_PROMPT_VERSION,
    DIAGNOSIS_SYSTEM_PROMPT_V1,
    DIAGNOSIS_TEMPERATURE,
    build_diagnosis_user_prompt_v1,
)
from app.schemas.diagnosis import (
    DiagnosisLLMResponse,
    DiagnosisResponseSchema,
    DEFAULT_MECHANIC_DISCLAIMER,
)
from app.services.retrieval import (
    format_retrieved_knowledge_context,
    retrieve_relevant_knowledge,
)


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("diagnosis_processor")


# ============================================================
# N8N DIAGNOSIS WEBHOOK
# ============================================================

def call_n8n_diagnosis(
    symptom: str,
    vehicle_info: dict,
    service_history: list,
    retrieved_knowledge_text: str,
) -> dict:

    webhook_url = os.getenv("DIAGNOSIS_N8N_WEBHOOK_URL")

    if not webhook_url:
        raise ValueError(
            "DIAGNOSIS_N8N_WEBHOOK_URL is not configured"
        )

    payload = {
        "symptom": symptom,
        "vehicle_info": vehicle_info,
        "service_history": service_history,
        "retrieved_knowledge_text": retrieved_knowledge_text,
    }

    logger.info("Sending diagnosis request to n8n webhook")

    try:
        response = requests.post(
            webhook_url,
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        return response.json()
    except Exception as err:
        logger.error(f"n8n diagnosis call failed: {err}")
        raise RuntimeError(f"n8n webhook error: {err}") from err


# Backwards compatibility aliases for unit test suite
call_claude_diagnosis = call_n8n_diagnosis

def fetch_service_history(vehicle_id: str) -> list:
    try:
        s_res = supabase.table("service_records").select("*").eq("vehicle_id", vehicle_id).execute()
        return s_res.data if s_res.data else []
    except Exception as err:
        logger.warning(f"Failed to fetch service history: {err}")
        return []

def save_fault_diagnosis_record(diag_record: dict) -> dict:
    try:
        res = supabase.table("fault_diagnoses").insert(diag_record).execute()
        return res.data[0] if res.data else diag_record
    except Exception as db_err:
        logger.warning(f"Failed to persist diagnosis row: {db_err}")
        return diag_record


# ============================================================
# FETCH VEHICLE CONTEXT
# ============================================================

def fetch_vehicle_context(vehicle_id: str) -> dict:

    response = (
        supabase
        .table("vehicles")
        .select("*")
        .eq("id", vehicle_id)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise ValueError(
            f"Vehicle not found: {vehicle_id}"
        )

    return response.data[0]


fetch_vehicle_info = fetch_vehicle_context


# ============================================================
# FETCH SERVICE HISTORY
# ============================================================

def fetch_service_history(vehicle_id: str) -> list:

    response = (
        supabase
        .table("service_records")
        .select("*")
        .eq("vehicle_id", vehicle_id)
        .order("service_date", desc=True)
        .execute()
    )

    return response.data or []


# ============================================================
# SAVE DIAGNOSIS
# ============================================================

def save_diagnosis_record(
    vehicle_id: str,
    symptom: str,
    diagnosis: dict,
    user_id: Optional[str] = None,
) -> dict:

    record = {
        "vehicle_id": vehicle_id,
        "symptom": symptom,
        "possible_cause": diagnosis.get(
            "possible_cause"
        ),
        "recommended_action": diagnosis.get(
            "recommended_action"
        ),
        "severity": diagnosis.get(
            "severity"
        ),
        "confidence_score": diagnosis.get(
            "confidence_score"
        ),
        "mechanic_required": diagnosis.get(
            "mechanic_required",
            False,
        ),
    }

    if user_id:
        record["user_id"] = user_id

    response = (
        supabase
        .table("fault_diagnosis")
        .insert(record)
        .execute()
    )

    if not response.data:
        raise RuntimeError(
            "Failed to save diagnosis record"
        )

    return response.data[0]


# ============================================================
# MAIN FAULT DIAGNOSIS PIPELINE
# ============================================================

def process_fault_diagnosis_pipeline(
    vehicle_id: str,
    symptom: str,
    user_id: Optional[str] = None,
) -> dict:

    logger.info(
        f"=== Starting Fault Diagnosis Pipeline "
        f"for vehicle_id={vehicle_id} ==="
    )

    try:

        # ----------------------------------------------------
        # 1. Fetch vehicle information
        # ----------------------------------------------------

        vehicle_info = fetch_vehicle_info(
            vehicle_id
        )

        logger.info(
            f"Vehicle context fetched for {vehicle_id}"
        )

        # ----------------------------------------------------
        # 2. Fetch service history
        # ----------------------------------------------------

        service_history = fetch_service_history(
            vehicle_id
        )

        logger.info(
            f"Service history fetched: "
            f"{len(service_history)} records"
        )

        # ----------------------------------------------------
        # 3. Retrieve relevant knowledge
        # ----------------------------------------------------

        try:
            knowledge_entries = retrieve_relevant_knowledge(
                symptom
            )
        except Exception as k_err:
            logger.warning(f"Knowledge retrieval fallback: {k_err}")
            knowledge_entries = []

        knowledge_text = (
            format_retrieved_knowledge_context(
                knowledge_entries
            )
        )

        logger.info(
            f"Retrieved {len(knowledge_entries)} "
            f"knowledge entries"
        )

        # ----------------------------------------------------
        # 4. Call n8n
        # ----------------------------------------------------

        logger.info(
            "Calling n8n diagnosis webhook"
        )

        raw_diag = call_claude_diagnosis(
            symptom=symptom,
            vehicle_info=vehicle_info,
            service_history=service_history,
            retrieved_knowledge_text=knowledge_text,
        )

        logger.info(
            f"Raw n8n diagnosis received: {raw_diag}"
        )

        # ----------------------------------------------------
        # 4A. Validate Schema & Safety Rules
        # ----------------------------------------------------

        validated_schema = DiagnosisLLMResponse(
            **raw_diag
        )

        validated_schema = (
            validated_schema.apply_safety_rules()
        )

        diag_dict = validated_schema.model_dump()

        # ----------------------------------------------------
        # 5. Build API response structure
        # ----------------------------------------------------

        diagnosis_data = {
            "id": vehicle_id,
            "vehicle_id": vehicle_id,
            "symptom": symptom,
            "possible_cause": diag_dict.get(
                "possible_cause"
            ),
            "recommended_action": diag_dict.get(
                "recommended_action"
            ),
            "severity": diag_dict.get(
                "severity"
            ),
            "confidence_score": diag_dict.get(
                "confidence_score"
            ),
            "mechanic_required": diag_dict.get(
                "mechanic_required",
                False,
            ),
        }

        # ----------------------------------------------------
        # 6. Critical safety rule
        # ----------------------------------------------------

        severity = str(
            diagnosis_data.get("severity", "")
        ).lower()

        if severity == "critical":
            diagnosis_data["mechanic_required"] = True

        # ----------------------------------------------------
        # 7. Create API response matching schema
        # ----------------------------------------------------

        api_response = {
            "success": True,
            "message": "Diagnosis generated successfully",
            "diagnosis": diagnosis_data,
        }

        validated_response = DiagnosisResponseSchema(
            **api_response
        )

        if hasattr(
            validated_response,
            "model_dump"
        ):
            validated_dict = (
                validated_response.model_dump()
            )
        else:
            validated_dict = (
                validated_response.dict()
            )

        # ----------------------------------------------------
        # 8. Save diagnosis to Supabase
        # ----------------------------------------------------

        db_record = save_fault_diagnosis_record(
            diagnosis_data
        )

        # ----------------------------------------------------
        # 9. Return successful response
        # ----------------------------------------------------

        logger.info(
            f"=== Fault Diagnosis completed successfully "
            f"for vehicle_id={vehicle_id} ==="
        )

        return {
            "success": True,
            "vehicle_id": vehicle_id,
            "symptom": symptom,
            "diagnosis": validated_dict["diagnosis"],
            "retrieved_knowledge_count": len(
                knowledge_entries
            ),
            "db_record": db_record,
        }

    except Exception as e:

        logger.error(
            f"Diagnosis pipeline error: {e}"
        )

        return {
            "success": False,
            "vehicle_id": vehicle_id,
            "error": str(e),
        }
import requests
import asyncio

from fastapi import APIRouter, Depends, HTTPException, status

from app.config import (
    DIAGNOSIS_N8N_WEBHOOK_URL,
    SUPABASE_SERVICE_ROLE_KEY,
)
from app.database import supabase
from app.middleware.auth import AuthContext, verify_user
from app.schemas.diagnosis import (
    DiagnosisRequestSchema,
    DiagnosisResponseSchema,
)


router = APIRouter()

# Limit concurrent calls to the external n8n diagnosis service.
N8N_CONCURRENCY_LIMIT = 2
n8n_semaphore = asyncio.Semaphore(N8N_CONCURRENCY_LIMIT)


# =========================================================
# POST /diagnose
# AI VEHICLE DIAGNOSIS
# =========================================================

@router.post(
    "/diagnose",
    response_model=DiagnosisResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Diagnose vehicle fault",
)
async def diagnose_fault(
    payload: DiagnosisRequestSchema,
    auth: AuthContext = Depends(verify_user),
):

    # =====================================================
    # 1. AUTHENTICATION
    # =====================================================

    if not auth or not auth.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    user_id = str(auth.user.id)
    vehicle_id = str(payload.vehicle_id)

    # n8n uses the Supabase Service Role Key.
    # Normal users continue to use their authenticated user ID.
    is_service_role = (
        bool(SUPABASE_SERVICE_ROLE_KEY)
        and auth.token == SUPABASE_SERVICE_ROLE_KEY
    )

    print("=" * 60)
    print("AI VEHICLE DIAGNOSIS")
    print("USER ID:", user_id)
    print("VEHICLE ID:", vehicle_id)
    print("SERVICE ROLE:", is_service_role)
    print("SYMPTOM:", payload.symptom)
    print("=" * 60)

    # =====================================================
    # 2. GET FULL VEHICLE CONTEXT + SERVICE HISTORY
    # =====================================================

    try:
        print("=" * 60)
        print("FETCHING FULL VEHICLE CONTEXT")
        print("=" * 60)

        vehicle_query = (
            supabase
            .table("vehicles")
            .select(
                """
                id,
                user_id,
                make,
                model,
                year,
                vin,
                odometer_km,
                service_records(
                    id,
                    service_date,
                    service_type,
                    notes,
                    description,
                    cost,
                    source,
                    created_at
                )
                """
            )
            .eq("id", vehicle_id)
        )

        # Normal user:
        # verify that the vehicle belongs to that user.
        #
        # Service Role / n8n:
        # find the vehicle by vehicle_id without comparing
        # the vehicle owner to the Service Role user's ID.
        if not is_service_role:
            vehicle_query = vehicle_query.eq(
                "user_id",
                user_id,
            )

        vehicle_response = (
            vehicle_query
            .limit(1)
            .execute()
        )

        print("VEHICLE RESPONSE:")
        print(vehicle_response.data)

        if not vehicle_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehicle not found or does not belong to this user",
            )

        vehicle = vehicle_response.data[0]

        # For n8n / Service Role requests, use the actual
        # owner of the vehicle.
        if is_service_role:
            user_id = str(vehicle["user_id"])

        print("FINAL USER ID:", user_id)

    except HTTPException:
        raise

    except Exception as exc:
        print("=" * 60)
        print("VEHICLE CONTEXT ERROR")
        print("ERROR:", repr(exc))
        print("=" * 60)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch vehicle context: {str(exc)}",
        )

    # =====================================================
    # 3. GET N8N WEBHOOK URL
    # =====================================================

    n8n_webhook_url = DIAGNOSIS_N8N_WEBHOOK_URL

    print("=" * 60)
    print("N8N WEBHOOK URL")
    print(n8n_webhook_url)
    print("=" * 60)

    if not n8n_webhook_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Diagnosis n8n webhook URL is not configured",
        )

    # =====================================================
    # 4. PREPARE SERVICE HISTORY
    # =====================================================

    service_records = vehicle.get("service_records") or []

    print("=" * 60)
    print("SERVICE HISTORY")
    print("NUMBER OF SERVICE RECORDS:", len(service_records))
    print(service_records)
    print("=" * 60)

    # =====================================================
    # 5. SEND FULL CONTEXT TO N8N
    # =====================================================

    request_data = {
        "user_id": user_id,
        "vehicle_id": vehicle_id,
        "symptom": payload.symptom,

        # Vehicle information
        "make": vehicle.get("make"),
        "model": vehicle.get("model"),
        "year": vehicle.get("year"),
        "vin": vehicle.get("vin"),
        "odometer_km": vehicle.get("odometer_km"),

        # Service history
        "service_history": service_records,
    }

    print("=" * 60)
    print("SENDING FULL VEHICLE CONTEXT TO N8N")
    print("=" * 60)
    print(request_data)
    print("=" * 60)

    # =====================================================
    # 6. CALL N8N DIAGNOSIS WEBHOOK
    # =====================================================

    try:
        async with n8n_semaphore:
            response = await asyncio.to_thread(
                requests.post,
                n8n_webhook_url,
                json=request_data,
                timeout=30,
            )

        # Debug information
        print("=" * 60)
        print("N8N RESPONSE")
        print("N8N STATUS:", response.status_code)
        print(
            "N8N CONTENT TYPE:",
            response.headers.get("content-type"),
        )
        print(
            "N8N RESPONSE:",
            repr(response.text),
        )
        print("=" * 60)

        response.raise_for_status()

        # -------------------------------------------------
        # Check for empty response
        # -------------------------------------------------

        if not response.text.strip():
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "message": "Diagnosis service returned invalid JSON",
                    "n8n_status": response.status_code,
                    "n8n_response": response.text,
                },
            )

        # -------------------------------------------------
        # Parse JSON
        # -------------------------------------------------

        try:
            diagnosis_result = response.json()

        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "message": "Diagnosis service returned invalid JSON",
                    "n8n_status": response.status_code,
                    "n8n_response": response.text,
                },
            )

    except requests.exceptions.Timeout:

        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Diagnosis service timed out",
        )

    except HTTPException:
        raise

    except requests.exceptions.RequestException as exc:

        print("=" * 60)
        print("N8N REQUEST ERROR")
        print("ERROR:", repr(exc))
        print("=" * 60)

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                f"Failed to connect to diagnosis service: "
                f"{str(exc)}"
            ),
        )

    # =====================================================
    # 7. PRINT DIAGNOSIS RESPONSE
    # =====================================================

    print("=" * 60)
    print("N8N DIAGNOSIS RESPONSE")
    print(diagnosis_result)
    print("=" * 60)

    # =====================================================
    # 8. NORMALIZE N8N RESPONSE
    # =====================================================

    if isinstance(diagnosis_result, dict):

        # Case 1:
        # {
        #     "diagnosis": {
        #         ...
        #     }
        # }

        if isinstance(
            diagnosis_result.get("diagnosis"),
            dict,
        ):
            result = diagnosis_result["diagnosis"]

        # Case 2:
        # {
        #     "possible_cause": "...",
        #     "recommended_action": "...",
        #     ...
        # }

        else:
            result = diagnosis_result

    else:

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Diagnosis service returned "
                "an invalid diagnosis format"
            ),
        )

    # =====================================================
    # 9. EXTRACT DIAGNOSIS FIELDS
    # =====================================================

    possible_cause = result.get(
        "possible_cause"
    )

    recommended_action = result.get(
        "recommended_action"
    )

    severity = result.get(
        "severity"
    )

    confidence_score = result.get(
        "confidence_score"
    )

    mechanic_required = result.get(
        "mechanic_required"
    )

    # =====================================================
    # 10. VALIDATE REQUIRED FIELDS
    # =====================================================

    missing_fields = []

    if possible_cause is None:
        missing_fields.append(
            "possible_cause"
        )

    if recommended_action is None:
        missing_fields.append(
            "recommended_action"
        )

    if severity is None:
        missing_fields.append(
            "severity"
        )

    if confidence_score is None:
        missing_fields.append(
            "confidence_score"
        )

    if mechanic_required is None:
        missing_fields.append(
            "mechanic_required"
        )

    if missing_fields:

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "message": (
                    "Diagnosis service returned "
                    "incomplete data"
                ),
                "missing_fields": missing_fields,
                "received": result,
            },
        )

    # =====================================================
    # 11. PREPARE DATABASE RECORD
    # =====================================================

    fault_diagnosis_data = {
        "vehicle_id": vehicle_id,
        "symptom": payload.symptom,
        "possible_cause": possible_cause,
        "recommended_action": recommended_action,
        "severity": severity,
        "confidence_score": confidence_score,
        "mechanic_required": mechanic_required,
        "user_id": user_id,
    }

    print("=" * 60)
    print("INSERTING INTO fault_diagnoses")
    print(fault_diagnosis_data)
    print("=" * 60)

    # =====================================================
    # 12. SAVE DIAGNOSIS TO DATABASE
    # =====================================================

    try:

        db_response = (
            supabase
            .table("fault_diagnoses")
            .insert(fault_diagnosis_data)
            .execute()
        )

        if not db_response.data:

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save diagnosis",
            )

        saved_diagnosis = db_response.data[0]

    except HTTPException:
        raise

    except Exception as exc:

        print("=" * 60)
        print("FAULT DIAGNOSIS DATABASE ERROR")
        print("ERROR:", repr(exc))
        print("=" * 60)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                f"Failed to save diagnosis: "
                f"{str(exc)}"
            ),
        )

    # =====================================================
    # 13. RETURN FINAL RESPONSE
    # =====================================================

    print("=" * 60)
    print("DIAGNOSIS COMPLETED SUCCESSFULLY")
    print(saved_diagnosis)
    print("=" * 60)

    return {
        "success": True,
        "message": "Diagnosis completed successfully",
        "diagnosis": saved_diagnosis,
    }
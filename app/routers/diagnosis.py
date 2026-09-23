from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.middleware.auth import AuthContext, verify_user
from app.schemas.diagnosis import DiagnosisRequestSchema, DiagnosisResponseSchema
from app.services.diagnosis_processor import process_fault_diagnosis_pipeline

router = APIRouter()


@router.post(
    "/diagnose",
    response_model=dict,
    summary="Diagnose vehicle fault based on reported symptoms & vehicle history",
    responses={
        200: {"description": "Diagnosis successful"},
        400: {"description": "Invalid input parameters"},
        401: {"description": "Unauthorized"},
        500: {"description": "Diagnosis processing error"}
    }
)
async def diagnose_fault(
    payload: DiagnosisRequestSchema,
    auth: AuthContext = Depends(verify_user)
):
    """
    Vehicle Fault Diagnosis Intelligence Endpoint.

    Input:
        - vehicle_id: UUID of vehicle
        - symptom: Description of vehicle issue

    Process:
        1. Fetch vehicle context & service history from Supabase
        2. Perform RAG retrieval against Automotive Knowledge Base
        3. Execute Claude Haiku diagnosis with safety score validation & prompt injection defenses
        4. Save diagnosis result to Supabase `fault_diagnosis` table
    """
    result = process_fault_diagnosis_pipeline(
        vehicle_id=payload.vehicle_id,
        symptom=payload.symptom
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=500,
            detail=f"Fault diagnosis failed: {result.get('error')}"
        )

    return result

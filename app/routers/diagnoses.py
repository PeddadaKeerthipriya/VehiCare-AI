from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from postgrest.exceptions import APIError

from app.database import supabase
from app.middleware.auth import AuthContext, verify_user

from app.schemas.diagnosis import (
    DiagnosisCreate,
    DiagnosisUpdate,
    DiagnosisResponse,
)


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/diagnoses",
    tags=["Diagnosis History"],
)


# =========================================================
# AUTHENTICATE POSTGREST
# =========================================================

def _authenticate_postgrest(token: str) -> None:
    supabase.postgrest.auth(token)


# =========================================================
# VERIFY VEHICLE OWNERSHIP
# =========================================================

def verify_vehicle_owner(
    vehicle_id: UUID,
    auth: AuthContext,
) -> None:

    result = (
        supabase
        .table("vehicles")
        .select("id")
        .eq("id", str(vehicle_id))
        .eq("user_id", str(auth.user.id))
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found",
        )


# =========================================================
# DATABASE ERROR HANDLER
# =========================================================

def handle_database_error(exc: Exception) -> HTTPException:

    print("[DIAGNOSIS DATABASE ERROR]", repr(exc))

    if isinstance(exc, APIError):

        if exc.code == "23514":
            return HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Diagnosis data failed database validation.",
            )

    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="An unexpected database error occurred.",
    )


# =========================================================
# CREATE DIAGNOSIS
# =========================================================

@router.post(
    "",
    response_model=DiagnosisResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_diagnosis(
    data: DiagnosisCreate,
    auth: AuthContext = Depends(verify_user),
):

    try:
        _authenticate_postgrest(auth.token)

        # Verify vehicle belongs to logged-in user
        verify_vehicle_owner(
            data.vehicle_id,
            auth,
        )

        diagnosis_data = {
            "vehicle_id": str(data.vehicle_id),
            "user_id": str(auth.user.id),
            "symptom": data.symptom.strip(),
            "possible_cause": (
                data.possible_cause.strip()
                if data.possible_cause
                else None
            ),
            "recommended_action": (
                data.recommended_action.strip()
                if data.recommended_action
                else None
            ),
            "severity": data.severity,
            "confidence_score": data.confidence_score,
            "mechanic_required": data.mechanic_required,
        }

        response = (
            supabase
            .table("fault_diagnoses")
            .insert(diagnosis_data)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create diagnosis",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as exc:
        raise handle_database_error(exc)


# =========================================================
# GET ALL DIAGNOSES FOR VEHICLE
# =========================================================

@router.get(
    "/vehicle/{vehicle_id}",
    response_model=List[DiagnosisResponse],
)
async def get_vehicle_diagnoses(
    vehicle_id: UUID,
    auth: AuthContext = Depends(verify_user),
):

    try:
        _authenticate_postgrest(auth.token)

        verify_vehicle_owner(
            vehicle_id,
            auth,
        )

        response = (
            supabase
            .table("fault_diagnoses")
            .select("*")
            .eq(
                "vehicle_id",
                str(vehicle_id),
            )
            .eq(
                "user_id",
                str(auth.user.id),
            )
            .order(
                "created_at",
                desc=True,
            )
            .execute()
        )

        return response.data or []

    except HTTPException:
        raise

    except Exception as exc:
        raise handle_database_error(exc)


# =========================================================
# GET SINGLE DIAGNOSIS
# =========================================================

@router.get(
    "/{diagnosis_id}",
    response_model=DiagnosisResponse,
)
async def get_diagnosis(
    diagnosis_id: UUID,
    auth: AuthContext = Depends(verify_user),
):

    try:
        _authenticate_postgrest(auth.token)

        response = (
            supabase
            .table("fault_diagnoses")
            .select("*")
            .eq(
                "id",
                str(diagnosis_id),
            )
            .eq(
                "user_id",
                str(auth.user.id),
            )
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Diagnosis not found",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as exc:
        raise handle_database_error(exc)


# =========================================================
# UPDATE DIAGNOSIS
# =========================================================

@router.put(
    "/{diagnosis_id}",
    response_model=DiagnosisResponse,
)
async def update_diagnosis(
    diagnosis_id: UUID,
    data: DiagnosisUpdate,
    auth: AuthContext = Depends(verify_user),
):

    try:
        _authenticate_postgrest(auth.token)

        diagnosis_id_str = str(diagnosis_id)
        user_id_str = str(auth.user.id)

        print("=" * 60)
        print("UPDATING DIAGNOSIS")
        print("DIAGNOSIS ID:", diagnosis_id_str)
        print("USER ID:", user_id_str)
        print("=" * 60)

        # -----------------------------------------------------
        # 1. CHECK THAT DIAGNOSIS EXISTS
        # -----------------------------------------------------

        existing = (
            supabase
            .table("fault_diagnoses")
            .select("*")
            .eq(
                "id",
                diagnosis_id_str,
            )
            .eq(
                "user_id",
                user_id_str,
            )
            .execute()
        )

        print("EXISTING DIAGNOSIS:", existing.data)

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Diagnosis not found",
            )

        # -----------------------------------------------------
        # 2. PREPARE UPDATE DATA
        # -----------------------------------------------------

        update_data = data.model_dump(
            exclude_unset=True,
            mode="json",
        )

        print("UPDATE DATA:", update_data)

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields provided for update",
            )

        # -----------------------------------------------------
        # 3. CLEAN TEXT FIELDS
        # -----------------------------------------------------

        for field in [
            "symptom",
            "possible_cause",
            "recommended_action",
        ]:

            if field in update_data:

                if update_data[field] is not None:
                    update_data[field] = update_data[field].strip()

        # -----------------------------------------------------
        # 4. UPDATE DATABASE
        # -----------------------------------------------------

        update_response = (
            supabase
            .table("fault_diagnoses")
            .update(update_data)
            .eq(
                "id",
                diagnosis_id_str,
            )
            .eq(
                "user_id",
                user_id_str,
            )
            .execute()
        )

        print("UPDATE RESPONSE:", update_response.data)

        # -----------------------------------------------------
        # 5. FETCH UPDATED RECORD
        # -----------------------------------------------------

        updated_response = (
            supabase
            .table("fault_diagnoses")
            .select("*")
            .eq(
                "id",
                diagnosis_id_str,
            )
            .eq(
                "user_id",
                user_id_str,
            )
            .execute()
        )

        print("UPDATED RECORD:", updated_response.data)

        if not updated_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Diagnosis could not be updated",
            )

        return updated_response.data[0]

    except HTTPException:
        raise

    except Exception as exc:
        raise handle_database_error(exc)


# =========================================================
# DELETE DIAGNOSIS
# =========================================================

@router.delete(
    "/{diagnosis_id}",
)
async def delete_diagnosis(
    diagnosis_id: UUID,
    auth: AuthContext = Depends(verify_user),
):

    try:
        _authenticate_postgrest(auth.token)

        diagnosis_id_str = str(diagnosis_id)
        user_id_str = str(auth.user.id)

        # -----------------------------------------------------
        # 1. CHECK DIAGNOSIS EXISTS
        # -----------------------------------------------------

        existing = (
            supabase
            .table("fault_diagnoses")
            .select("id")
            .eq(
                "id",
                diagnosis_id_str,
            )
            .eq(
                "user_id",
                user_id_str,
            )
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Diagnosis not found",
            )

        # -----------------------------------------------------
        # 2. DELETE
        # -----------------------------------------------------

        delete_response = (
            supabase
            .table("fault_diagnoses")
            .delete()
            .eq(
                "id",
                diagnosis_id_str,
            )
            .eq(
                "user_id",
                user_id_str,
            )
            .execute()
        )

        print("DELETE RESPONSE:", delete_response.data)

        return {
            "message": "Diagnosis deleted successfully",
            "diagnosis_id": diagnosis_id_str,
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise handle_database_error(exc)
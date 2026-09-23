from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from postgrest.exceptions import APIError

from app.database import supabase
from app.middleware.auth import AuthContext, verify_user
from app.schemas.vehicle import (
    VehicleCreate,
    VehicleResponse,
    VehicleUpdate,
)
from app.schemas.diagnosis import FaultDiagnosisResponse


router = APIRouter(
    prefix="/vehicles",
    tags=["Vehicles"],
)


MAX_VEHICLES_PER_USER = 5

PG_UNIQUE_VIOLATION = "23505"
PG_CHECK_VIOLATION = "23514"


# =========================================================
# AUTHENTICATE POSTGREST
# =========================================================

def _authenticate_postgrest(token: str) -> None:
    supabase.postgrest.auth(token)


# =========================================================
# DATABASE ERROR HANDLER
# =========================================================

def _handle_db_error(exc: Exception) -> HTTPException:

    if isinstance(exc, APIError):

        if exc.code == PG_UNIQUE_VIOLATION:
            return HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A vehicle with this VIN already exists.",
            )

        if exc.code == PG_CHECK_VIOLATION:
            return HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Vehicle data failed validation.",
            )

    print("[VEHICLE DATABASE ERROR]", repr(exc))

    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="An unexpected database error occurred.",
    )


# =========================================================
# GET ALL VEHICLES
# GET /vehicles/
# =========================================================

@router.get(
    "/",
    response_model=List[VehicleResponse],
)
async def get_vehicles(
    auth: AuthContext = Depends(verify_user),
):
    try:
        _authenticate_postgrest(auth.token)

        response = (
            supabase
            .table("vehicles")
            .select("*")
            .eq("user_id", str(auth.user.id))
            .execute()
        )

        return response.data or []

    except HTTPException:
        raise

    except Exception as exc:
        raise _handle_db_error(exc)


# =========================================================
# CREATE VEHICLE
# POST /vehicles/
# =========================================================

@router.post(
    "/",
    response_model=VehicleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_vehicle(
    vehicle: VehicleCreate,
    auth: AuthContext = Depends(verify_user),
):
    try:
        _authenticate_postgrest(auth.token)

        existing = (
            supabase
            .table("vehicles")
            .select("id")
            .eq("user_id", str(auth.user.id))
            .execute()
        )

        if len(existing.data or []) >= MAX_VEHICLES_PER_USER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Maximum of {MAX_VEHICLES_PER_USER} "
                    "vehicles allowed per user"
                ),
            )

        vehicle_data = {
            "user_id": str(auth.user.id),
            "make": vehicle.make,
            "model": vehicle.model,
            "year": vehicle.year,
            "vin": vehicle.vin,
            "odometer_km": vehicle.odometer_km,
            "vehicle_type": vehicle.vehicle_type,
        }

        response = (
            supabase
            .table("vehicles")
            .insert(vehicle_data)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Vehicle was not created",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as exc:
        raise _handle_db_error(exc)


# =========================================================
# GET VEHICLE
# GET /vehicles/{vehicle_id}
# =========================================================

@router.get(
    "/{vehicle_id}",
    response_model=VehicleResponse,
)
async def get_vehicle(
    vehicle_id: UUID,
    auth: AuthContext = Depends(verify_user),
):
    try:
        _authenticate_postgrest(auth.token)

        response = (
            supabase
            .table("vehicles")
            .select("*")
            .eq("id", str(vehicle_id))
            .eq("user_id", str(auth.user.id))
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehicle not found",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as exc:
        raise _handle_db_error(exc)


# =========================================================
# UPDATE VEHICLE
# PUT /vehicles/{vehicle_id}
# =========================================================

@router.put(
    "/{vehicle_id}",
    response_model=VehicleResponse,
)
async def update_vehicle(
    vehicle_id: UUID,
    vehicle: VehicleUpdate,
    auth: AuthContext = Depends(verify_user),
):
    try:
        _authenticate_postgrest(auth.token)

        existing = (
            supabase
            .table("vehicles")
            .select("id")
            .eq("id", str(vehicle_id))
            .eq("user_id", str(auth.user.id))
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehicle not found",
            )

        update_data = {
            "make": vehicle.make,
            "model": vehicle.model,
            "year": vehicle.year,
            "vin": vehicle.vin,
            "odometer_km": vehicle.odometer_km,
            "vehicle_type": vehicle.vehicle_type,
        }

        response = (
            supabase
            .table("vehicles")
            .update(update_data)
            .eq("id", str(vehicle_id))
            .eq("user_id", str(auth.user.id))
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehicle not found or could not be updated",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as exc:
        raise _handle_db_error(exc)


# =========================================================
# DELETE VEHICLE
# DELETE /vehicles/{vehicle_id}
# =========================================================

@router.delete(
    "/{vehicle_id}",
)
async def delete_vehicle(
    vehicle_id: UUID,
    auth: AuthContext = Depends(verify_user),
):
    try:
        _authenticate_postgrest(auth.token)

        existing = (
            supabase
            .table("vehicles")
            .select("id")
            .eq("id", str(vehicle_id))
            .eq("user_id", str(auth.user.id))
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehicle not found",
            )

        (
            supabase
            .table("vehicles")
            .delete()
            .eq("id", str(vehicle_id))
            .eq("user_id", str(auth.user.id))
            .execute()
        )

        return {
            "message": "Vehicle deleted successfully",
            "vehicle_id": str(vehicle_id),
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise _handle_db_error(exc)


# =========================================================
# GET VEHICLE DIAGNOSIS HISTORY
# GET /vehicles/{vehicle_id}/diagnoses
#
# WEEK 4 BACKEND TASK
# =========================================================

@router.get(
    "/{vehicle_id}/diagnoses",
    response_model=List[FaultDiagnosisResponse],
)
async def get_vehicle_diagnoses(
    vehicle_id: UUID,
    auth: AuthContext = Depends(verify_user),
):
    try:
        _authenticate_postgrest(auth.token)

        # -------------------------------------------------
        # VERIFY VEHICLE BELONGS TO CURRENT USER
        # -------------------------------------------------

        vehicle_response = (
            supabase
            .table("vehicles")
            .select("id")
            .eq("id", str(vehicle_id))
            .eq("user_id", str(auth.user.id))
            .limit(1)
            .execute()
        )

        if not vehicle_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehicle not found",
            )

        # -------------------------------------------------
        # FETCH DIAGNOSIS HISTORY
        # -------------------------------------------------

        diagnosis_response = (
            supabase
            .table("fault_diagnoses")
            .select(
                """
                id,
                vehicle_id,
                symptom,
                possible_cause,
                recommended_action,
                severity,
                confidence_score,
                mechanic_required,
                created_at
                """
            )
            .eq("vehicle_id", str(vehicle_id))
            .order("created_at", desc=True)
            .execute()
        )

        return diagnosis_response.data or []

    except HTTPException:
        raise

    except Exception as exc:
        print(
            "[DIAGNOSIS HISTORY ERROR]",
            repr(exc),
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch diagnosis history",
        )
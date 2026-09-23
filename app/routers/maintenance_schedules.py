from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from postgrest.exceptions import APIError

from app.database import supabase
from app.middleware.auth import AuthContext, verify_user
from app.schemas.maintenance_schedule import (
    MaintenanceScheduleCreate,
    MaintenanceScheduleResponse,
    MaintenanceScheduleUpdate,
)


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/maintenance-schedules",
    tags=["Maintenance Schedules"],
)


# =========================================================
# DATABASE ERROR HANDLER
# =========================================================

def _handle_db_error(exc: Exception) -> HTTPException:

    print("=" * 60)
    print("[MAINTENANCE SCHEDULE DATABASE ERROR]")
    print("ERROR TYPE:", type(exc).__name__)
    print("ERROR:", repr(exc))
    print("=" * 60)

    if isinstance(exc, APIError):

        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": str(exc),
                "code": getattr(exc, "code", None),
                "details": getattr(exc, "details", None),
                "hint": getattr(exc, "hint", None),
            },
        )

    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=str(exc),
    )


# =========================================================
# AUTHENTICATE POSTGREST
# =========================================================

def _authenticate_postgrest(token: str) -> None:
    """
    Attach the authenticated user's JWT to Supabase requests.
    """
    supabase.postgrest.auth(token)


# =========================================================
# VERIFY VEHICLE OWNERSHIP
# =========================================================

def _verify_vehicle_ownership(
    vehicle_id: UUID,
    auth: AuthContext,
) -> None:

    try:

        vehicle = (
            supabase
            .table("vehicles")
            .select("id")
            .eq("id", str(vehicle_id))
            .eq("user_id", str(auth.user.id))
            .maybe_single()
            .execute()
        )

        if not vehicle or not vehicle.data:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehicle not found or does not belong to the current user",
            )

    except HTTPException:
        raise

    except Exception as exc:

        print("[VEHICLE OWNERSHIP ERROR]", repr(exc))

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify vehicle ownership: {str(exc)}",
        )


# =========================================================
# CREATE MAINTENANCE SCHEDULE
# =========================================================

@router.post(
    "/",
    response_model=MaintenanceScheduleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_maintenance_schedule(
    schedule: MaintenanceScheduleCreate,
    auth: AuthContext = Depends(verify_user),
):

    try:

        _authenticate_postgrest(auth.token)

        # -------------------------------------------------
        # VERIFY VEHICLE
        # -------------------------------------------------

        _verify_vehicle_ownership(
            schedule.vehicle_id,
            auth,
        )

        # -------------------------------------------------
        # PREPARE DATA
        # -------------------------------------------------

        schedule_data = {
            "vehicle_id": str(schedule.vehicle_id),
            "task_name": schedule.task_name.strip(),
            "due_date": (
                schedule.due_date.isoformat()
                if schedule.due_date
                else None
            ),
            "due_odometer_km": schedule.due_odometer_km,
            "status": schedule.status,
        }

        print("=" * 60)
        print("[MAINTENANCE SCHEDULE CREATE]")
        print(schedule_data)
        print("=" * 60)

        # -------------------------------------------------
        # INSERT
        # -------------------------------------------------

        response = (
            supabase
            .table("maintenance_schedules")
            .insert(schedule_data)
            .execute()
        )

        if not response.data:

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Maintenance schedule was not created",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as exc:
        raise _handle_db_error(exc)


# =========================================================
# GET ALL MAINTENANCE SCHEDULES
# =========================================================

@router.get(
    "/",
    response_model=List[MaintenanceScheduleResponse],
)
async def get_maintenance_schedules(
    auth: AuthContext = Depends(verify_user),
):

    try:

        _authenticate_postgrest(auth.token)

        # -------------------------------------------------
        # GET USER VEHICLES
        # -------------------------------------------------

        vehicles = (
            supabase
            .table("vehicles")
            .select("id")
            .eq("user_id", str(auth.user.id))
            .execute()
        )

        vehicle_ids = [
            vehicle["id"]
            for vehicle in (vehicles.data or [])
        ]

        # -------------------------------------------------
        # NO VEHICLES
        # -------------------------------------------------

        if not vehicle_ids:
            return []

        # -------------------------------------------------
        # GET MAINTENANCE SCHEDULES
        # -------------------------------------------------

        response = (
            supabase
            .table("maintenance_schedules")
            .select("*")
            .in_("vehicle_id", vehicle_ids)
            .order("due_date", desc=False)
            .execute()
        )

        return response.data or []

    except HTTPException:
        raise

    except Exception as exc:
        raise _handle_db_error(exc)


# =========================================================
# GET SINGLE MAINTENANCE SCHEDULE
# =========================================================

@router.get(
    "/{schedule_id}",
    response_model=MaintenanceScheduleResponse,
)
async def get_maintenance_schedule(
    schedule_id: UUID,
    auth: AuthContext = Depends(verify_user),
):

    try:

        _authenticate_postgrest(auth.token)

        response = (
            supabase
            .table("maintenance_schedules")
            .select(
                "*, vehicles!inner(id)"
            )
            .eq("id", str(schedule_id))
            .eq(
                "vehicles.user_id",
                str(auth.user.id),
            )
            .maybe_single()
            .execute()
        )

        if not response or not response.data:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Maintenance schedule not found",
            )

        return response.data

    except HTTPException:
        raise

    except Exception as exc:
        raise _handle_db_error(exc)


# =========================================================
# UPDATE MAINTENANCE SCHEDULE
# =========================================================

@router.put(
    "/{schedule_id}",
    response_model=MaintenanceScheduleResponse,
)
async def update_maintenance_schedule(
    schedule_id: UUID,
    schedule: MaintenanceScheduleUpdate,
    auth: AuthContext = Depends(verify_user),
):

    try:

        _authenticate_postgrest(auth.token)

        # -------------------------------------------------
        # CHECK EXISTING SCHEDULE
        # -------------------------------------------------

        existing = (
            supabase
            .table("maintenance_schedules")
            .select(
                "id, vehicles!inner(id, user_id)"
            )
            .eq("id", str(schedule_id))
            .eq(
                "vehicles.user_id",
                str(auth.user.id),
            )
            .maybe_single()
            .execute()
        )

        if not existing or not existing.data:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Maintenance schedule not found",
            )

        # -------------------------------------------------
        # PREPARE UPDATE DATA
        # -------------------------------------------------

        update_data = {}

        if schedule.task_name is not None:
            update_data["task_name"] = (
                schedule.task_name.strip()
            )

        if schedule.due_date is not None:
            update_data["due_date"] = (
                schedule.due_date.isoformat()
            )

        if schedule.due_odometer_km is not None:
            update_data["due_odometer_km"] = (
                schedule.due_odometer_km
            )

        if schedule.status is not None:
            update_data["status"] = schedule.status

        if not update_data:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields provided for update",
            )

        # -------------------------------------------------
        # UPDATE
        # -------------------------------------------------

        response = (
            supabase
            .table("maintenance_schedules")
            .update(update_data)
            .eq("id", str(schedule_id))
            .execute()
        )

        if not response.data:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Maintenance schedule could not be updated",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as exc:
        raise _handle_db_error(exc)


# =========================================================
# DELETE MAINTENANCE SCHEDULE
# =========================================================

@router.delete(
    "/{schedule_id}",
)
async def delete_maintenance_schedule(
    schedule_id: UUID,
    auth: AuthContext = Depends(verify_user),
):

    try:

        _authenticate_postgrest(auth.token)

        # -------------------------------------------------
        # CHECK OWNERSHIP
        # -------------------------------------------------

        existing = (
            supabase
            .table("maintenance_schedules")
            .select(
                "id, vehicles!inner(id, user_id)"
            )
            .eq("id", str(schedule_id))
            .eq(
                "vehicles.user_id",
                str(auth.user.id),
            )
            .maybe_single()
            .execute()
        )

        if not existing or not existing.data:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Maintenance schedule not found",
            )

        # -------------------------------------------------
        # DELETE
        # -------------------------------------------------

        response = (
            supabase
            .table("maintenance_schedules")
            .delete()
            .eq("id", str(schedule_id))
            .execute()
        )

        if not response.data:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Maintenance schedule could not be deleted",
            )

        return {
            "message": "Maintenance schedule deleted successfully",
            "schedule_id": str(schedule_id),
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise _handle_db_error(exc)
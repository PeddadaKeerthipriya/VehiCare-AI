import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.database import supabase
from app.middleware.auth import AuthContext, verify_user


router = APIRouter()


# =========================================================
# SCHEMAS
# =========================================================

class CustomIntervalCreate(BaseModel):
    vehicle_id: str
    component: str = Field(..., min_length=1)
    interval_km: int | None = Field(default=None, gt=0)
    interval_months: int | None = Field(default=None, gt=0)
    notes: str | None = None


# =========================================================
# POST /custom-intervals/
# =========================================================

@router.post("/")
async def create_custom_interval(
    interval: CustomIntervalCreate,
    auth: AuthContext = Depends(verify_user),
):
    if not auth or not auth.user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )

    user_id = str(auth.user.id)

    # -----------------------------------------------------
    # VALIDATE VEHICLE ID
    # -----------------------------------------------------

    try:
        vehicle_id = str(uuid.UUID(interval.vehicle_id))
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid vehicle_id",
        )

    # -----------------------------------------------------
    # VERIFY VEHICLE OWNERSHIP
    # -----------------------------------------------------

    try:
        vehicle_response = (
            supabase
            .table("vehicles")
            .select("id")
            .eq("id", vehicle_id)
            .eq("user_id", user_id)
            .execute()
        )

    except Exception as exc:
        print("[CUSTOM INTERVAL VEHICLE ERROR]", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to verify vehicle ownership",
        )

    if not vehicle_response.data:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found or does not belong to this user",
        )

    # -----------------------------------------------------
    # VALIDATE INTERVAL
    # -----------------------------------------------------

    if (
        interval.interval_km is None
        and interval.interval_months is None
    ):
        raise HTTPException(
            status_code=400,
            detail="At least one of interval_km or interval_months is required",
        )

    # -----------------------------------------------------
    # CONVERT MONTHS TO DAYS FOR DATABASE
    # -----------------------------------------------------

    interval_days = None

    if interval.interval_months is not None:
        interval_days = interval.interval_months * 30

    # -----------------------------------------------------
    # CREATE RECORD
    # -----------------------------------------------------

    custom_interval_id = str(uuid.uuid4())

    data = {
        "id": custom_interval_id,
        "vehicle_id": vehicle_id,
        "task_name": interval.component.strip(),
        "interval_km": interval.interval_km,
        "interval_days": interval_days,
        "notes": interval.notes,
    }

    try:
        response = (
            supabase
            .table("custom_intervals")
            .insert(data)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=500,
                detail="Custom interval was not created",
            )

    except HTTPException:
        raise

    except Exception as exc:
        print("[CUSTOM INTERVAL CREATE ERROR]", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to create custom interval",
        )

    created = response.data[0]

    return {
        "message": "Custom maintenance interval created successfully",
        "custom_interval": {
            "id": created["id"],
            "vehicle_id": created["vehicle_id"],
            "component": created["task_name"],
            "interval_km": created["interval_km"],
            "interval_months": (
                created["interval_days"] // 30
                if created["interval_days"] is not None
                else None
            ),
            "notes": created.get("notes"),
            "created_at": created.get("created_at"),
            "updated_at": created.get("updated_at"),
        },
    }


# =========================================================
# GET /custom-intervals/
# =========================================================

@router.get("/")
async def get_custom_intervals(
    auth: AuthContext = Depends(verify_user),
):
    if not auth or not auth.user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )

    user_id = str(auth.user.id)

    try:
        # -------------------------------------------------
        # GET USER VEHICLES
        # -------------------------------------------------

        vehicles_response = (
            supabase
            .table("vehicles")
            .select("id")
            .eq("user_id", user_id)
            .execute()
        )

        vehicles = vehicles_response.data or []

        if not vehicles:
            return []

        vehicle_ids = [
            vehicle["id"]
            for vehicle in vehicles
        ]

        # -------------------------------------------------
        # GET CUSTOM INTERVALS
        # -------------------------------------------------

        response = (
            supabase
            .table("custom_intervals")
            .select(
                """
                id,
                vehicle_id,
                task_name,
                interval_km,
                interval_days,
                notes,
                created_at,
                updated_at
                """
            )
            .in_("vehicle_id", vehicle_ids)
            .order("created_at", desc=True)
            .execute()
        )

        records = response.data or []

        # -------------------------------------------------
        # CONVERT DB FORMAT TO API FORMAT
        # -------------------------------------------------

        result = []

        for record in records:
            interval_days = record.get("interval_days")

            result.append({
                "id": record["id"],
                "vehicle_id": record["vehicle_id"],
                "component": record["task_name"],
                "interval_km": record["interval_km"],
                "interval_months": (
                    interval_days // 30
                    if interval_days is not None
                    else None
                ),
                "notes": record.get("notes"),
                "created_at": record.get("created_at"),
                "updated_at": record.get("updated_at"),
            })

        return result

    except Exception as exc:
        print("[CUSTOM INTERVAL GET ERROR]", repr(exc))

        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve custom intervals",
        )
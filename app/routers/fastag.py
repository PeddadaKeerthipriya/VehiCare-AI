from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.database import supabase
from app.middleware.auth import AuthContext, verify_user


router = APIRouter()


class FastagCreate(BaseModel):
    tag_id: str = Field(..., min_length=1, max_length=100)
    balance: Decimal = Field(default=0, ge=0)
    last_recharge_date: date | None = None
    status: str = "Active"


class FastagUpdate(BaseModel):
    tag_id: str = Field(..., min_length=1, max_length=100)
    balance: Decimal = Field(default=0, ge=0)
    last_recharge_date: date | None = None
    status: str = "Active"


ALLOWED_STATUSES = {
    "Active",
    "Inactive",
    "Blocked",
    "Low Balance",
}


def calculate_status(
    status: str,
    balance: Decimal,
) -> str:

    if status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid FASTag status. "
                "Allowed values: Active, Inactive, "
                "Blocked, Low Balance"
            ),
        )

    if balance < Decimal("100") and status == "Active":
        return "Low Balance"

    return status


def verify_vehicle_owner(
    vehicle_id: UUID,
    auth: AuthContext,
):
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
            status_code=404,
            detail="Vehicle not found",
        )


@router.post("/{vehicle_id}/fastag")
def create_fastag(
    vehicle_id: UUID,
    fastag: FastagCreate,
    auth: AuthContext = Depends(verify_user),
):
    try:
        verify_vehicle_owner(vehicle_id, auth)

        status = calculate_status(
            fastag.status,
            fastag.balance,
        )

        data = {
            "vehicle_id": str(vehicle_id),
            "tag_id": fastag.tag_id.strip(),
            "balance": float(fastag.balance),
            "last_recharge_date": (
                fastag.last_recharge_date.isoformat()
                if fastag.last_recharge_date
                else None
            ),
            "status": status,
        }

        response = (
            supabase
            .table("fastag_accounts")
            .insert(data)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=500,
                detail="FASTag creation failed",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as exc:
        print("[FASTAG CREATE ERROR]", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="FASTag creation failed",
        )


@router.get("/{vehicle_id}/fastag")
def get_vehicle_fastag(
    vehicle_id: UUID,
    auth: AuthContext = Depends(verify_user),
):
    try:
        verify_vehicle_owner(vehicle_id, auth)

        response = (
            supabase
            .table("fastag_accounts")
            .select("*")
            .eq("vehicle_id", str(vehicle_id))
            .order("created_at", desc=True)
            .execute()
        )

        return response.data or []

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch FASTag",
        )


@router.get("/fastag/{fastag_id}")
def get_fastag(
    fastag_id: UUID,
    auth: AuthContext = Depends(verify_user),
):
    try:
        response = (
            supabase
            .table("fastag_accounts")
            .select(
                "*, vehicles!inner(user_id)"
            )
            .eq("id", str(fastag_id))
            .eq("vehicles.user_id", str(auth.user.id))
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="FASTag record not found",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch FASTag",
        )


@router.put("/fastag/{fastag_id}")
def update_fastag(
    fastag_id: UUID,
    fastag: FastagUpdate,
    auth: AuthContext = Depends(verify_user),
):
    try:
        existing = (
            supabase
            .table("fastag_accounts")
            .select(
                "id, vehicles!inner(user_id)"
            )
            .eq("id", str(fastag_id))
            .eq("vehicles.user_id", str(auth.user.id))
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=404,
                detail="FASTag record not found",
            )

        status = calculate_status(
            fastag.status,
            fastag.balance,
        )

        update_data = {
            "tag_id": fastag.tag_id.strip(),
            "balance": float(fastag.balance),
            "last_recharge_date": (
                fastag.last_recharge_date.isoformat()
                if fastag.last_recharge_date
                else None
            ),
            "status": status,
            "updated_at": datetime.now(
                timezone.utc
            ).isoformat(),
        }

        response = (
            supabase
            .table("fastag_accounts")
            .update(update_data)
            .eq("id", str(fastag_id))
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="FASTag record not found",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="FASTag update failed",
        )


@router.delete("/fastag/{fastag_id}")
def delete_fastag(
    fastag_id: UUID,
    auth: AuthContext = Depends(verify_user),
):
    try:
        existing = (
            supabase
            .table("fastag_accounts")
            .select(
                "id, vehicles!inner(user_id)"
            )
            .eq("id", str(fastag_id))
            .eq("vehicles.user_id", str(auth.user.id))
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=404,
                detail="FASTag record not found",
            )

        supabase.table("fastag_accounts") \
            .delete() \
            .eq("id", str(fastag_id)) \
            .execute()

        return {
            "message": "FASTag deleted successfully",
            "fastag_id": str(fastag_id),
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="FASTag deletion failed",
        )
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.database import supabase
from app.middleware.auth import AuthContext, verify_user


router = APIRouter()


class PUCCreate(BaseModel):
    certificate_number: str = Field(..., min_length=1, max_length=100)
    issued_date: date
    expiry_date: date
    emission_details: str = Field(..., min_length=1)


class PUCUpdate(BaseModel):
    certificate_number: str = Field(..., min_length=1, max_length=100)
    issued_date: date
    expiry_date: date
    emission_details: str = Field(..., min_length=1)


def calculate_status(expiry_date: date) -> str:
    return "Expired" if expiry_date < date.today() else "Active"


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


@router.post("/{vehicle_id}/puc")
def create_puc(
    vehicle_id: UUID,
    puc: PUCCreate,
    auth: AuthContext = Depends(verify_user),
):
    try:
        verify_vehicle_owner(vehicle_id, auth)

        if puc.expiry_date < puc.issued_date:
            raise HTTPException(
                status_code=400,
                detail="expiry_date cannot be before issued_date",
            )

        data = {
            "vehicle_id": str(vehicle_id),
            "certificate_number": puc.certificate_number.strip(),
            "issued_date": puc.issued_date.isoformat(),
            "expiry_date": puc.expiry_date.isoformat(),
            "emission_details": puc.emission_details.strip(),
            "status": calculate_status(puc.expiry_date),
        }

        response = (
            supabase
            .table("puc_certificates")
            .insert(data)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=500,
                detail="PUC creation failed",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as exc:
        print("[PUC CREATE ERROR]", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="PUC creation failed",
        )


@router.get("/{vehicle_id}/puc")
def get_vehicle_puc(
    vehicle_id: UUID,
    auth: AuthContext = Depends(verify_user),
):
    try:
        verify_vehicle_owner(vehicle_id, auth)

        response = (
            supabase
            .table("puc_certificates")
            .select("*")
            .eq("vehicle_id", str(vehicle_id))
            .order("issued_date", desc=True)
            .execute()
        )

        return response.data or []

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch PUC records",
        )


@router.get("/puc/{puc_id}")
def get_puc(
    puc_id: UUID,
    auth: AuthContext = Depends(verify_user),
):
    try:
        response = (
            supabase
            .table("puc_certificates")
            .select(
                "*, vehicles!inner(user_id)"
            )
            .eq("id", str(puc_id))
            .eq("vehicles.user_id", str(auth.user.id))
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="PUC record not found",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as exc:
        print("[PUC GET ERROR]", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch PUC",
        )


@router.put("/puc/{puc_id}")
def update_puc(
    puc_id: UUID,
    puc: PUCUpdate,
    auth: AuthContext = Depends(verify_user),
):
    try:
        if puc.expiry_date < puc.issued_date:
            raise HTTPException(
                status_code=400,
                detail="expiry_date cannot be before issued_date",
            )

        existing = (
            supabase
            .table("puc_certificates")
            .select(
                "id, vehicles!inner(user_id)"
            )
            .eq("id", str(puc_id))
            .eq("vehicles.user_id", str(auth.user.id))
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=404,
                detail="PUC record not found",
            )

        update_data = {
            "certificate_number": puc.certificate_number.strip(),
            "issued_date": puc.issued_date.isoformat(),
            "expiry_date": puc.expiry_date.isoformat(),
            "emission_details": puc.emission_details.strip(),
            "status": calculate_status(puc.expiry_date),
        }

        response = (
            supabase
            .table("puc_certificates")
            .update(update_data)
            .eq("id", str(puc_id))
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="PUC record not found",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as exc:
        print("[PUC UPDATE ERROR]", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="PUC update failed",
        )


@router.delete("/puc/{puc_id}")
def delete_puc(
    puc_id: UUID,
    auth: AuthContext = Depends(verify_user),
):
    try:
        existing = (
            supabase
            .table("puc_certificates")
            .select(
                "id, vehicles!inner(user_id)"
            )
            .eq("id", str(puc_id))
            .eq("vehicles.user_id", str(auth.user.id))
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=404,
                detail="PUC record not found",
            )

        supabase.table("puc_certificates") \
            .delete() \
            .eq("id", str(puc_id)) \
            .execute()

        return {
            "message": "PUC deleted successfully",
            "puc_id": str(puc_id),
        }

    except HTTPException:
        raise

    except Exception as exc:
        print("[PUC DELETE ERROR]", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="PUC deletion failed",
        )
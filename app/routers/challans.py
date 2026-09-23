from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from postgrest.exceptions import APIError

from app.database import supabase
from app.middleware.auth import AuthContext, verify_user
from app.schemas.challan import (
    ChallanCreate,
    ChallanResponse,
    ChallanUpdate,
)


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/vehicles/{vehicle_id}/challans",
    tags=["Challans"],
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
    current_user: AuthContext,
) -> None:
    """
    Verify that the vehicle belongs to the authenticated user.
    """

    try:
        result = (
            supabase
            .table("vehicles")
            .select("id")
            .eq("id", str(vehicle_id))
            .eq("user_id", str(current_user.user.id))
            .maybe_single()
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehicle not found or does not belong to the current user",
            )

    except HTTPException:
        raise

    except Exception as exc:
        print("[CHALLAN VEHICLE OWNERSHIP ERROR]", repr(exc))

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify vehicle ownership: {str(exc)}",
        )


# =========================================================
# CREATE CHALLAN
# =========================================================

@router.post(
    "",
    response_model=ChallanResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_challan(
    vehicle_id: UUID,
    challan: ChallanCreate,
    current_user: AuthContext = Depends(verify_user),
):
    _authenticate_postgrest(current_user.token)

    _verify_vehicle_ownership(
        vehicle_id,
        current_user,
    )

    try:
        data = {
            "vehicle_id": str(vehicle_id),
            "challan_number": challan.challan_number,
            "challan_date": challan.challan_date.isoformat(),
            "amount": str(challan.amount),
            "reason": challan.reason,
            "status": challan.status,
            "payment_date": (
                challan.payment_date.isoformat()
                if challan.payment_date
                else None
            ),
        }

        result = (
            supabase
            .table("challans")
            .insert(data)
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create challan",
            )

        return result.data[0]

    except HTTPException:
        raise

    except APIError as exc:
        print("[CHALLAN CREATE API ERROR]", repr(exc))

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    except Exception as exc:
        print("[CHALLAN CREATE ERROR]", repr(exc))

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create challan: {str(exc)}",
        )


# =========================================================
# GET ALL CHALLANS
# =========================================================

@router.get(
    "",
    response_model=list[ChallanResponse],
)
async def get_challans(
    vehicle_id: UUID,
    current_user: AuthContext = Depends(verify_user),
):
    _authenticate_postgrest(current_user.token)

    _verify_vehicle_ownership(
        vehicle_id,
        current_user,
    )

    try:
        result = (
            supabase
            .table("challans")
            .select("*")
            .eq("vehicle_id", str(vehicle_id))
            .order("challan_date", desc=True)
            .execute()
        )

        return result.data or []

    except HTTPException:
        raise

    except APIError as exc:
        print("[CHALLAN GET API ERROR]", repr(exc))

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    except Exception as exc:
        print("[CHALLAN GET ERROR]", repr(exc))

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch challans: {str(exc)}",
        )


# =========================================================
# GET SINGLE CHALLAN
# =========================================================

@router.get(
    "/{challan_id}",
    response_model=ChallanResponse,
)
async def get_challan(
    vehicle_id: UUID,
    challan_id: UUID,
    current_user: AuthContext = Depends(verify_user),
):
    _authenticate_postgrest(current_user.token)

    _verify_vehicle_ownership(
        vehicle_id,
        current_user,
    )

    try:
        result = (
            supabase
            .table("challans")
            .select("*")
            .eq("id", str(challan_id))
            .eq("vehicle_id", str(vehicle_id))
            .maybe_single()
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Challan not found",
            )

        return result.data

    except HTTPException:
        raise

    except APIError as exc:
        print("[CHALLAN GET SINGLE API ERROR]", repr(exc))

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    except Exception as exc:
        print("[CHALLAN GET SINGLE ERROR]", repr(exc))

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch challan: {str(exc)}",
        )


# =========================================================
# UPDATE CHALLAN
# =========================================================

@router.patch(
    "/{challan_id}",
    response_model=ChallanResponse,
)
async def update_challan(
    vehicle_id: UUID,
    challan_id: UUID,
    challan: ChallanUpdate,
    current_user: AuthContext = Depends(verify_user),
):
    _authenticate_postgrest(current_user.token)

    _verify_vehicle_ownership(
        vehicle_id,
        current_user,
    )

    try:
        update_data = challan.model_dump(
            exclude_unset=True
        )

        # Convert challan_date to string
        if (
            "challan_date" in update_data
            and update_data["challan_date"] is not None
        ):
            update_data["challan_date"] = (
                update_data["challan_date"].isoformat()
            )

        # Convert payment_date to string
        if "payment_date" in update_data:
            if update_data["payment_date"] is not None:
                update_data["payment_date"] = (
                    update_data["payment_date"].isoformat()
                )

        # Convert amount to string
        if (
            "amount" in update_data
            and update_data["amount"] is not None
        ):
            update_data["amount"] = str(
                update_data["amount"]
            )

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields provided for update",
            )

        result = (
            supabase
            .table("challans")
            .update(update_data)
            .eq("id", str(challan_id))
            .eq("vehicle_id", str(vehicle_id))
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Challan not found",
            )

        return result.data[0]

    except HTTPException:
        raise

    except APIError as exc:
        print("[CHALLAN UPDATE API ERROR]", repr(exc))

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    except Exception as exc:
        print("[CHALLAN UPDATE ERROR]", repr(exc))

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update challan: {str(exc)}",
        )


# =========================================================
# DELETE CHALLAN
# =========================================================

@router.delete(
    "/{challan_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_challan(
    vehicle_id: UUID,
    challan_id: UUID,
    current_user: AuthContext = Depends(verify_user),
):
    _authenticate_postgrest(current_user.token)

    _verify_vehicle_ownership(
        vehicle_id,
        current_user,
    )

    try:
        result = (
            supabase
            .table("challans")
            .delete()
            .eq("id", str(challan_id))
            .eq("vehicle_id", str(vehicle_id))
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Challan not found",
            )

        return None

    except HTTPException:
        raise

    except APIError as exc:
        print("[CHALLAN DELETE API ERROR]", repr(exc))

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    except Exception as exc:
        print("[CHALLAN DELETE ERROR]", repr(exc))

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete challan: {str(exc)}",
        )
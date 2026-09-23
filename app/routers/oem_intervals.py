
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import supabase
from app.middleware.auth import AuthContext, verify_user
from app.schemas.oem_interval import (
    OEMIntervalCreate,
    OEMIntervalResponse,
    OEMIntervalUpdate,
)


router = APIRouter(
    prefix="/oem-intervals",
    tags=["OEM Intervals"],
)


# =========================================================
# CREATE OEM INTERVAL
# POST /oem-intervals/
# =========================================================

@router.post(
    "/",
    response_model=OEMIntervalResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_oem_interval(
    interval: OEMIntervalCreate,
    auth: AuthContext = Depends(verify_user),
):
    try:
        if not auth.user or not auth.user.id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authenticated user not found",
            )

        data = {
            "component": interval.component,
            "interval_km": interval.interval_km,
            "interval_months": interval.interval_months,
            "notes": interval.notes,
        }

        response = (
            supabase
            .table("oem_intervals")
            .insert(data)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create OEM interval",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create OEM interval: {str(e)}",
        )


# =========================================================
# GET ALL OEM INTERVALS
# GET /oem-intervals/
# =========================================================

@router.get(
    "/",
    response_model=list[OEMIntervalResponse],
)
def get_oem_intervals(
    auth: AuthContext = Depends(verify_user),
):
    try:
        if not auth.user or not auth.user.id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authenticated user not found",
            )

        response = (
            supabase
            .table("oem_intervals")
            .select("*")
            .order("component")
            .execute()
        )

        return response.data or []

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch OEM intervals: {str(e)}",
        )


# =========================================================
# GET SINGLE OEM INTERVAL
# GET /oem-intervals/{interval_id}
# =========================================================

@router.get(
    "/{interval_id}",
    response_model=OEMIntervalResponse,
)
def get_oem_interval(
    interval_id: UUID,
    auth: AuthContext = Depends(verify_user),
):
    try:
        if not auth.user or not auth.user.id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authenticated user not found",
            )

        response = (
            supabase
            .table("oem_intervals")
            .select("*")
            .eq("id", str(interval_id))
            .maybe_single()
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="OEM interval not found",
            )

        return response.data

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch OEM interval: {str(e)}",
        )


# =========================================================
# UPDATE OEM INTERVAL
# PUT /oem-intervals/{interval_id}
# =========================================================

@router.put(
    "/{interval_id}",
    response_model=OEMIntervalResponse,
)
def update_oem_interval(
    interval_id: UUID,
    interval: OEMIntervalUpdate,
    auth: AuthContext = Depends(verify_user),
):
    try:
        if not auth.user or not auth.user.id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authenticated user not found",
            )

        update_data = interval.model_dump(
            exclude_unset=True
        )

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields provided for update",
            )

        response = (
            supabase
            .table("oem_intervals")
            .update(update_data)
            .eq("id", str(interval_id))
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="OEM interval not found",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update OEM interval: {str(e)}",
        )


# =========================================================
# DELETE OEM INTERVAL
# DELETE /oem-intervals/{interval_id}
# =========================================================

@router.delete(
    "/{interval_id}",
)
def delete_oem_interval(
    interval_id: UUID,
    auth: AuthContext = Depends(verify_user),
):
    try:
        if not auth.user or not auth.user.id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authenticated user not found",
            )

        response = (
            supabase
            .table("oem_intervals")
            .delete()
            .eq("id", str(interval_id))
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="OEM interval not found",
            )

        return {
            "message": "OEM interval deleted successfully",
            "interval_id": str(interval_id),
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to delete OEM interval: {str(e)}",
        )

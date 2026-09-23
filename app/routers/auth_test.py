from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import supabase
from app.middleware.auth import AuthContext, verify_user


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


# =========================================================
# PROFILE RESPONSE SCHEMA
# =========================================================

class UserProfileResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    created_at: Optional[datetime] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_picture: Optional[str] = None


# =========================================================
# PROFILE UPDATE SCHEMA
# =========================================================

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_picture: Optional[str] = None


# =========================================================
# GET CURRENT USER PROFILE
# GET /auth/me
# =========================================================

@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Get current user profile",
)
async def get_current_user_info(
    auth: AuthContext = Depends(verify_user),
):
    try:
        user_id = str(auth.user.id)

        response = (
            supabase
            .table("users")
            .select(
                """
                id,
                email,
                full_name,
                created_at,
                phone,
                role,
                avatar_url,
                cover_picture
                """
            )
            .eq("id", user_id)
            .limit(1)
            .execute()
        )

        # -------------------------------------------------
        # USER PROFILE NOT FOUND
        # -------------------------------------------------

        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="User profile not found",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as exc:
        print("[USER PROFILE GET ERROR]", repr(exc))

        raise HTTPException(
            status_code=500,
            detail="Failed to fetch user profile",
        )


# =========================================================
# UPDATE CURRENT USER PROFILE
# PUT /auth/me
# =========================================================

@router.put(
    "/me",
    response_model=UserProfileResponse,
    summary="Update current user profile",
)
async def update_current_user_info(
    profile: UserProfileUpdate,
    auth: AuthContext = Depends(verify_user),
):
    try:
        user_id = str(auth.user.id)

        update_data = profile.model_dump(
            exclude_unset=True
        )

        # Remove None values so we don't unnecessarily
        # overwrite existing values with NULL
        update_data = {
            key: value
            for key, value in update_data.items()
            if value is not None
        }

        if not update_data:
            raise HTTPException(
                status_code=400,
                detail="No profile fields provided for update",
            )

        response = (
            supabase
            .table("users")
            .update(update_data)
            .eq("id", user_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="User profile not found",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as exc:
        print("[USER PROFILE UPDATE ERROR]", repr(exc))

        raise HTTPException(
            status_code=500,
            detail="Failed to update user profile",
        )
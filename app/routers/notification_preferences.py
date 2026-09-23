from fastapi import APIRouter, Depends, HTTPException

from app.database import supabase
from app.middleware.auth import AuthContext, verify_user
from app.schemas.notification_preferences import (
    NotificationPreferencesResponse,
    NotificationPreferencesUpdate,
)

router = APIRouter(
    prefix="/notifications/preferences",
    tags=["Notification Preferences"],
)


@router.get("", response_model=NotificationPreferencesResponse)
def get_notification_preferences(
    auth: AuthContext = Depends(verify_user),
):
    try:
        user_id = str(auth.user.id)

        response = (
            supabase.table("notification_preferences")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

        if response.data:
            return response.data

        # Create default preferences if the user has none
        default_preferences = {
            "user_id": user_id,
            "in_app_enabled": True,
            "email_enabled": False,
            "sms_enabled": False,
        }

        insert_response = (
            supabase.table("notification_preferences")
            .insert(default_preferences)
            .execute()
        )

        if not insert_response.data:
            raise HTTPException(
                status_code=500,
                detail="Failed to create default notification preferences",
            )

        return insert_response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch notification preferences: {str(e)}",
        )


@router.put("", response_model=NotificationPreferencesResponse)
def update_notification_preferences(
    preferences: NotificationPreferencesUpdate,
    auth: AuthContext = Depends(verify_user),
):
    try:
        user_id = str(auth.user.id)

        update_data = preferences.model_dump()

        response = (
            supabase.table("notification_preferences")
            .update(update_data)
            .eq("user_id", user_id)
            .execute()
        )

        if response.data:
            return response.data[0]

        # Create preferences if they don't exist
        insert_data = {
            "user_id": user_id,
            **update_data,
        }

        insert_response = (
            supabase.table("notification_preferences")
            .insert(insert_data)
            .execute()
        )

        if not insert_response.data:
            raise HTTPException(
                status_code=500,
                detail="Failed to create notification preferences",
            )

        return insert_response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update notification preferences: {str(e)}",
        )
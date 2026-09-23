from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import supabase
from app.middleware.auth import AuthContext, verify_user
from app.services.expiry_notifications import create_expired_compliance_notifications
from app.schemas.notification import (
    NotificationCreate,
    NotificationPreferencesResponse,
    NotificationPreferencesUpdate,
    NotificationResponse,
    NotificationUpdate,
)


router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
)


# =========================================================
# CREATE NOTIFICATION
# POST /notifications
# =========================================================

@router.post(
    "",
    response_model=NotificationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_notification(
    notification: NotificationCreate,
    auth: AuthContext = Depends(verify_user),
):
    try:
        user_id = str(auth.user.id)

        data = {
            "user_id": user_id,
            "schedule_id": (
                str(notification.schedule_id)
                if notification.schedule_id
                else None
            ),
            "channel": notification.channel,
            "message": notification.message,
            "notification_type": notification.notification_type,
            "reference_id": (
                str(notification.reference_id)
                if notification.reference_id
                else None
            ),
        }

        response = (
            supabase
            .table("notifications")
            .insert(data)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create notification",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create notification: {str(e)}",
        )


# =========================================================
# GET ALL USER NOTIFICATIONS
# GET /notifications
# =========================================================

@router.get(
    "",
    response_model=list[NotificationResponse],
)
def get_notifications(
    auth: AuthContext = Depends(verify_user),
):
    try:
        user_id = str(auth.user.id)

        # Generate forced in-app alerts for expired Insurance/PUC.
        create_expired_compliance_notifications(
    user_id=user_id,
    auth_token=auth.token,
)

        response = (
            supabase
            .table("notifications")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )

        return response.data or []

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch notifications: {str(e)}",
        )


# =========================================================
# GET NOTIFICATION PREFERENCES
# GET /notifications/preferences
# =========================================================

@router.get(
    "/preferences",
    response_model=NotificationPreferencesResponse,
)
def get_notification_preferences(
    auth: AuthContext = Depends(verify_user),
):
    try:
        user_id = str(auth.user.id)

        response = (
            supabase
            .table("notification_preferences")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )

        # If preferences do not exist, create default preferences.
        if not response.data:
            default_preferences = {
                "user_id": user_id,
                "in_app_enabled": True,
                "email_enabled": False,
                "sms_enabled": False,
            }

            insert_response = (
                supabase
                .table("notification_preferences")
                .insert(default_preferences)
                .execute()
            )

            if not insert_response.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create default notification preferences",
                )

            return insert_response.data[0]

        return response.data[0]

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch notification preferences: {str(e)}",
        )


# =========================================================
# UPDATE NOTIFICATION PREFERENCES
# PUT /notifications/preferences
# =========================================================

@router.put(
    "/preferences",
    response_model=NotificationPreferencesResponse,
)
def update_notification_preferences(
    preferences: NotificationPreferencesUpdate,
    auth: AuthContext = Depends(verify_user),
):
    try:
        user_id = str(auth.user.id)

        # In-app notifications are always enabled.
        # Only email and SMS are user-configurable.
        update_data = {
            "user_id": user_id,
            "in_app_enabled": True,
            "email_enabled": preferences.email_enabled,
            "sms_enabled": preferences.sms_enabled,
            "updated_at": datetime.now().isoformat(),
        }

        response = (
            supabase
            .table("notification_preferences")
            .upsert(
                update_data,
                on_conflict="user_id",
            )
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update notification preferences",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update notification preferences: {str(e)}",
        )


# =========================================================
# GET SINGLE NOTIFICATION
# GET /notifications/{notification_id}
# =========================================================

@router.get(
    "/{notification_id}",
    response_model=NotificationResponse,
)
def get_notification(
    notification_id: UUID,
    auth: AuthContext = Depends(verify_user),
):
    try:
        user_id = str(auth.user.id)

        response = (
            supabase
            .table("notifications")
            .select("*")
            .eq("id", str(notification_id))
            .eq("user_id", user_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch notification: {str(e)}",
        )


# =========================================================
# UPDATE NOTIFICATION
# PUT /notifications/{notification_id}
# =========================================================

@router.put(
    "/{notification_id}",
    response_model=NotificationResponse,
)
def update_notification(
    notification_id: UUID,
    notification: NotificationUpdate,
    auth: AuthContext = Depends(verify_user),
):
    try:
        user_id = str(auth.user.id)

        update_data = notification.model_dump(
            exclude_unset=True,
            mode="json",
        )

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields provided for update",
            )

        response = (
            supabase
            .table("notifications")
            .update(update_data)
            .eq("id", str(notification_id))
            .eq("user_id", user_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update notification: {str(e)}",
        )


# =========================================================
# DELETE NOTIFICATION
# DELETE /notifications/{notification_id}
# =========================================================

@router.delete(
    "/{notification_id}",
)
def delete_notification(
    notification_id: UUID,
    auth: AuthContext = Depends(verify_user),
):
    try:
        user_id = str(auth.user.id)

        response = (
            supabase
            .table("notifications")
            .delete()
            .eq("id", str(notification_id))
            .eq("user_id", user_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found",
            )

        return {
            "message": "Notification deleted successfully",
            "notification_id": str(notification_id),
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete notification: {str(e)}",
        )

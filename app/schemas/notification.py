from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


# =========================================================
# NOTIFICATION
# =========================================================

class NotificationCreate(BaseModel):
    schedule_id: UUID | None = None
    channel: str | None = None
    message: str | None = None
    notification_type: str
    reference_id: UUID | None = None


class NotificationUpdate(BaseModel):
    channel: str | None = None
    message: str | None = None
    delivery_status: str | None = None
    sent_at: datetime | None = None


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID | None
    schedule_id: UUID | None
    channel: str | None
    message: str | None
    sent_at: datetime | None
    delivery_status: str | None
    notification_type: str | None
    reference_id: UUID | None
    created_at: datetime


# =========================================================
# NOTIFICATION PREFERENCES
# =========================================================

class NotificationPreferencesUpdate(BaseModel):
    in_app_enabled: bool
    email_enabled: bool
    sms_enabled: bool


class NotificationPreferencesResponse(BaseModel):
    user_id: UUID
    in_app_enabled: bool
    email_enabled: bool
    sms_enabled: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


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
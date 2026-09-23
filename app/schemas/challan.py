from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class ChallanCreate(BaseModel):
    challan_number: str = Field(..., min_length=1)
    challan_date: date
    amount: Decimal = Field(..., ge=0)
    reason: str
    status: str = "unpaid"
    payment_date: date | None = None


class ChallanUpdate(BaseModel):
    challan_number: str | None = Field(default=None, min_length=1)
    challan_date: date | None = None
    amount: Decimal | None = Field(default=None, ge=0)
    reason: str | None = None
    status: str | None = None
    payment_date: date | None = None


class ChallanResponse(BaseModel):
    id: UUID
    vehicle_id: UUID
    challan_number: str
    challan_date: date
    amount: Decimal
    reason: str
    status: str
    payment_date: date | None = None
    created_at: datetime
    updated_at: datetime
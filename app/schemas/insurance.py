
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class InsuranceResponse(BaseModel):
    id: UUID
    vehicle_id: UUID
    insurer: str
    policy_number: str
    start_date: date
    expiry_date: date
    document_url: Optional[str] = None
    created_at: Optional[datetime] = None
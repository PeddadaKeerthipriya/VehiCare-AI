from uuid import UUID

from pydantic import BaseModel


class OEMIntervalCreate(BaseModel):
    component: str
    interval_km: int
    interval_months: int
    notes: str | None = None


class OEMIntervalUpdate(BaseModel):
    component: str | None = None
    interval_km: int | None = None
    interval_months: int | None = None
    notes: str | None = None


class OEMIntervalResponse(BaseModel):
    id: UUID
    component: str
    interval_km: int
    interval_months: int
    notes: str | None = None
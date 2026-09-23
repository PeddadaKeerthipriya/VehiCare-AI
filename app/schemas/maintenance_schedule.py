from datetime import date
from uuid import UUID

from pydantic import BaseModel


class MaintenanceScheduleCreate(BaseModel):
    vehicle_id: UUID
    task_name: str | None = None
    due_date: date | None = None
    due_odometer_km: int | None = None
    status: str = "pending"


class MaintenanceScheduleUpdate(BaseModel):
    task_name: str | None = None
    due_date: date | None = None
    due_odometer_km: int | None = None
    status: str | None = None


class MaintenanceScheduleResponse(BaseModel):
    id: UUID
    vehicle_id: UUID | None
    task_name: str | None
    due_date: date | None
    due_odometer_km: int | None
    status: str | None
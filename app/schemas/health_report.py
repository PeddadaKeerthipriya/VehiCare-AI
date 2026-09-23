"""
Pydantic Schemas for Vehicle Health Reporter Pipeline
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class HealthStatusEnum(str, Enum):
    EXCELLENT = "Excellent"
    GOOD = "Good"
    FAIR = "Fair"
    CRITICAL = "Critical"


class VehicleHealthReportLLMResponse(BaseModel):
    health_score: int = Field(
        ...,
        ge=0,
        le=100,
        description="Overall vehicle health score from 0 to 100",
    )
    status: HealthStatusEnum = Field(
        ...,
        description="Vehicle condition status",
    )
    summary: str = Field(
        ...,
        min_length=10,
        description="Concise professional summary of vehicle operational state",
    )
    key_concerns: List[str] = Field(
        default_factory=list,
        description="List of primary concerns or risks detected",
    )
    recommended_actions: List[str] = Field(
        default_factory=list,
        description="Prioritized actionable maintenance or diagnostic recommendations",
    )
    confidence_notes: Optional[str] = Field(
        default=None,
        description="Optional diagnostic or data-completeness observations",
    )

    @field_validator("health_score", mode="before")
    @classmethod
    def coerce_health_score(cls, v):
        try:
            val = int(v)
            return max(0, min(100, val))
        except (ValueError, TypeError):
            return 75

    @field_validator("status", mode="before")
    @classmethod
    def coerce_status(cls, v):
        if not v:
            return HealthStatusEnum.GOOD
        s = str(v).strip().capitalize()
        if s in ("Excellent", "Good", "Fair", "Critical"):
            return HealthStatusEnum(s)
        return HealthStatusEnum.GOOD


class VehicleHealthReportResponseSchema(BaseModel):
    success: bool = True
    vehicle_id: Optional[str] = None
    health_score: int
    status: str
    summary: str
    key_concerns: List[str] = Field(default_factory=list)
    recommended_actions: List[str] = Field(default_factory=list)
    generated_at: Optional[datetime] = None

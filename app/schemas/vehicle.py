import re
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


VIN_PATTERN = re.compile(
    r"^[A-HJ-NPR-Z0-9]{17}$"
)


class VehicleBase(BaseModel):
    make: str = Field(
        ...,
        min_length=1,
        max_length=100,
    )

    model: str = Field(
        ...,
        min_length=1,
        max_length=100,
    )

    year: int = Field(
        ...,
        ge=1900,
        le=2100,
    )

    vin: str = Field(
        ...,
        min_length=17,
        max_length=17,
    )

    odometer_km: int = Field(
        ...,
        ge=0,
    )

    vehicle_type: Literal["Car", "Bike"] = "Car"

    @field_validator("vin")
    @classmethod
    def validate_vin(cls, value: str) -> str:
        value = value.strip().upper()

        if len(value) != 17:
            raise ValueError(
                "VIN must be exactly 17 characters long"
            )

        if not VIN_PATTERN.fullmatch(value):
            raise ValueError(
                "VIN must contain only letters and digits "
                "and must not contain I, O, or Q"
            )

        return value

    @field_validator("make", "model")
    @classmethod
    def strip_text_fields(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError(
                "This field cannot be empty"
            )

        return value


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(VehicleBase):
    pass


class VehicleResponse(VehicleBase):
    id: UUID
    user_id: UUID

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {
        "from_attributes": True
    }
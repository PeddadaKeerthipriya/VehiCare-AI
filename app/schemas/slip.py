from typing import List, Optional, Union
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
import re


class ServiceItemSchema(BaseModel):
    description: str = Field(..., description="Description of the service performed")
    cost: Optional[float] = Field(None, description="Cost of the service item if available")


class PartItemSchema(BaseModel):
    part_name: str = Field(..., description="Name of the part")
    part_number: Optional[str] = Field(None, description="Part number or code if available")
    cost: Optional[float] = Field(None, description="Cost of the part if available")


class ServiceSlipExtractionSchema(BaseModel):
    service_date: Optional[str] = Field(
        None,
        description="Service date in YYYY-MM-DD format or null if missing/illegible"
    )
    mileage: Optional[int] = Field(
        None,
        description="Vehicle odometer/mileage reading at service as an integer or null"
    )
    service_type: Optional[str] = Field(
        None,
        description="General classification of service (e.g., Scheduled Maintenance, Repair, Oil Change)"
    )
    cost: Optional[float] = Field(
        None,
        description="Total cost/amount on the service slip as a float or null"
    )
    service_items: List[Union[ServiceItemSchema, str]] = Field(
        default_factory=list,
        description="List of individual service items or labor tasks"
    )
    parts: List[Union[PartItemSchema, str]] = Field(
        default_factory=list,
        description="List of parts replaced or used"
    )
    notes: Optional[str] = Field(
        None,
        description="Summary of work done or additional observations"
    )
    confidence_notes: Optional[str] = Field(
        None,
        description="Notes regarding OCR quality, unclear text, or uncertainties"
    )

    @field_validator("service_date", mode="before")
    @classmethod
    def normalize_date(cls, value: Optional[str]) -> Optional[str]:
        if not value or not isinstance(value, str) or value.lower() in ["null", "none", "unknown", "n/a", ""]:
            return None
        cleaned = value.strip()
        formats = [
            "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y",
            "%Y/%m/%d", "%b %d, %Y", "%B %d, %Y", "%d %b %Y"
        ]
        for fmt in formats:
            try:
                dt = datetime.strptime(cleaned, fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue
        iso_match = re.search(r"\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b", cleaned)
        if iso_match:
            y, m, d = iso_match.groups()
            return f"{y}-{int(m):02d}-{int(d):02d}"
        return value

    @field_validator("cost", mode="before")
    @classmethod
    def normalize_cost(cls, value: Optional[Union[float, int, str]]) -> Optional[float]:
        if value is None:
            return None
        if isinstance(value, (float, int)):
            return float(value)
        if isinstance(value, str):
            cleaned = re.sub(r"[^\d.]", "", value)
            try:
                return float(cleaned) if cleaned else None
            except ValueError:
                return None
        return None

    @field_validator("mileage", mode="before")
    @classmethod
    def normalize_mileage(cls, value: Optional[Union[int, float, str]]) -> Optional[int]:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return int(value)
        if isinstance(value, str):
            cleaned = re.sub(r"[^\d]", "", value)
            try:
                return int(cleaned) if cleaned else None
            except ValueError:
                return None
        return None

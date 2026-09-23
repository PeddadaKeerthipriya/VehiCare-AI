from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

DEFAULT_MECHANIC_DISCLAIMER = (
    "DISCLAIMER: This AI-generated fault diagnosis is an automated assessment based on reported symptoms and vehicle service history. "
    "It does not replace a physical inspection by a certified professional automotive mechanic. Always consult a qualified technician before performing repairs."
)


class SeverityEnum(str, Enum):
    CRITICAL = "Critical"
    WARNING = "Warning"
    ADVISORY = "Advisory"


# =========================================================
# AI DIAGNOSIS REQUEST
# =========================================================

class DiagnosisRequestSchema(BaseModel):
    vehicle_id: UUID

    symptom: str = Field(
        ...,
        min_length=3,
        max_length=1000,
        description="Description of the vehicle problem",
    )


# =========================================================
# FAULT DIAGNOSIS RESPONSE
# Matches public.fault_diagnoses
# =========================================================

class FaultDiagnosisResponse(BaseModel):
    id: UUID
    vehicle_id: UUID
    symptom: Optional[str] = None
    possible_cause: Optional[str] = None
    recommended_action: Optional[str] = None
    severity: Optional[str] = None
    confidence_score: Optional[float] = None
    mechanic_required: bool = False
    created_at: Optional[datetime] = None


# =========================================================
# LLM DIAGNOSIS RESPONSE (Internal Pipeline Validation)
# =========================================================

class DiagnosisLLMResponse(BaseModel):
    severity: str = Field(..., description="Diagnosis severity: Critical, Warning, or Advisory")
    possible_cause: str = Field(..., description="Detailed explanation of potential fault cause")
    recommended_action: str = Field(..., description="Actionable recommended steps for vehicle owner")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Confidence score from 0.0 to 1.0")
    mechanic_required: bool = Field(..., description="True if professional mechanic inspection is required")
    mechanic_disclaimer: str = Field(
        default=DEFAULT_MECHANIC_DISCLAIMER,
        description="Persistent safety disclaimer regarding AI automated diagnosis"
    )
    confidence_notes: Optional[str] = Field(None, description="Notes on uncertainties or missing context")

    def apply_safety_rules(self) -> "DiagnosisLLMResponse":
        if self.confidence_score < 0.6:
            self.severity = SeverityEnum.ADVISORY.value
            if not self.confidence_notes:
                self.confidence_notes = "Confidence score below threshold (0.6); downgraded to Advisory."
        if not self.mechanic_disclaimer:
            self.mechanic_disclaimer = DEFAULT_MECHANIC_DISCLAIMER
        return self


# =========================================================
# AI DIAGNOSIS API RESPONSE
# =========================================================

class DiagnosisResponseSchema(BaseModel):
    success: bool
    message: str
    diagnosis: FaultDiagnosisResponse


# =========================================================
# CREATE DIAGNOSIS
# =========================================================

class DiagnosisCreate(BaseModel):
    vehicle_id: UUID

    symptom: str = Field(
        ...,
        min_length=3,
        max_length=1000,
    )

    possible_cause: Optional[str] = None
    recommended_action: Optional[str] = None
    severity: Optional[str] = None

    confidence_score: Optional[float] = Field(
        default=None,
        ge=0,
        le=1,
    )

    mechanic_required: bool = False


# =========================================================
# UPDATE DIAGNOSIS
# =========================================================

class DiagnosisUpdate(BaseModel):
    symptom: Optional[str] = Field(
        default=None,
        min_length=3,
        max_length=1000,
    )

    possible_cause: Optional[str] = None
    recommended_action: Optional[str] = None
    severity: Optional[str] = None

    confidence_score: Optional[float] = Field(
        default=None,
        ge=0,
        le=1,
    )

    mechanic_required: Optional[bool] = None


# =========================================================
# GENERAL DIAGNOSIS RESPONSE
# =========================================================

class DiagnosisResponse(BaseModel):
    id: UUID
    vehicle_id: UUID

    symptom: Optional[str] = None
    possible_cause: Optional[str] = None
    recommended_action: Optional[str] = None
    severity: Optional[str] = None
    confidence_score: Optional[float] = None
    mechanic_required: bool = False
    created_at: Optional[datetime] = None

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


# =========================================================
# ROUTER IMPORTS
# =========================================================

from app.routers.vehicles import router as vehicle_router
from app.routers.custom_intervals import router as custom_intervals_router
from app.routers.slips import router as slips_router
from app.routers.services import router as services_router
from app.routers.diagnose import router as diagnose_router
from app.routers.diagnoses import router as diagnoses_router
from app.routers.insurance import router as insurance_router
from app.routers.puc import router as puc_router
from app.routers.auth_test import router as auth_router
from app.routers.fastag import router as fastag_router
from app.routers.ocr import router as ocr_router
from app.routers.challans import router as challans_router
from app.routers.notifications import router as notifications_router
from app.routers.dashboard import router as dashboard_router
from app.routers import notification_preferences
from app.routers.maintenance_schedules import (
    router as maintenance_schedules_router,
)
from app.routers.oem_intervals import (
    router as oem_intervals_router,
)


# =========================================================
# FASTAPI APPLICATION
# =========================================================

app = FastAPI(
    title="VehiCare API",
    description="Backend API for VehiCare AI Vehicle Management System",
    version="1.0.0",
)


# =========================================================
# CORS CONFIGURATION
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# VEHICLES
# =========================================================

app.include_router(
    vehicle_router,
)


# =========================================================
# SERVICE SLIPS
# =========================================================

app.include_router(
    slips_router,
    prefix="/slips",
    tags=["Service Slips"],
)


# =========================================================
# SERVICES
# =========================================================

app.include_router(
    services_router,
    prefix="/services",
    tags=["Services"],
)


# =========================================================
# AI DIAGNOSIS
# =========================================================

app.include_router(
    diagnose_router,
    prefix="/diagnosis",
    tags=["Diagnosis"],
)


# =========================================================
# DIAGNOSIS HISTORY
# =========================================================

app.include_router(
    diagnoses_router,
)


# =========================================================
# INSURANCE
# =========================================================

app.include_router(
    insurance_router,
    prefix="/vehicles",
    tags=["Insurance"],
)


# =========================================================
# PUC
# =========================================================

app.include_router(
    puc_router,
    prefix="/vehicles",
    tags=["PUC"],
)


# =========================================================
# FASTAG
# =========================================================

app.include_router(
    fastag_router,
    prefix="/vehicles",
    tags=["FASTag"],
)


# =========================================================
# OCR
# =========================================================

app.include_router(
    ocr_router,
    tags=["OCR"],
)


# =========================================================
# CHALLANS
# =========================================================

app.include_router(
    challans_router,
)


# =========================================================
# NOTIFICATION PREFERENCES
# =========================================================

app.include_router(
    notification_preferences.router,
)


# =========================================================
# NOTIFICATIONS
# =========================================================

app.include_router(
    notifications_router,
)


# =========================================================
# MAINTENANCE SCHEDULES
# =========================================================

app.include_router(
    maintenance_schedules_router,
)


# =========================================================
# OEM INTERVALS
# =========================================================

app.include_router(
    oem_intervals_router,
)


# =========================================================
# AUTHENTICATION / PROFILE
# =========================================================

app.include_router(
    auth_router,
)


# =========================================================
# DASHBOARD
# =========================================================

app.include_router(
    dashboard_router,
)


# =========================================================
# CUSTOM MAINTENANCE INTERVALS
# =========================================================

app.include_router(
    custom_intervals_router,
    prefix="/custom-intervals",
    tags=["Custom Maintenance Intervals"],
)


# =========================================================
# HOME
# =========================================================

@app.get("/")
def home():
    return {
        "message": "Welcome to VehiCare API",
        "version": "1.0.0",
        "status": "running",
    }


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/health")
def health():
    return {
        "status": "healthy",
    }
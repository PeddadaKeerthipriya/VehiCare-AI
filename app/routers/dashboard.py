from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.database import supabase
from app.middleware.auth import AuthContext, verify_user
from app.schemas.dashboard import DashboardResponse


router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
)


@router.get("/", response_model=DashboardResponse)
async def get_dashboard(
    auth: AuthContext = Depends(verify_user),
):
    if not auth or not auth.user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )

    user_id = str(auth.user.id)

    try:
        # -----------------------------------------------------
        # USER VEHICLES
        # -----------------------------------------------------

        vehicles_response = (
            supabase
            .table("vehicles")
            .select(
                "id, make, model, year, vehicle_type, odometer_km"
            )
            .eq("user_id", user_id)
            .order("model")
            .execute()
        )

        vehicles = vehicles_response.data or []

        if not vehicles:
            return {
                "health_summary": {
                    "total_vehicles": 0,
                    "maintenance_due": 0,
                    "maintenance_overdue": 0,
                    "critical_diagnoses": 0,
                },
                "vehicles": [],
                "recent_activity": [],
                "timeline_90_days": [],
            }

        vehicle_ids = [
            vehicle["id"]
            for vehicle in vehicles
        ]

        # -----------------------------------------------------
        # MAINTENANCE
        # -----------------------------------------------------

        maintenance_response = (
            supabase
            .table("maintenance_schedules")
            .select(
                "id, vehicle_id, task_name, due_date, "
                "due_odometer_km, status, notified_at"
            )
            .in_("vehicle_id", vehicle_ids)
            .execute()
        )

        maintenance = maintenance_response.data or []

        maintenance_due = sum(
            1
            for item in maintenance
            if item.get("status") == "due_soon"
        )

        maintenance_overdue = sum(
            1
            for item in maintenance
            if item.get("status") == "overdue"
        )

        # -----------------------------------------------------
        # DIAGNOSES
        # -----------------------------------------------------

        diagnosis_response = (
            supabase
            .table("fault_diagnoses")
            .select(
                "id, vehicle_id, symptom, possible_cause, "
                "severity, confidence_score, "
                "mechanic_required, created_at"
            )
            .in_("vehicle_id", vehicle_ids)
            .order("created_at", desc=True)
            .execute()
        )

        diagnoses = diagnosis_response.data or []

        critical_diagnoses = sum(
            1
            for diagnosis in diagnoses
            if str(diagnosis.get("severity", "")).lower()
            == "critical"
        )

        # -----------------------------------------------------
        # RECENT SERVICE RECORDS
        # -----------------------------------------------------

        service_response = (
            supabase
            .table("service_records")
            .select(
                "id, vehicle_id, service_date, "
                "service_type, notes, created_at"
            )
            .in_("vehicle_id", vehicle_ids)
            .order("service_date", desc=True)
            .limit(10)
            .execute()
        )

        services = service_response.data or []

        # -----------------------------------------------------
        # 90-DAY TIMELINE
        # -----------------------------------------------------

        cutoff_date = (
            datetime.now(timezone.utc) - timedelta(days=90)
        ).date().isoformat()

        timeline_response = (
            supabase
            .table("service_records")
            .select(
                "id, vehicle_id, service_date, "
                "service_type, notes, created_at"
            )
            .in_("vehicle_id", vehicle_ids)
            .gte("service_date", cutoff_date)
            .order("service_date", desc=True)
            .execute()
        )

        timeline_services = (
            timeline_response.data or []
        )

        # -----------------------------------------------------
        # VEHICLE MAP
        # -----------------------------------------------------

        vehicle_map = {
            vehicle["id"]: vehicle
            for vehicle in vehicles
        }

        # -----------------------------------------------------
        # RECENT ACTIVITY
        # -----------------------------------------------------

        recent_activity: list[dict[str, Any]] = []

        for service in services:
            vehicle = vehicle_map.get(
                service["vehicle_id"]
            )

            recent_activity.append({
                "type": "service",
                "id": service["id"],
                "vehicle_id": service["vehicle_id"],
                "vehicle": (
                    f"{vehicle.get('make', '')} "
                    f"{vehicle.get('model', '')}"
                    if vehicle
                    else None
                ),
                "date": service.get("service_date"),
                "title": service.get("service_type"),
                "description": service.get("notes"),
            })

        for diagnosis in diagnoses[:10]:
            vehicle = vehicle_map.get(
                diagnosis["vehicle_id"]
            )

            recent_activity.append({
                "type": "diagnosis",
                "id": diagnosis["id"],
                "vehicle_id": diagnosis["vehicle_id"],
                "vehicle": (
                    f"{vehicle.get('make', '')} "
                    f"{vehicle.get('model', '')}"
                    if vehicle
                    else None
                ),
                "date": diagnosis.get("created_at"),
                "title": "Vehicle diagnosis",
                "description": diagnosis.get("symptom"),
                "severity": diagnosis.get("severity"),
            })

        # Newest activity first
        recent_activity.sort(
            key=lambda item: item.get("date") or "",
            reverse=True,
        )

        recent_activity = recent_activity[:20]

        # -----------------------------------------------------
        # 90-DAY TIMELINE
        # -----------------------------------------------------

        timeline_90_days = []

        for service in timeline_services:
            vehicle = vehicle_map.get(
                service["vehicle_id"]
            )

            timeline_90_days.append({
                "type": "service",
                "id": service["id"],
                "vehicle_id": service["vehicle_id"],
                "vehicle": (
                    f"{vehicle.get('make', '')} "
                    f"{vehicle.get('model', '')}"
                    if vehicle
                    else None
                ),
                "date": service.get("service_date"),
                "title": service.get("service_type"),
                "description": service.get("notes"),
            })

        # -----------------------------------------------------
        # RESPONSE
        # -----------------------------------------------------

        return {
            "health_summary": {
                "total_vehicles": len(vehicles),
                "maintenance_due": maintenance_due,
                "maintenance_overdue": maintenance_overdue,
                "critical_diagnoses": critical_diagnoses,
            },
            "vehicles": vehicles,
            "recent_activity": recent_activity,
            "timeline_90_days": timeline_90_days,
        }

    except HTTPException:
        raise

    except Exception as exc:
        print(
            "[DASHBOARD ERROR]",
            repr(exc),
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to load dashboard",
        )
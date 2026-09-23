import uuid
import httpx
import math
import asyncio

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.database import supabase
from app.middleware.auth import (
    AuthContext,
    verify_user,
)


router = APIRouter()


# =========================================================
# SERVICE CENTER CACHE
# =========================================================

SERVICE_CENTER_CACHE_TTL_MINUTES = 60


# =========================================================
# SCHEMAS
# =========================================================

class ServiceCreate(BaseModel):
    vehicle_id: str
    service_date: str
    service_type: str = Field(..., min_length=1)
    notes: Optional[str] = None
    slip_id: Optional[str] = None


# =========================================================
# DISTANCE CALCULATION
# =========================================================

def calculate_distance_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> float:
    """
    Calculate distance between two coordinates
    using the Haversine formula.
    """

    earth_radius_km = 6371.0

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)

    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_rad)
        * math.cos(lat2_rad)
        * math.sin(delta_lon / 2) ** 2
    )

    c = 2 * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a),
    )

    return round(
        earth_radius_km * c,
        2,
    )


# =========================================================
# PREDICTOR
# =========================================================

def trigger_predictor_rerun(
    vehicle_id: str,
    service_record_id: str,
):
    """
    Placeholder for maintenance prediction integration.

    Maintenance schedule recalculation is already handled
    by the database trigger after a service record is inserted.
    """

    print("PREDICTOR RE-RUN TRIGGERED")
    print("VEHICLE ID:", vehicle_id)
    print("SERVICE RECORD ID:", service_record_id)

    return {
        "triggered": True,
        "vehicle_id": vehicle_id,
        "service_record_id": service_record_id,
    }


# =========================================================
# CREATE SERVICE
# POST /services/
# =========================================================

@router.post("/")
async def create_service(
    service: ServiceCreate,
    auth: AuthContext = Depends(verify_user),
):
    if not auth or not auth.user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )

    user_id = str(auth.user.id)

    # -----------------------------------------------------
    # VALIDATE VEHICLE ID
    # -----------------------------------------------------

    try:
        vehicle_id = str(
            uuid.UUID(service.vehicle_id)
        )

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid vehicle_id",
        )

    # -----------------------------------------------------
    # VERIFY VEHICLE OWNERSHIP
    # -----------------------------------------------------

    try:
        vehicle_response = (
            supabase
            .table("vehicles")
            .select("id")
            .eq("id", vehicle_id)
            .eq("user_id", user_id)
            .execute()
        )

    except Exception as exc:
        print(
            "[VEHICLE OWNERSHIP ERROR]",
            repr(exc),
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to verify vehicle ownership",
        )

    if not vehicle_response.data:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found or does not belong to this user",
        )

    # -----------------------------------------------------
    # CREATE SERVICE RECORD
    # -----------------------------------------------------

    service_record_id = str(uuid.uuid4())

    service_data = {
        "id": service_record_id,
        "vehicle_id": vehicle_id,
        "service_date": service.service_date,
        "service_type": service.service_type.strip(),
        "notes": service.notes,
        "user_id": user_id,
    }

    try:
        response = (
            supabase
            .table("service_records")
            .insert(service_data)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=500,
                detail="Service record was not created",
            )

    except HTTPException:
        raise

    except Exception as exc:
        print(
            "[SERVICE CREATE ERROR]",
            repr(exc),
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to create service record",
        )

    # -----------------------------------------------------
    # PREDICTOR
    # -----------------------------------------------------

    predictor_result = trigger_predictor_rerun(
        vehicle_id,
        service_record_id,
    )

    # -----------------------------------------------------
    # LINK SERVICE SLIP
    # -----------------------------------------------------

    if service.slip_id:

        try:
            slip_id = str(
                uuid.UUID(service.slip_id)
            )

        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid slip_id",
            )

        # -------------------------------------------------
        # VERIFY SLIP OWNERSHIP
        # -------------------------------------------------

        try:
            slip_response = (
                supabase
                .table("service_slips")
                .select("id")
                .eq("id", slip_id)
                .eq("user_id", user_id)
                .execute()
            )

        except Exception as exc:
            print(
                "[SLIP VERIFY ERROR]",
                repr(exc),
            )

            raise HTTPException(
                status_code=500,
                detail="Failed to verify service slip",
            )

        if not slip_response.data:
            raise HTTPException(
                status_code=404,
                detail="Service slip not found",
            )

        # -------------------------------------------------
        # LINK SLIP
        # -------------------------------------------------

        try:
            (
                supabase
                .table("service_slips")
                .update({
                    "service_record_id": service_record_id,
                    "status": "Confirmed",
                })
                .eq("id", slip_id)
                .eq("user_id", user_id)
                .execute()
            )

        except Exception as exc:
            print(
                "[SLIP LINK ERROR]",
                repr(exc),
            )

            raise HTTPException(
                status_code=500,
                detail="Failed to link service slip",
            )

    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return {
        "message": "Service record created successfully",
        "service_record_id": service_record_id,
        "vehicle_id": vehicle_id,
        "slip_id": service.slip_id,
        "status": (
            "Confirmed"
            if service.slip_id
            else "Created"
        ),
        "predictor": predictor_result,
    }


# =========================================================
# NEARBY SERVICE CENTERS
# GET /services/nearby
#
# OpenStreetMap + Overpass API
# 1-hour TTL cache
# No Google API key required for service-center search.
# =========================================================

@router.get("/nearby")
async def get_nearby_service_centers(
    lat: float = Query(
        ...,
        description="Latitude",
    ),
    lng: float = Query(
        ...,
        description="Longitude",
    ),
    radius: int = Query(
        5000,
        ge=100,
        le=50000,
        description="Search radius in meters",
    ),
    auth: AuthContext = Depends(verify_user),
):
    """
    Find nearby vehicle service centers using
    OpenStreetMap Overpass API with 1-hour caching.
    """

    # -----------------------------------------------------
    # AUTHENTICATION
    # -----------------------------------------------------

    if not auth or not auth.user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )

    # -----------------------------------------------------
    # VALIDATE COORDINATES
    # -----------------------------------------------------

    if not -90 <= lat <= 90:
        raise HTTPException(
            status_code=400,
            detail="Invalid latitude",
        )

    if not -180 <= lng <= 180:
        raise HTTPException(
            status_code=400,
            detail="Invalid longitude",
        )

    # -----------------------------------------------------
    # CACHE KEY
    #
    # Coordinates are rounded to 4 decimal places so
    # small GPS variations don't create unnecessary
    # cache misses.
    # -----------------------------------------------------

    cache_lat = round(lat, 4)
    cache_lng = round(lng, 4)

    # -----------------------------------------------------
    # CACHE CUTOFF
    #
    # Cache is valid for 60 minutes.
    # -----------------------------------------------------

    cache_cutoff = (
        datetime.utcnow()
        - timedelta(
            minutes=SERVICE_CENTER_CACHE_TTL_MINUTES
        )
    ).isoformat()

    # -----------------------------------------------------
    # CHECK CACHE
    # -----------------------------------------------------

    try:

        cached_response = (
            supabase
            .table("service_center_cache")
            .select(
                """
                place_id,
                name,
                rating,
                lat,
                lng,
                radius,
                fetched_at
                """
            )
            .eq(
                "search_lat",
                cache_lat,
            )
            .eq(
                "search_lng",
                cache_lng,
            )
            .eq(
                "radius",
                radius,
            )
            .gte(
                "fetched_at",
                cache_cutoff,
            )
            .execute()
        )

        cached_centers = (
            cached_response.data or []
        )

        # -------------------------------------------------
        # CACHE HIT
        # -------------------------------------------------

        if cached_centers:

            service_centers = []

            for center in cached_centers:

                center_lat = center.get(
                    "lat"
                )

                center_lng = center.get(
                    "lng"
                )

                if (
                    center_lat is None
                    or center_lng is None
                ):
                    continue

                distance_km = calculate_distance_km(
                    lat,
                    lng,
                    center_lat,
                    center_lng,
                )

                directions_url = (
                    "https://www.google.com/maps/dir/"
                    f"?api=1&destination="
                    f"{center_lat},{center_lng}"
                )

                service_centers.append({
                    "place_id": center.get(
                        "place_id"
                    ),
                    "name": center.get(
                        "name"
                    ),
                    "latitude": center_lat,
                    "longitude": center_lng,
                    "distance_km": distance_km,
                    "directions_url": directions_url,
                    "phone": None,
                    "website": None,
                    "address": None,
                    "city": None,
                    "postcode": None,
                    "rating": center.get(
                        "rating"
                    ),
                })

            # -------------------------------------------------
            # SORT CACHED RESULTS
            # -------------------------------------------------

            service_centers.sort(
                key=lambda center:
                    center["distance_km"]
            )

            print(
                "[SERVICE CENTER CACHE HIT]"
            )

            return {
                "latitude": lat,
                "longitude": lng,
                "radius": radius,
                "count": len(
                    service_centers
                ),
                "cached": True,
                "service_centers": service_centers,
            }

    except Exception as exc:

        print(
            "[CACHE READ ERROR]",
            repr(exc),
        )

        print(
            "Continuing with Overpass API..."
        )

    # -----------------------------------------------------
    # OVERPASS QUERY
    # -----------------------------------------------------

    overpass_query = f"""
    [out:json][timeout:25];

    (
      nwr(around:{radius},{lat},{lng})["shop"="car_repair"];
      nwr(around:{radius},{lat},{lng})["shop"="motorcycle_repair"];
      nwr(around:{radius},{lat},{lng})["amenity"="car_repair"];
      nwr(around:{radius},{lat},{lng})["amenity"="vehicle_repair"];
    );

    out center tags;
    """

    try:

        # -------------------------------------------------
        # CALL OVERPASS API
        #
        # Use a primary server and a fallback server.
        # -------------------------------------------------

        overpass_servers = [
            "https://overpass-api.de/api/interpreter",
            "https://overpass.kumi.systems/api/interpreter",
        ]

        data = None

        async with httpx.AsyncClient() as client:

            for server_url in overpass_servers:

                try:

                    print(
                        "[OVERPASS] Trying:",
                        server_url,
                        "radius:",
                        radius,
                    )

                    response = await client.post(
                        server_url,
                        data=overpass_query,
                        headers={
                            "User-Agent": "VehiCare-AI/1.0",
                        },
                        timeout=httpx.Timeout(30.0),
                    )

                    response.raise_for_status()

                    data = response.json()

                    print(
                        "[OVERPASS] Success:",
                        server_url,
                    )

                    break

                except httpx.HTTPStatusError as exc:

                    status_code = exc.response.status_code

                    print(
                        "[OVERPASS HTTP ERROR]",
                        server_url,
                        status_code,
                    )

                    if status_code in (429, 500, 502, 503, 504):

                        print(
                            "[OVERPASS] Temporary error. "
                            "Trying next server..."
                        )

                        await asyncio.sleep(2)

                        continue

                    raise

                except httpx.TimeoutException as exc:

                    print(
                        "[OVERPASS TIMEOUT]",
                        server_url,
                        repr(exc),
                    )

                    print(
                        "[OVERPASS] Server timed out. "
                        "Trying next server..."
                    )

                    continue

                except httpx.RequestError as exc:

                    print(
                        "[OVERPASS REQUEST ERROR]",
                        server_url,
                        repr(exc),
                    )

                    print(
                        "[OVERPASS] Trying next server..."
                    )

                    continue

        # -------------------------------------------------
        # ALL OVERPASS SERVERS FAILED
        # -------------------------------------------------

        if data is None:

            raise HTTPException(
                status_code=502,
                detail="Nearby service search is temporarily unavailable",
            )

        # -------------------------------------------------
        # BUILD SERVICE CENTER LIST
        # -------------------------------------------------

        service_centers = []

        for element in data.get(
            "elements",
            [],
        ):

            tags = element.get(
                "tags",
                {}
            )

            # -------------------------------------------------
            # GET COORDINATES
            # -------------------------------------------------

            if element.get("type") == "node":

                latitude = element.get(
                    "lat"
                )

                longitude = element.get(
                    "lon"
                )

            else:

                center = element.get(
                    "center",
                    {},
                )

                latitude = center.get(
                    "lat"
                )

                longitude = center.get(
                    "lon"
                )

            # -------------------------------------------------
            # SKIP INVALID LOCATIONS
            # -------------------------------------------------

            if (
                latitude is None
                or longitude is None
            ):
                continue

            # -------------------------------------------------
            # CALCULATE DISTANCE
            # -------------------------------------------------

            distance_km = calculate_distance_km(
                lat,
                lng,
                latitude,
                longitude,
            )

            # -------------------------------------------------
            # DIRECTIONS URL
            # -------------------------------------------------

            directions_url = (
                "https://www.google.com/maps/dir/"
                f"?api=1&destination="
                f"{latitude},{longitude}"
            )

            # -------------------------------------------------
            # ADD SERVICE CENTER
            # -------------------------------------------------

            service_centers.append({
                "place_id": (
                    f"osm_"
                    f"{element.get('type')}_"
                    f"{element.get('id')}"
                ),
                "name": tags.get(
                    "name"
                ),
                "latitude": latitude,
                "longitude": longitude,
                "distance_km": distance_km,
                "directions_url": directions_url,
                "phone": (
                    tags.get("phone")
                    or tags.get(
                        "contact:phone"
                    )
                ),
                "website": (
                    tags.get("website")
                    or tags.get(
                        "contact:website"
                    )
                ),
                "address": tags.get(
                    "addr:street"
                ),
                "city": tags.get(
                    "addr:city"
                ),
                "postcode": tags.get(
                    "addr:postcode"
                ),
                "rating": None,
            })

        # -----------------------------------------------------
        # SORT BY DISTANCE
        # -----------------------------------------------------

        service_centers.sort(
            key=lambda center:
                center["distance_km"]
        )

        # -----------------------------------------------------
        # SAVE RESULTS TO CACHE
        # -----------------------------------------------------

        for center in service_centers:

            try:

                cache_data = {
                    "search_lat": cache_lat,
                    "search_lng": cache_lng,
                    "lat": center["latitude"],
                    "lng": center["longitude"],
                    "radius": radius,
                    "place_id": center["place_id"],
                    "name": center["name"],
                    "rating": center.get("rating"),
                    "fetched_at": datetime.utcnow().isoformat(),
                }

                (
                    supabase
                    .table("service_center_cache")
                    .insert(
                        cache_data
                    )
                    .execute()
                )

            except Exception as exc:

                print(
                    "[CACHE WRITE ERROR]",
                    repr(exc),
                )

        # -----------------------------------------------------
        # RESPONSE
        # -----------------------------------------------------

        return {
            "latitude": lat,
            "longitude": lng,
            "radius": radius,
            "count": len(
                service_centers
            ),
            "cached": False,
            "service_centers": service_centers,
        }

    # -----------------------------------------------------
    # OVERPASS HTTP ERROR
    # -----------------------------------------------------

    except httpx.HTTPStatusError as exc:

        print(
            "[OVERPASS HTTP ERROR]",
            repr(exc),
        )

        raise HTTPException(
            status_code=502,
            detail="Overpass API returned an error",
        )

    # -----------------------------------------------------
    # OVERPASS CONNECTION ERROR
    # -----------------------------------------------------

    except httpx.RequestError as exc:

        print(
            "[OVERPASS REQUEST ERROR]",
            repr(exc),
        )

        raise HTTPException(
            status_code=502,
            detail="Unable to connect to Overpass API",
        )

    # -----------------------------------------------------
    # HTTP EXCEPTION
    # -----------------------------------------------------

    except HTTPException:
        raise

    # -----------------------------------------------------
    # GENERAL ERROR
    # -----------------------------------------------------

    except Exception as exc:

        print(
            "[NEARBY SERVICE ERROR]",
            repr(exc),
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to find nearby service centers",
        )


# =========================================================
# GET SERVICE RECORDS
# GET /services/
# =========================================================

@router.get("/")
async def get_services(
    auth: AuthContext = Depends(verify_user),
):

    if not auth or not auth.user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )

    user_id = str(auth.user.id)

    # IMPORTANT:
    # Do not call supabase.postgrest.auth(auth.token)
    # here because the shared Supabase client is
    # initialized with the service-role key.

    try:

        # -------------------------------------------------
        # GET USER VEHICLES
        # -------------------------------------------------

        vehicles_response = (
            supabase
            .table("vehicles")
            .select("id")
            .eq(
                "user_id",
                user_id,
            )
            .execute()
        )

        vehicles = (
            vehicles_response.data or []
        )

        if not vehicles:
            return []

        vehicle_ids = [
            vehicle["id"]
            for vehicle in vehicles
        ]

        # -------------------------------------------------
        # GET SERVICE RECORDS
        # -------------------------------------------------

        response = (
            supabase
            .table("service_records")
            .select(
                """
                id,
                vehicle_id,
                service_date,
                service_type,
                notes,
                created_at,
                updated_at
                """
            )
            .in_(
                "vehicle_id",
                vehicle_ids,
            )
            .order(
                "service_date",
                desc=True,
            )
            .execute()
        )

        return response.data or []

    except Exception as exc:

        print(
            "[GET SERVICES ERROR]",
            repr(exc),
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve service records",
        )


# =========================================================
# WEEKLY SUMMARY
# GET /services/weekly-summary
# =========================================================

@router.get("/weekly-summary")
async def get_weekly_summary(
    auth: AuthContext = Depends(verify_user),
):

    if not auth or not auth.user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )

    user_id = str(auth.user.id)

    try:

        # -------------------------------------------------
        # CURRENT WEEK IN IST
        # -------------------------------------------------

        ist = ZoneInfo(
            "Asia/Kolkata"
        )

        now = datetime.now(
            ist
        )

        start_of_week = (
            now
            - timedelta(
                days=now.weekday()
            )
        ).replace(
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )

        end_of_week = (
            start_of_week
            + timedelta(
                days=7
            )
        )

        start_date = (
            start_of_week.date()
        )

        end_date = (
            end_of_week.date()
        )

        # -------------------------------------------------
        # GET USER VEHICLES
        # -------------------------------------------------

        vehicles_response = (
            supabase
            .table("vehicles")
            .select(
                "id, make, model, year"
            )
            .eq(
                "user_id",
                user_id,
            )
            .execute()
        )

        vehicles = (
            vehicles_response.data or []
        )

        if not vehicles:

            return {
                "week_start": (
                    start_date.isoformat()
                ),
                "week_end": (
                    end_date
                    - timedelta(
                        days=1
                    )
                ).isoformat(),
                "total_services": 0,
                "total_cost": 0,
                "services": [],
            }

        vehicle_ids = [
            vehicle["id"]
            for vehicle in vehicles
        ]

        # -------------------------------------------------
        # GET SERVICE RECORDS
        # -------------------------------------------------

        services_response = (
            supabase
            .table("service_records")
            .select(
                """
                id,
                vehicle_id,
                service_date,
                service_type,
                notes,
                description,
                cost
                """
            )
            .in_(
                "vehicle_id",
                vehicle_ids,
            )
            .gte(
                "service_date",
                start_date.isoformat(),
            )
            .lt(
                "service_date",
                end_date.isoformat(),
            )
            .order(
                "service_date",
                desc=True,
            )
            .execute()
        )

        service_records = (
            services_response.data or []
        )

        # -------------------------------------------------
        # MAP VEHICLES
        # -------------------------------------------------

        vehicle_map = {
            vehicle["id"]: vehicle
            for vehicle in vehicles
        }

        services = []

        total_cost = Decimal(
            "0"
        )

        # -------------------------------------------------
        # BUILD SUMMARY
        # -------------------------------------------------

        for record in service_records:

            cost = record.get(
                "cost"
            )

            if cost is None:

                cost_value = Decimal(
                    "0"
                )

            else:

                try:

                    cost_value = Decimal(
                        str(cost)
                    )

                except Exception:

                    cost_value = Decimal(
                        "0"
                    )

            total_cost += cost_value

            vehicle = vehicle_map.get(
                record[
                    "vehicle_id"
                ]
            )

            vehicle_name = None

            if vehicle:

                parts = [
                    vehicle.get(
                        "make"
                    ),
                    vehicle.get(
                        "model"
                    ),
                ]

                vehicle_name = " ".join(
                    str(part)
                    for part in parts
                    if part
                )

            services.append({
                "id": record["id"],
                "vehicle_id": record[
                    "vehicle_id"
                ],
                "vehicle": vehicle_name,
                "service_date": record[
                    "service_date"
                ],
                "service_type": record[
                    "service_type"
                ],
                "notes": record.get(
                    "notes"
                ),
                "description": record.get(
                    "description"
                ),
                "cost": float(
                    cost_value
                ),
            })

        # -------------------------------------------------
        # RESPONSE
        # -------------------------------------------------

        return {
            "week_start": (
                start_date.isoformat()
            ),
            "week_end": (
                end_date
                - timedelta(
                    days=1
                )
            ).isoformat(),
            "total_services": len(
                services
            ),
            "total_cost": float(
                total_cost
            ),
            "services": services,
        }

    except HTTPException:
        raise

    except Exception as exc:

        print(
            "[WEEKLY SUMMARY ERROR]",
            repr(exc),
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to generate weekly summary",
        )


# =========================================================
# WEEKLY SUMMARY TRIGGER
# POST /services/weekly-summary/trigger
# =========================================================

@router.post("/weekly-summary/trigger")
async def trigger_weekly_summary(
    auth: AuthContext = Depends(verify_user),
):

    if not auth or not auth.user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )

    user_id = str(auth.user.id)

    try:

        # -------------------------------------------------
        # CURRENT WEEK IN IST
        # -------------------------------------------------

        india_offset = timezone(
            timedelta(hours=5, minutes=30)
        )

        now_ist = datetime.now(
            india_offset
        )

        current_date = now_ist.date()

        week_start = (
            current_date
            - timedelta(
                days=current_date.weekday()
            )
        )

        week_end = week_start + timedelta(
            days=6
        )

        # -------------------------------------------------
        # GET USER VEHICLES
        # -------------------------------------------------

        vehicles_response = (
            supabase
            .table("vehicles")
            .select(
                "id, make, model"
            )
            .eq(
                "user_id",
                user_id,
            )
            .execute()
        )

        vehicles = (
            vehicles_response.data or []
        )

        vehicle_ids = [
            vehicle["id"]
            for vehicle in vehicles
            if vehicle.get("id")
        ]

        total_services = 0
        total_cost = Decimal("0")

        if vehicle_ids:

            services_response = (
                supabase
                .table("service_records")
                .select(
                    "id, service_date, service_type, cost"
                )
                .in_(
                    "vehicle_id",
                    vehicle_ids,
                )
                .gte(
                    "service_date",
                    week_start.isoformat(),
                )
                .lte(
                    "service_date",
                    week_end.isoformat(),
                )
                .execute()
            )

            service_records = (
                services_response.data or []
            )

            total_services = len(
                service_records
            )

            for record in service_records:

                cost = record.get(
                    "cost"
                )

                if cost is not None:

                    total_cost += Decimal(
                        str(cost)
                    )

        # -------------------------------------------------
        # CREATE IN-APP WEEKLY SUMMARY NOTIFICATION
        # -------------------------------------------------

        message = (
            f"Weekly vehicle service summary "
            f"({week_start.isoformat()} to {week_end.isoformat()}): "
            f"{total_services} service(s), "
            f"total cost ₹{float(total_cost):.2f}."
        )

        notification_response = (
            supabase
            .table("notifications")
            .insert(
                {
                    "user_id": user_id,
                    "channel": "in_app",
                    "message": message,
                    "notification_type": "maintenance",
                }
            )
            .execute()
        )

        notification = (
            notification_response.data[0]
            if notification_response.data
            else None
        )

        return {
            "message": "Weekly summary notification triggered successfully",
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "total_services": total_services,
            "total_cost": float(total_cost),
            "notification": notification,
        }

    except HTTPException:
        raise

    except Exception as exc:

        print(
            "[WEEKLY SUMMARY TRIGGER ERROR]",
            repr(exc),
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to trigger weekly summary",
        )


# =========================================================
# GET SINGLE SERVICE
# GET /services/{service_id}
# =========================================================

@router.get("/{service_id}")
async def get_service(
    service_id: str,
    auth: AuthContext = Depends(verify_user),
):
    """
    Get one service record by service ID.

    The service must belong to one of the authenticated
    user's vehicles.
    """

    # -----------------------------------------------------
    # AUTHENTICATION
    # -----------------------------------------------------

    if not auth or not auth.user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )

    user_id = str(auth.user.id)

    # -----------------------------------------------------
    # VALIDATE SERVICE ID
    # -----------------------------------------------------

    try:
        service_uuid = str(
            uuid.UUID(service_id)
        )

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid service_id. It must be a valid UUID.",
        )

    try:
        # -------------------------------------------------
        # GET USER VEHICLES
        # -------------------------------------------------

        vehicles_response = (
            supabase
            .table("vehicles")
            .select("id")
            .eq("user_id", user_id)
            .execute()
        )

        vehicles = vehicles_response.data or []

        if not vehicles:
            raise HTTPException(
                status_code=404,
                detail="No vehicles found for this user",
            )

        vehicle_ids = [
            vehicle["id"]
            for vehicle in vehicles
        ]

        # -------------------------------------------------
        # GET SERVICE BY ID
        # -------------------------------------------------

        response = (
            supabase
            .table("service_records")
            .select(
                """
                id,
                vehicle_id,
                service_date,
                service_type,
                notes,
                created_at,
                updated_at
                """
            )
            .eq("id", service_uuid)
            .in_("vehicle_id", vehicle_ids)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="Service record not found",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as exc:
        print(
            "[GET SINGLE SERVICE ERROR]",
            repr(exc),
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve service record",
        )
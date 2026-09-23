
import os
import re
import shutil
import uuid
from io import BytesIO
from typing import Optional

import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
)
from pydantic import BaseModel
from supabase import Client, create_client

from app.config import (
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET,
)
from app.middleware.auth import (
    AuthContext,
    verify_user,
)


# =========================================================
# ROUTER
# =========================================================

router = APIRouter()


# =========================================================
# CONSTANTS
# =========================================================

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
}

ALLOWED_STATUSES = {
    "Uploaded",
    "OCR running",
    "Parsed",
    "Confirmed",
    "OCR failed",
}


# =========================================================
# TESSERACT CONFIGURATION
# =========================================================

TESSERACT_PATH = os.getenv("TESSERACT_CMD", "tesseract")


def configure_tesseract() -> None:
    """
    Configure Tesseract explicitly.
    """

    if not shutil.which(TESSERACT_PATH):
        raise RuntimeError(
            f"Tesseract executable was not found at: "
            f"{TESSERACT_PATH}"
        )

    pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH

    try:
        version = pytesseract.get_tesseract_version()

        print("[OCR] Tesseract configured successfully.")
        print(f"[OCR] Executable: {TESSERACT_PATH}")
        print(f"[OCR] Version: {version}")

    except Exception as exc:
        raise RuntimeError(
            f"Tesseract executable exists but could not be executed: {exc}"
        )


# Configure Tesseract when module loads
configure_tesseract()


# =========================================================
# RESPONSE SCHEMAS
# =========================================================

class SlipStatusResponse(BaseModel):
    id: str
    status: str
    updated_at: Optional[str] = None
    error_message: Optional[str] = None


class SlipHistoryItem(BaseModel):
    id: str
    file_name: Optional[str] = None
    image_url: Optional[str] = None
    storage_path: Optional[str] = None
    bucket_name: Optional[str] = None
    status: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# =========================================================
# SUPABASE CLIENT
# =========================================================

def get_supabase_client() -> Client:
    """
    Create a Supabase client using the service-role key.
    """

    if not SUPABASE_URL:
        raise HTTPException(
            status_code=500,
            detail="SUPABASE_URL is not configured",
        )

    if not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=500,
            detail="SUPABASE_SERVICE_ROLE_KEY is not configured",
        )

    if not SUPABASE_STORAGE_BUCKET:
        raise HTTPException(
            status_code=500,
            detail="SUPABASE_STORAGE_BUCKET is not configured",
        )

    try:
        return create_client(
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize Supabase client: {exc}",
        )


# =========================================================
# IMAGE PREPROCESSING
# =========================================================

def preprocess_image(file_bytes: bytes) -> Image.Image:
    """
    Open and preprocess uploaded image before OCR.
    """

    if not file_bytes:
        raise ValueError("Uploaded image is empty")

    try:
        image = Image.open(BytesIO(file_bytes))
        image.load()

    except Exception as exc:
        raise ValueError(
            f"Unable to read image: {exc}"
        )

    if image.mode != "RGB":
        image = image.convert("RGB")

    image = ImageEnhance.Contrast(image).enhance(1.5)
    image = image.filter(ImageFilter.SHARPEN)

    return image


# =========================================================
# OCR
# =========================================================

def extract_text_from_image(file_bytes: bytes) -> str:
    """
    Extract text from an image using Tesseract OCR.
    """

    try:
        configure_tesseract()

        image = preprocess_image(file_bytes)

        print("[OCR] Starting OCR...")

        text = pytesseract.image_to_string(
            image,
            lang="eng",
            config="--oem 3 --psm 6",
        )

        print("[OCR] OCR completed.")

        return text.strip()

    except Exception as exc:
        print("=" * 60)
        print("OCR PROCESSING ERROR")
        print("=" * 60)
        print("Tesseract path:", TESSERACT_PATH)
        print("Error:", repr(exc))
        print("=" * 60)

        raise RuntimeError(
            f"OCR processing failed: {exc}"
        )


# =========================================================
# VEHICLE NUMBER EXTRACTION
# =========================================================

def extract_vehicle_numbers(text: str) -> list[str]:
    """
    Extract Indian vehicle registration numbers.
    """

    if not text:
        return []

    patterns = [
        r"\b[A-Z]{2}\s*[-]?\s*\d{1,2}\s*[-]?\s*[A-Z]{1,3}\s*[-]?\s*\d{1,4}\b",
        r"\b[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}\b",
    ]

    found = []
    text_upper = text.upper()

    for pattern in patterns:
        matches = re.findall(pattern, text_upper)

        for match in matches:
            cleaned = re.sub(
                r"[\s-]+",
                "",
                match,
            )

            if cleaned not in found:
                found.append(cleaned)

    return found


# =========================================================
# DATE EXTRACTION
# =========================================================

def extract_dates(text: str) -> list[str]:
    """
    Extract common date formats.
    """

    if not text:
        return []

    patterns = [
        r"\b\d{2}/\d{2}/\d{4}\b",
        r"\b\d{2}-\d{2}-\d{4}\b",
        r"\b\d{4}-\d{2}-\d{2}\b",
    ]

    dates = []

    for pattern in patterns:
        matches = re.findall(pattern, text)

        for match in matches:
            if match not in dates:
                dates.append(match)

    return dates


# =========================================================
# ODOMETER EXTRACTION
# =========================================================

def extract_odometer_readings(text: str) -> list[str]:
    """
    Extract odometer / KM readings.
    """

    if not text:
        return []

    patterns = [
        r"KM\s*Reading\s*[:\-]?\s*([\d,]+)\s*km?",
        r"KM\s*Reading\s*[:\-]?\s*([\d,]+)",
        r"Odometer\s*[:\-]?\s*([\d,]+)\s*km?",
        r"Odometer\s*Reading\s*[:\-]?\s*([\d,]+)",
    ]

    readings = []

    for pattern in patterns:
        matches = re.findall(
            pattern,
            text,
            re.IGNORECASE,
        )

        for match in matches:
            value = match.replace(",", "")

            if value not in readings:
                readings.append(value)

    return readings


# =========================================================
# SERVICE COST EXTRACTION
# =========================================================

def extract_service_costs(text: str) -> list[str]:
    """
    Extract service cost / grand total.
    """

    if not text:
        return []

    patterns = [
        r"Grand\s*Total\s*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})",
        r"Grand\s*Total\s*[:\-]?\s*(?:₹|Rs\.?)\s*([\d,]+\.\d{2})",
        r"Grand\s*Total.*?([\d,]+\.\d{2})",
    ]

    costs = []

    for pattern in patterns:
        matches = re.findall(
            pattern,
            text,
            re.IGNORECASE,
        )

        for match in matches:
            value = match.replace(",", "")

            if value not in costs:
                costs.append(value)

    return costs


# =========================================================
# SERVICE TYPE EXTRACTION
# =========================================================

def extract_service_types(text: str) -> list[str]:
    """
    Detect service types from OCR text.
    """

    if not text:
        return []

    keywords = [
        "General Service",
        "Periodic Maintenance",
        "Full Service",
        "Major Service",
        "Minor Service",
        "Regular Service",
        "Engine Service",
        "Oil Change",
        "Car Service",
        "Annual Service",
    ]

    service_types = []
    text_lower = text.lower()

    for service_type in keywords:
        if service_type.lower() in text_lower:
            if service_type not in service_types:
                service_types.append(service_type)

    return service_types


# =========================================================
# PARTS EXTRACTION
# =========================================================

def extract_parts(text: str) -> list[str]:
    """
    Detect common vehicle service parts.
    """

    if not text:
        return []

    known_parts = [
        "Engine Oil",
        "Oil Filter",
        "Air Filter",
        "AC Filter",
        "Brake Cleaner",
        "Spark Plug",
        "Brake Pad",
        "Brake Fluid",
        "Coolant",
        "Battery",
        "Clutch Plate",
        "Gear Oil",
        "Transmission Oil",
        "Fuel Filter",
        "Cabin Filter",
        "Wiper",
        "Tyre",
        "Engine Mount",
        "Fan Belt",
        "Timing Belt",
    ]

    parts = []
    text_lower = text.lower()

    for part in known_parts:
        if part.lower() in text_lower:
            if part not in parts:
                parts.append(part)

    return parts


# =========================================================
# REQUIRED FIELD CHECK
# =========================================================

def check_required_fields(
    vehicle_numbers: list[str],
    dates: list[str],
    service_types: list[str],
    parts: list[str],
    costs: list[str],
    odometer: list[str],
):
    return {
        "vehicle_number": len(vehicle_numbers) > 0,
        "service_date": len(dates) > 0,
        "service_type": len(service_types) > 0,
        "parts_replaced": len(parts) > 0,
        "service_cost": len(costs) > 0,
        "odometer_reading": len(odometer) > 0,
    }


# =========================================================
# SERVICE SLIP DATA EXTRACTION
# =========================================================

def extract_service_slip_data(text: str):
    """
    Convert OCR text into structured service-slip data.
    """

    vehicle_numbers = extract_vehicle_numbers(text)
    dates = extract_dates(text)
    service_types = extract_service_types(text)
    parts = extract_parts(text)
    costs = extract_service_costs(text)
    odometer = extract_odometer_readings(text)

    fields_found = check_required_fields(
        vehicle_numbers,
        dates,
        service_types,
        parts,
        costs,
        odometer,
    )

    missing_fields = [
        field
        for field, found in fields_found.items()
        if not found
    ]

    return {
        "vehicle_numbers": vehicle_numbers,
        "service_dates": dates,
        "service_types": service_types,
        "parts_replaced": parts,
        "service_costs": costs,
        "odometer_readings": odometer,
        "fields_found": fields_found,
        "missing_fields": missing_fields,
        "all_requirements_found": len(missing_fields) == 0,
    }


# =========================================================
# BACKWARD COMPATIBILITY ALIAS
# =========================================================

def extract_service_data(text: str):
    """
    Backward-compatible alias.
    """

    return extract_service_slip_data(text)


# =========================================================
# POST /slips/ocr
# =========================================================

@router.post(
    "/ocr",
    summary="Extract raw OCR text from image",
)
async def perform_ocr(
    file: UploadFile = File(...),
):
    """
    Standalone OCR endpoint.
    """

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid file type. "
                "Only JPG, JPEG and PNG images are supported."
            ),
        )

    try:
        file_bytes = await file.read()

        if not file_bytes:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty",
            )

        ocr_text = extract_text_from_image(file_bytes)

        return {
            "success": True,
            "rawText": ocr_text,
            "message": "OCR completed successfully",
        }

    except HTTPException:
        raise

    except Exception as exc:
        print("OCR API ERROR:", repr(exc))

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# =========================================================
# POST /slips/
# UPLOAD SERVICE SLIP
# =========================================================

@router.post("/")
async def upload_slip(
    file: UploadFile = File(...),
    auth: AuthContext = Depends(verify_user),
):
    """
    Upload service slip, perform OCR,
    extract structured information,
    and create service_slips record.
    """

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid file type. "
                "Only JPG, JPEG and PNG images are supported."
            ),
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=422,
            detail="Uploaded file is empty",
        )

    user_id = str(auth.user.id)
    slip_id = str(uuid.uuid4())
    file_id = str(uuid.uuid4())

    extension = ".jpg"

    if file.filename and "." in file.filename:
        extension = "." + file.filename.rsplit(
            ".",
            1,
        )[1].lower()

    storage_filename = f"{file_id}{extension}"
    storage_path = f"{user_id}/{storage_filename}"

    supabase = get_supabase_client()

    # -----------------------------------------------------
    # UPLOAD TO SUPABASE STORAGE
    # -----------------------------------------------------

    try:
        supabase.storage.from_(
            SUPABASE_STORAGE_BUCKET
        ).upload(
            storage_path,
            file_bytes,
            {
                "content-type": file.content_type,
                "upsert": "false",
            },
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Supabase Storage upload failed: {exc}",
        )

    # -----------------------------------------------------
    # OCR PROCESSING
    # -----------------------------------------------------

    processing_status = "OCR failed"
    ocr_text = ""

    extracted_data = {
        "vehicle_numbers": [],
        "service_dates": [],
        "service_types": [],
        "parts_replaced": [],
        "service_costs": [],
        "odometer_readings": [],
        "fields_found": {},
        "missing_fields": [],
        "all_requirements_found": False,
    }

    try:
        processing_status = "OCR running"

        ocr_text = extract_text_from_image(file_bytes)

        extracted_data = extract_service_slip_data(
            ocr_text
        )

        processing_status = "Parsed"

    except Exception as exc:
        print("[OCR ERROR]", repr(exc))

        processing_status = "OCR failed"

        extracted_data = {
            "vehicle_numbers": [],
            "service_dates": [],
            "service_types": [],
            "parts_replaced": [],
            "service_costs": [],
            "odometer_readings": [],
            "fields_found": {},
            "missing_fields": [
                "OCR processing failed"
            ],
            "all_requirements_found": False,
        }

        ocr_text = ""

    # -----------------------------------------------------
    # DATABASE RECORD
    # -----------------------------------------------------

    try:
        slip_record = {
            "id": slip_id,
            "user_id": user_id,
            "file_name": file.filename,
            "storage_path": storage_path,
            "bucket_name": SUPABASE_STORAGE_BUCKET,
            "status": processing_status,
            "error_message": None,
        }

        result = supabase.table(
            "service_slips"
        ).insert(
            slip_record
        ).execute()

        if not result.data:
            try:
                supabase.storage.from_(
                    SUPABASE_STORAGE_BUCKET
                ).remove(
                    [storage_path]
                )
            except Exception:
                pass

            raise HTTPException(
                status_code=500,
                detail="Failed to create service slip record",
            )

    except HTTPException:
        raise

    except Exception as exc:
        try:
            supabase.storage.from_(
                SUPABASE_STORAGE_BUCKET
            ).remove(
                [storage_path]
            )
        except Exception:
            pass

        raise HTTPException(
            status_code=500,
            detail=f"Failed to create slip record: {exc}",
        )

    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return {
        "message": "Service slip uploaded successfully",
        "slip_id": slip_id,
        "filename": file.filename,
        "storage_path": storage_path,
        "bucket": SUPABASE_STORAGE_BUCKET,
        "user_id": user_id,
        "status": processing_status,
        "ocr": {
            "completed": bool(ocr_text),
            "requirements": extracted_data,
        },
        "ocr_text": ocr_text,
    }


# =========================================================
# GET /slips/
# SLIP HISTORY
# =========================================================

@router.get(
    "/",
    response_model=list[SlipHistoryItem],
    summary="Get authenticated user's slip history",
)
async def get_slip_history(
    auth: AuthContext = Depends(verify_user),
):
    """
    Get all service slips belonging to the authenticated user,
    sorted by newest first.
    """

    supabase = get_supabase_client()

    try:
        result = (
            supabase.table("service_slips")
            .select(
                "id,file_name,image_url,storage_path,"
                "bucket_name,status,created_at,updated_at"
            )
            .eq("user_id", str(auth.user.id))
            .order("created_at", desc=True)
            .execute()
        )

        return result.data or []

    except Exception as exc:
        print("[SLIP HISTORY ERROR]", repr(exc))

        raise HTTPException(
            status_code=500,
            detail="Failed to fetch slip history",
        )


# =========================================================
# GET /slips/{slip_id}/status
# =========================================================

@router.get(
    "/{slip_id}/status",
    response_model=SlipStatusResponse,
)
async def get_slip_status(
    slip_id: str,
    auth: AuthContext = Depends(verify_user),
):
    """
    Get processing status of a service slip.
    """

    try:
        uuid.UUID(slip_id)

    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="Invalid slip ID",
        )

    supabase = get_supabase_client()

    try:
        result = supabase.table(
            "service_slips"
        ).select(
            "id,status,updated_at,error_message,user_id"
        ).eq(
            "id",
            slip_id,
        ).eq(
            "user_id",
            str(auth.user.id),
        ).single().execute()

    except Exception as exc:
        print("[SLIP STATUS ERROR]", repr(exc))

        raise HTTPException(
            status_code=404,
            detail="Service slip not found",
        )

    if not result.data:
        raise HTTPException(
            status_code=404,
            detail="Service slip not found",
        )

    data = result.data
    current_status = data.get("status")

    if current_status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=500,
            detail=f"Invalid slip status: {current_status}",
        )

    return SlipStatusResponse(
        id=str(data["id"]),
        status=current_status,
        updated_at=data.get("updated_at"),
        error_message=data.get("error_message"),
    )


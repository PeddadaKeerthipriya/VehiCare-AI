
from typing import List
from uuid import UUID, uuid4
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from postgrest.exceptions import APIError

from app.database import supabase
from app.middleware.auth import AuthContext, verify_user
from app.schemas.insurance import InsuranceResponse


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/{vehicle_id}/insurance",
    tags=["Insurance"],
)


# =========================================================
# CONSTANTS
# =========================================================

STORAGE_BUCKET = "vehicare-1storage"
INSURANCE_FOLDER = "insurance-documents"


# =========================================================
# AUTHENTICATE POSTGREST
# =========================================================

def _authenticate_postgrest(token: str) -> None:
    supabase.postgrest.auth(token)


# =========================================================
# DATABASE ERROR HANDLER
# =========================================================

def _handle_db_error(exc: Exception) -> HTTPException:

    print("[INSURANCE ERROR]", repr(exc))

    if isinstance(exc, APIError):

        if exc.code == "23505":
            return HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "An insurance policy with this policy number "
                    "already exists."
                ),
            )

    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="An unexpected database error occurred.",
    )


# =========================================================
# VERIFY VEHICLE OWNERSHIP
# =========================================================

def _verify_vehicle(
    vehicle_id: UUID,
    auth: AuthContext,
) -> None:

    vehicle = (
        supabase
        .table("vehicles")
        .select("id")
        .eq("id", str(vehicle_id))
        .eq("user_id", str(auth.user.id))
        .execute()
    )

    if not vehicle.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found",
        )


# =========================================================
# UPLOAD INSURANCE DOCUMENT
# =========================================================

def _upload_insurance_document(
    vehicle_id: UUID,
    document: UploadFile,
) -> str:

    if not document.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid insurance document",
        )

    # -----------------------------------------------------
    # Allowed file types
    # -----------------------------------------------------

    allowed_extensions = {
        ".pdf",
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
    }

    extension = Path(document.filename).suffix.lower()

    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Unsupported document type. "
                "Allowed types: PDF, JPG, JPEG, PNG, WEBP."
            ),
        )

    # -----------------------------------------------------
    # Read file
    # -----------------------------------------------------

    file_content = document.file.read()

    if not file_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insurance document is empty",
        )

    # -----------------------------------------------------
    # Maximum file size: 10 MB
    # -----------------------------------------------------

    max_size = 10 * 1024 * 1024

    if len(file_content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insurance document must be smaller than 10 MB",
        )

    # -----------------------------------------------------
    # Generate unique storage path
    # -----------------------------------------------------

    file_name = f"{uuid4()}{extension}"

    storage_path = (
        f"{INSURANCE_FOLDER}/"
        f"{vehicle_id}/"
        f"{file_name}"
    )

    # -----------------------------------------------------
    # Upload to Supabase Storage
    # -----------------------------------------------------

    try:
        supabase.storage.from_(STORAGE_BUCKET).upload(
            storage_path,
            file_content,
            {
                "content-type": (
                    document.content_type
                    or "application/octet-stream"
                ),
                "upsert": "false",
            },
        )

    except Exception as exc:
        print(
            "[INSURANCE DOCUMENT UPLOAD ERROR]",
            repr(exc),
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload insurance document",
        )

    # -----------------------------------------------------
    # Get public URL
    # -----------------------------------------------------

    try:
        public_url = (
            supabase
            .storage
            .from_(STORAGE_BUCKET)
            .get_public_url(storage_path)
        )

        return public_url

    except Exception as exc:
        print(
            "[INSURANCE DOCUMENT URL ERROR]",
            repr(exc),
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate insurance document URL",
        )


# =========================================================
# GET INSURANCE POLICIES
# =========================================================

@router.get(
    "",
    response_model=List[InsuranceResponse],
    summary="Get Insurance Policies",
)
async def get_insurance_policies(
    vehicle_id: UUID,
    auth: AuthContext = Depends(verify_user),
):
    try:
        _authenticate_postgrest(auth.token)

        _verify_vehicle(vehicle_id, auth)

        response = (
            supabase
            .table("insurance_policies")
            .select("*")
            .eq("vehicle_id", str(vehicle_id))
            .execute()
        )

        return response.data or []

    except HTTPException:
        raise

    except Exception as exc:
        raise _handle_db_error(exc)


# =========================================================
# CREATE INSURANCE POLICY
# POST /vehicles/{vehicle_id}/insurance
# =========================================================

@router.post(
    "",
    response_model=InsuranceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Insurance Policy",
)
async def create_insurance_policy(
    vehicle_id: UUID,

    insurer: str = Form(...),
    policy_number: str = Form(...),
    start_date: str = Form(...),
    expiry_date: str = Form(...),

    document: UploadFile | None = File(None),

    auth: AuthContext = Depends(verify_user),
):
    try:
        _authenticate_postgrest(auth.token)

        _verify_vehicle(vehicle_id, auth)

        # -------------------------------------------------
        # Validate required strings
        # -------------------------------------------------

        insurer = insurer.strip()
        policy_number = policy_number.strip()

        if not insurer:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insurer is required",
            )

        if not policy_number:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Policy number is required",
            )

        # -------------------------------------------------
        # Validate dates
        # -------------------------------------------------

        from datetime import date

        try:
            parsed_start_date = date.fromisoformat(
                start_date
            )

            parsed_expiry_date = date.fromisoformat(
                expiry_date
            )

        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Invalid date format. "
                    "Use YYYY-MM-DD."
                ),
            )

        if parsed_expiry_date < parsed_start_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="expiry_date cannot be before start_date",
            )

        # -------------------------------------------------
        # Upload document if provided
        # -------------------------------------------------

        document_url = None

        if document is not None:
            document_url = _upload_insurance_document(
                vehicle_id,
                document,
            )

        # -------------------------------------------------
        # Prepare database data
        # -------------------------------------------------

        insurance_data = {
            "vehicle_id": str(vehicle_id),
            "insurer": insurer,
            "policy_number": policy_number,
            "start_date": parsed_start_date.isoformat(),
            "expiry_date": parsed_expiry_date.isoformat(),
            "document_url": document_url,
        }

        # -------------------------------------------------
        # Insert insurance policy
        # -------------------------------------------------

        response = (
            supabase
            .table("insurance_policies")
            .insert(insurance_data)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Insurance policy was not created",
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as exc:
        raise _handle_db_error(exc)

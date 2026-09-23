import io
import os

import pytesseract
from PIL import Image
from fastapi import APIRouter, UploadFile, File, HTTPException


router = APIRouter()


TESSERACT_PATH = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)


def configure_tesseract():
    if not os.path.isfile(TESSERACT_PATH):
        raise RuntimeError(
            f"Tesseract executable not found at: "
            f"{TESSERACT_PATH}"
        )

    pytesseract.pytesseract.tesseract_cmd = (
        TESSERACT_PATH
    )


configure_tesseract()


@router.post("/ocr")
async def extract_text(
    file: UploadFile = File(...),
):
    if file.content_type not in {
        "image/jpeg",
        "image/png",
    }:
        raise HTTPException(
            status_code=422,
            detail="Only JPG, JPEG and PNG images are supported",
        )

    try:
        image_bytes = await file.read()

        if not image_bytes:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty",
            )

        image = Image.open(
            io.BytesIO(image_bytes)
        )

        image.load()

        raw_text = pytesseract.image_to_string(
            image,
            lang="eng",
        )

        return {
            "success": True,
            "rawText": raw_text.strip(),
        }

    except HTTPException:
        raise

    except Exception as exc:
        print("[OCR ERROR]", repr(exc))

        raise HTTPException(
            status_code=500,
            detail="OCR processing failed",
        )
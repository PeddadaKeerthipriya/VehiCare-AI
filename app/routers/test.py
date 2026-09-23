from fastapi import APIRouter
from app.database import supabase

router = APIRouter()

@router.get("/test-db")
def test_db():
    try:
        response = supabase.table("test").select("*").execute()

        return {
            "status": "Connected",
            "rows": response.data
        }

    except Exception as e:
        return {
            "status": "Failed",
            "error": str(e)
        }
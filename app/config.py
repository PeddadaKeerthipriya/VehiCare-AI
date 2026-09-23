import os

from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

SUPABASE_STORAGE_BUCKET = os.getenv(
    "SUPABASE_STORAGE_BUCKET",
    "vehicare-1storage",
)

DIAGNOSIS_N8N_WEBHOOK_URL = os.getenv(
    "DIAGNOSIS_N8N_WEBHOOK_URL"
)

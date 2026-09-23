from supabase import Client, create_client

from app.config import (
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
)


if not SUPABASE_URL:
    raise ValueError("SUPABASE_URL is missing")

if not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError("SUPABASE_SERVICE_ROLE_KEY is missing")


# Server-side Supabase client.
# This client uses the service-role key.
supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
)


print("[SUPABASE] Client initialized")
print("[SUPABASE] URL:", SUPABASE_URL)
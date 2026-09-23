import os
from types import SimpleNamespace
from app.database import supabase


def get_current_user(access_token: str):
    """
    Validate the Supabase access token or Service Role Key and return the authenticated user.
    """

    if not access_token:
        return None

    # Allow persistent Service Role Key (for n8n / automated server-to-server calls)
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if service_role_key and access_token.strip() == service_role_key.strip():
        print("[AUTH] Authenticated via Service Role Key (System / n8n Automation)")
        return SimpleNamespace(id="00000000-0000-0000-0000-000000000000", email="system@vehicare.ai")

    try:
        response = supabase.auth.get_user(access_token)

        if response and response.user:
            print("[AUTH] User authenticated:", response.user.id)
            return response.user

        return None

    except Exception as exc:
        print("[AUTH] Authentication failed:", repr(exc))
        return None
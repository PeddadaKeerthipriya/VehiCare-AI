from dataclasses import dataclass
from typing import Any

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.auth.supabase_auth import get_current_user


security = HTTPBearer(auto_error=True)


@dataclass
class AuthContext:
    """
    Bundles the authenticated Supabase user together
    with the raw access token.
    """
    user: Any
    token: str


async def verify_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> AuthContext:
    """
    Verify the Bearer token and return the authenticated
    Supabase user along with the token.
    """

    access_token = credentials.credentials.strip()

    if not access_token:
        raise HTTPException(
            status_code=401,
            detail="Access token missing"
        )

    user = get_current_user(access_token)

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token. Please sign in again."
        )

    return AuthContext(
        user=user,
        token=access_token
    )
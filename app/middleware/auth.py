from dataclasses import dataclass
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.supabase_auth import get_current_user


security = HTTPBearer(auto_error=True)


@dataclass
class AuthContext:
    user: Any
    token: str


async def verify_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> AuthContext:

    access_token = credentials.credentials.strip()

    if access_token.lower().startswith("bearer "):
        access_token = access_token[7:].strip()

    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token missing",
        )

    user = get_current_user(access_token)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please sign in again.",
        )

    return AuthContext(
        user=user,
        token=access_token,
    )
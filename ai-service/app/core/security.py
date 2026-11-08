import hmac
from typing import Optional
from fastapi import Header, HTTPException, status
from app.core.config import settings
from app.core.logging import logger


async def verify_internal_service_secret(
    x_service_secret: Optional[str] = Header(None, alias="X-Service-Secret"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> str:
    """
    Validate that an incoming request contains the shared internal secret.
    Rejects unauthorized or forged requests from outside the Node-Python gateway.
    
    Accepts:
      - X-Service-Secret: <secret>
      - Authorization: Bearer <secret>
    """
    token = x_service_secret

    if not token and authorization:
        parts = authorization.split(" ")
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
        elif len(parts) == 1:
            token = parts[0]

    if not token:
        logger.warning("Rejected internal service request: missing authentication header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "success": False,
                "error": "Missing internal service authentication. Expected X-Service-Secret header.",
                "code": "UNAUTHORIZED",
            },
        )

    expected = settings.SERVICE_SECRET.encode("utf-8")
    provided = token.encode("utf-8")

    if not hmac.compare_digest(provided, expected):
        logger.warning("Rejected internal service request: invalid service secret provided")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "error": "Invalid internal service credentials.",
                "code": "FORBIDDEN",
            },
        )

    return token

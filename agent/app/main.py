from contextlib import asynccontextmanager
from typing import AsyncGenerator
import uvicorn
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes.analysis import router as analysis_router
from app.api.routes.health import router as health_router
from app.core.config import settings
from app.core.logging import logger, setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifecycle management (startup and graceful shutdown).
    """
    setup_logging(log_level=settings.LOG_LEVEL)
    logger.info(
        f"🚀 Starting {settings.SERVICE_NAME} v{settings.SERVICE_VERSION} "
        f"[env={settings.ENVIRONMENT}] on {settings.HOST}:{settings.PORT}"
    )
    yield
    logger.info(f"🛑 Shutting down {settings.SERVICE_NAME}")


# Initialize FastAPI application
app = FastAPI(
    title="Reagmat AI Microservice",
    description="Dedicated AI and design intelligence microservice for Reagmat Figma-to-React platform.",
    version=settings.SERVICE_VERSION,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception Handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """
    Handle Pydantic request validation errors with standardized JSON envelope.
    """
    logger.warning(f"Validation error on {request.method} {request.url.path}: {exc.errors()}")
    error_messages = [f"{err.get('loc', ['field'])[-1]}: {err.get('msg', 'invalid')}" for err in exc.errors()]
    summary = "; ".join(error_messages)

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": f"Request validation failed: {summary}",
            "code": "VALIDATION_ERROR",
            "details": exc.errors(),
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """
    Handle HTTP exceptions with standardized JSON envelope.
    """
    if isinstance(exc.detail, dict):
        content = {
            "success": exc.detail.get("success", False),
            "error": exc.detail.get("error", "HTTP error"),
            "code": exc.detail.get("code", f"HTTP_{exc.status_code}"),
            "details": exc.detail.get("details", None),
        }
    else:
        content = {
            "success": False,
            "error": str(exc.detail),
            "code": f"HTTP_{exc.status_code}",
            "details": None,
        }

    return JSONResponse(status_code=exc.status_code, content=content)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Catch-all handler for unhandled internal exceptions.
    Prevents secret or sensitive internal stack leak.
    """
    logger.exception(f"Unhandled exception on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": "An internal server error occurred while processing design intelligence.",
            "code": "INTERNAL_SERVER_ERROR",
            "details": str(exc) if not settings.is_production else None,
        },
    )


# Mount API routers
# Health endpoints mounted at root and /api/v1
app.include_router(health_router)
# Protected design analysis endpoints
app.include_router(analysis_router)


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.ENVIRONMENT == "development",
        log_level=settings.LOG_LEVEL.lower(),
    )

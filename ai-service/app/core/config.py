import os
from typing import List, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application configuration settings loaded from environment or .env file.
    """
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env", "agent/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    SERVICE_NAME: str = Field(default="reagmat-ai-service", description="Service identifier")
    SERVICE_VERSION: str = Field(default="1.0.0", description="Semantic service version")
    ENVIRONMENT: str = Field(default="development", description="Runtime environment: development, test, production")
    HOST: str = Field(default="0.0.0.0", description="Server bind host")
    PORT: int = Field(default=8000, description="Server listen port")
    LOG_LEVEL: str = Field(default="info", description="Logging level")

    # Internal service authentication secret shared between Node.js and FastAPI
    SERVICE_SECRET: str = Field(
        default="your_internal_service_secret",
        description="Shared secret for internal Node-Python API requests",
    )

    # Versioned API route prefix
    API_V1_PREFIX: str = Field(default="/api/v1", description="API v1 route prefix")

    # CORS origins
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:5000", "http://localhost:5173", "http://127.0.0.1:5000", "http://127.0.0.1:5173"],
        description="Allowed CORS origins",
    )

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def is_testing(self) -> bool:
        return self.ENVIRONMENT.lower() == "test"


settings = Settings()

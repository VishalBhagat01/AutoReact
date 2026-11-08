import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Dict


class JSONFormatter(logging.Formatter):
    """
    Structured JSON log formatter for production and microservice observability.
    """

    def format(self, record: logging.LogRecord) -> str:
        log_obj: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Include custom attributes or request context if available
        if hasattr(record, "request_id"):
            log_obj["request_id"] = record.request_id
        if hasattr(record, "path"):
            log_obj["path"] = record.path
        if hasattr(record, "method"):
            log_obj["method"] = record.method
        if hasattr(record, "status_code"):
            log_obj["status_code"] = record.status_code

        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_obj)


def setup_logging(log_level: str = "INFO", json_format: bool = False) -> logging.Logger:
    """
    Configure and initialize application logging.
    """
    logger = logging.getLogger("reagmat-ai")
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    logger.setLevel(numeric_level)

    # Avoid duplicate handlers if reconfigured
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(numeric_level)

        if json_format:
            handler.setFormatter(JSONFormatter())
        else:
            standard_formatter = logging.Formatter(
                fmt="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
            handler.setFormatter(standard_formatter)

        logger.addHandler(handler)

    # Configure uvicorn loggers to match
    uvicorn_logger = logging.getLogger("uvicorn")
    uvicorn_logger.setLevel(numeric_level)

    return logger


logger = setup_logging()

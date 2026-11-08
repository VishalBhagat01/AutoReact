from datetime import datetime, timezone
from fastapi import APIRouter
from app.core.config import settings
from app.models.responses import CapabilitiesResponse, HealthResponse

router = APIRouter(tags=["Health & Capabilities"])


@router.get("/health", response_model=HealthResponse, summary="Service health check")
async def health_check() -> HealthResponse:
    """
    Standard health check endpoint reporting service operational state.
    """
    return HealthResponse(
        status="ok",
        service=settings.SERVICE_NAME,
        version=settings.SERVICE_VERSION,
        timestamp=datetime.now(timezone.utc).isoformat(),
        environment=settings.ENVIRONMENT,
    )


@router.get("/api/v1/health", response_model=HealthResponse, summary="Versioned v1 health check")
async def v1_health_check() -> HealthResponse:
    """
    Versioned v1 health check endpoint.
    """
    return HealthResponse(
        status="ok",
        service=settings.SERVICE_NAME,
        version=settings.SERVICE_VERSION,
        timestamp=datetime.now(timezone.utc).isoformat(),
        environment=settings.ENVIRONMENT,
    )


@router.get(
    "/api/v1/capabilities",
    response_model=CapabilitiesResponse,
    summary="List operational vs pending processing capabilities",
)
async def get_capabilities() -> CapabilitiesResponse:
    """
    Describes processing capabilities currently implemented in the Python microservice.
    Milestone 6 operational capabilities: geometry engine, spatial relationships,
    relationship graph, layout inference, and repeated component detection.
    """
    return CapabilitiesResponse(
        service=settings.SERVICE_NAME,
        version=settings.SERVICE_VERSION,
        status="operational",
        capabilities={
            # Operational foundational capabilities
            "health_check": True,
            "internal_service_authentication": True,
            "design_payload_validation": True,
            "design_metadata_extraction": True,
            "node_counting": True,
            "structural_inspection": True,
            # Operational Geometry & Design Intelligence capabilities (Milestone 6)
            "geometry_spatial_analysis": True,
            "relationship_graph": True,
            "layout_inference": True,
            "repeated_component_detection": True,
            # Future AI & code generation capabilities (Pending Milestone 7+)
            "semantic_reasoning": False,
            "langgraph_orchestration": False,
            "llm_code_generation": False,
            "code_generation": False,
            "react_code_synthesis": False,
            "visual_validation": False,
        },
        supported_versions=["v1"],
        environment=settings.ENVIRONMENT,
    )

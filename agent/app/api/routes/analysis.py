from fastapi import APIRouter, Depends, status
from app.core.security import verify_internal_service_secret
from app.models.requests import DesignAnalysisRequest
from app.models.responses import DesignAnalysisResponse
from app.services.design_service import design_service

router = APIRouter(prefix="/api/v1/design", tags=["Design Analysis"])


@router.post(
    "/analyze",
    response_model=DesignAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze normalized design payload",
    dependencies=[Depends(verify_internal_service_secret)],
)
async def analyze_design(request: DesignAnalysisRequest) -> DesignAnalysisResponse:
    """
    Accepts normalized Figma design AST payload and returns structured analysis response.
    
    Validates:
      - Request ID
      - Node bounds, layout, styles, hierarchy
      - Number of nodes and layer types
      - Design metadata and capability statuses
    """
    return design_service.analyze_design(request)

from typing import List
from fastapi import APIRouter, Depends, status
from app.core.security import verify_internal_service_secret
from app.models.geometry import (
    DetectedComponent,
    GeometryAnalysisResult,
    LayoutInference,
    RelationshipGraphData,
)
from app.models.requests import DesignAnalysisRequest
from app.models.responses import DesignAnalysisResponse
from app.services.design_service import design_service

router = APIRouter(prefix="/api/v1", tags=["Design Intelligence & Geometry"])


@router.post(
    "/design/analyze",
    response_model=DesignAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Comprehensive design analysis with geometry and relationship graph",
    dependencies=[Depends(verify_internal_service_secret)],
)
async def analyze_design(request: DesignAnalysisRequest) -> DesignAnalysisResponse:
    """
    Accepts normalized Figma design AST payload and returns comprehensive analysis:
    structural node metrics, geometry engine analysis, layout patterns, and relationship graph.
    """
    return design_service.analyze_design(request)


@router.post(
    "/geometry/analyze",
    response_model=GeometryAnalysisResult,
    status_code=status.HTTP_200_OK,
    summary="Deterministic geometry analysis (alignments, spacings, overlaps, grids)",
    dependencies=[Depends(verify_internal_service_secret)],
)
async def analyze_geometry(request: DesignAnalysisRequest) -> GeometryAnalysisResult:
    """
    Calculates bounding boxes, horizontal/vertical alignments, equal spacing,
    overlap/containment, and regular 2D grid structures across design nodes.
    """
    return design_service.analyze_geometry(request)


@router.post(
    "/layout/infer",
    response_model=List[LayoutInference],
    status_code=status.HTTP_200_OK,
    summary="Deterministic layout pattern inference with confidence & evidence",
    dependencies=[Depends(verify_internal_service_secret)],
)
async def infer_layout(request: DesignAnalysisRequest) -> List[LayoutInference]:
    """
    Infers flex row, flex column, grid, stack, overlay, card, navigation, or absolute
    layout patterns for all container frames in the design AST.
    """
    return design_service.infer_layout(request)


@router.post(
    "/graph/generate",
    response_model=RelationshipGraphData,
    status_code=status.HTTP_200_OK,
    summary="Generate NetworkX design relationship graph",
    dependencies=[Depends(verify_internal_service_secret)],
)
async def generate_graph(request: DesignAnalysisRequest) -> RelationshipGraphData:
    """
    Constructs complete relationship graph capturing PARENT_OF, ALIGNED_WITH,
    NEXT_TO, CONTAINS, INSTANCE_OF, SHARES_STYLE_WITH, and GROUPED_WITH edges.
    """
    return design_service.generate_graph(request)


@router.post(
    "/components/detect",
    response_model=List[DetectedComponent],
    status_code=status.HTTP_200_OK,
    summary="Identify repeated components and reusable visual patterns",
    dependencies=[Depends(verify_internal_service_secret)],
)
async def detect_components(request: DesignAnalysisRequest) -> List[DetectedComponent]:
    """
    Detects native Figma components/instances and identifies repeated visual patterns
    based on structural similarity, geometry aspect ratio, and style consistency.
    """
    return design_service.detect_components(request)

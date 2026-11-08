from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class BoundingBox(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    x: float = Field(default=0.0)
    y: float = Field(default=0.0)
    width: float = Field(default=0.0)
    height: float = Field(default=0.0)
    right: float = Field(default=0.0)
    bottom: float = Field(default=0.0)
    center_x: float = Field(default=0.0, alias="centerX")
    center_y: float = Field(default=0.0, alias="centerY")
    area: float = Field(default=0.0)
    aspect_ratio: float = Field(default=1.0, alias="aspectRatio")
    is_valid: bool = Field(default=True, alias="isValid")


class RelativeBounds(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    rel_x: float = Field(default=0.0, alias="relX")
    rel_y: float = Field(default=0.0, alias="relY")
    rel_right: float = Field(default=0.0, alias="relRight")
    rel_bottom: float = Field(default=0.0, alias="relBottom")


class AlignmentRelation(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    node_a_id: str = Field(..., alias="nodeAId")
    node_b_id: str = Field(..., alias="nodeBId")
    axis: str = Field(..., description="'horizontal' or 'vertical'")
    alignment_type: str = Field(..., alias="alignmentType", description="'top', 'bottom', 'center_y', 'left', 'right', 'center_x'")
    offset: float = Field(default=0.0)
    tolerance: float = Field(default=3.0)
    confidence: float = Field(default=1.0)


class SpacingRelation(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    node_a_id: str = Field(..., alias="nodeAId")
    node_b_id: str = Field(..., alias="nodeBId")
    direction: str = Field(..., description="'horizontal' or 'vertical'")
    gap: float = Field(...)
    is_consistent: bool = Field(default=False, alias="isConsistent")


class OverlapRelation(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    node_a_id: str = Field(..., alias="nodeAId")
    node_b_id: str = Field(..., alias="nodeBId")
    intersection_area: float = Field(..., alias="intersectionArea")
    overlap_ratio_a: float = Field(..., alias="overlapRatioA")
    overlap_ratio_b: float = Field(..., alias="overlapRatioB")
    is_containment: bool = Field(default=False, alias="isContainment")
    container_id: Optional[str] = Field(default=None, alias="containerId")


class GridCluster(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    rows: int
    columns: int
    cell_count: int = Field(..., alias="cellCount")
    row_gap: Optional[float] = Field(default=None, alias="rowGap")
    col_gap: Optional[float] = Field(default=None, alias="colGap")
    cell_width: float = Field(..., alias="cellWidth")
    cell_height: float = Field(..., alias="cellHeight")
    node_ids: List[str] = Field(..., alias="nodeIds")
    matrix: List[List[Optional[str]]] = Field(default_factory=list)
    confidence: float = Field(default=0.9)


class LayoutInference(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    node_id: str = Field(..., alias="nodeId")
    pattern: str = Field(..., description="'FLEX_ROW', 'FLEX_COLUMN', 'GRID', 'ABSOLUTE', 'STACK', 'OVERLAY', 'CARD', 'NAVIGATION'")
    confidence: float = Field(..., ge=0.0, le=1.0)
    evidence: List[str] = Field(default_factory=list)
    properties: Dict[str, Any] = Field(default_factory=dict)


class ComponentVariation(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    property_name: str = Field(..., alias="propertyName")
    variation_type: str = Field(..., alias="variationType")
    values_by_node_id: Dict[str, Any] = Field(default_factory=dict, alias="valuesByNodeId")


class DetectedComponent(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    component_id: str = Field(..., alias="componentId")
    name: str
    source: str = Field(..., description="'figma_component' or 'inferred_pattern'")
    archetype_node_id: str = Field(..., alias="archetypeNodeId")
    instance_node_ids: List[str] = Field(default_factory=list, alias="instanceNodeIds")
    instance_count: int = Field(..., alias="instanceCount")
    confidence: float = Field(..., ge=0.0, le=1.0)
    similarity_factors: Dict[str, float] = Field(default_factory=dict, alias="similarityFactors")
    variations: List[ComponentVariation] = Field(default_factory=list)


class GraphNode(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str = Field(default="Node")
    type: str = Field(..., description="'FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'TEXT', 'VECTOR', 'IMAGE', 'OTHER'")
    bounds: Optional[BoundingBox] = None
    relative_bounds: Optional[RelativeBounds] = Field(default=None, alias="relativeBounds")
    inferred_layout: Optional[str] = Field(default=None, alias="inferredLayout")
    is_component: bool = Field(default=False, alias="isComponent")
    component_id: Optional[str] = Field(default=None, alias="componentId")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    source: str
    target: str
    type: str = Field(
        ...,
        description="'PARENT_OF', 'ALIGNED_WITH', 'NEXT_TO', 'CONTAINS', 'INSTANCE_OF', 'SHARES_STYLE_WITH', 'GROUPED_WITH', 'DEPENDS_ON'",
    )
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RelationshipGraphData(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    nodes: List[GraphNode] = Field(default_factory=list)
    edges: List[GraphEdge] = Field(default_factory=list)
    node_count: int = Field(default=0, alias="nodeCount")
    edge_count: int = Field(default=0, alias="edgeCount")
    edge_type_distribution: Dict[str, int] = Field(default_factory=dict, alias="edgeTypeDistribution")
    analysis_warnings: List[str] = Field(default_factory=list, alias="analysisWarnings")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class GeometryAnalysisResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    success: bool = Field(default=True)
    request_id: str = Field(..., alias="requestId")
    node_count: int = Field(..., alias="nodeCount")
    bounds_by_node_id: Dict[str, BoundingBox] = Field(default_factory=dict, alias="boundsByNodeId")
    alignments: List[AlignmentRelation] = Field(default_factory=list)
    spacings: List[SpacingRelation] = Field(default_factory=list)
    overlaps: List[OverlapRelation] = Field(default_factory=list)
    grid_clusters: List[GridCluster] = Field(default_factory=list, alias="gridClusters")
    inferred_layouts: List[LayoutInference] = Field(default_factory=list, alias="inferredLayouts")
    detected_components: List[DetectedComponent] = Field(default_factory=list, alias="detectedComponents")
    graph: Optional[RelationshipGraphData] = None
    warnings: List[str] = Field(default_factory=list)

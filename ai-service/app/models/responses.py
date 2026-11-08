from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ErrorResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    success: bool = Field(default=False)
    error: str = Field(..., description="Human-readable error description")
    code: str = Field(default="INTERNAL_ERROR", description="Machine-readable error code")
    details: Optional[Any] = Field(default=None, description="Detailed validation or trace information")


class HealthResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: str = Field(default="ok", description="Service health status")
    service: str = Field(default="reagmat-ai-service", description="Service identifier")
    version: str = Field(..., description="Service version")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO 8601 UTC timestamp",
    )
    environment: str = Field(default="development", description="Current execution environment")


class CapabilitiesResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    service: str = Field(default="reagmat-ai-service")
    version: str = Field(...)
    status: str = Field(default="operational")
    capabilities: Dict[str, bool] = Field(
        ...,
        description="Boolean flags indicating implemented vs unimplemented features",
    )
    supported_versions: List[str] = Field(default=["v1"])
    environment: str = Field(default="development")


class NodeBreakdown(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    total_nodes: int = Field(default=0, alias="totalNodes")
    container_nodes: int = Field(default=0, alias="containerNodes")
    text_nodes: int = Field(default=0, alias="textNodes")
    vector_nodes: int = Field(default=0, alias="vectorNodes")
    component_instances: int = Field(default=0, alias="componentInstances")
    max_tree_depth: int = Field(default=0, alias="maxTreeDepth")
    has_layout: bool = Field(default=False, alias="hasLayout")
    has_styles: bool = Field(default=False, alias="hasStyles")


class DesignMetadata(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    file_key: Optional[str] = Field(default=None, alias="fileKey")
    file_name: Optional[str] = Field(default=None, alias="fileName")
    project_id: Optional[str] = Field(default=None, alias="projectId")
    analyzed_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        alias="analyzedAt",
    )


class DesignAnalysisResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    success: bool = Field(default=True)
    request_id: str = Field(..., alias="requestId", description="Matching request tracking ID")
    status: str = Field(
        default="validated",
        description="Processing status: 'validated', 'received', 'pending_geometry_reasoning'",
    )
    service_version: str = Field(..., alias="serviceVersion", description="Python AI service version")
    node_count: int = Field(..., alias="nodeCount", description="Total number of processed nodes")
    metadata: DesignMetadata = Field(..., description="Extracted design metadata")
    summary: NodeBreakdown = Field(..., description="Structural node and layer statistics")
    capabilities: Dict[str, str] = Field(
        ...,
        description="Detailed execution status per capability ('completed' vs 'pending')",
    )
    message: str = Field(..., description="Status summary message")

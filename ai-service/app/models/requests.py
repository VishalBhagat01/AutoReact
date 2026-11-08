from typing import Any, Dict, List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field
from app.models.design import NormalizedNode


class DesignAnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    request_id: str = Field(
        default_factory=lambda: f"req_{uuid.uuid4().hex[:12]}",
        alias="requestId",
        description="Unique request tracking identifier",
    )
    file_key: Optional[str] = Field(
        default=None,
        alias="fileKey",
        description="Figma file identifier",
    )
    file_name: Optional[str] = Field(
        default="Untitled Design",
        alias="fileName",
        description="Figma document or project name",
    )
    project_id: Optional[str] = Field(
        default=None,
        alias="projectId",
        description="Associated MongoDB project ID if persisted",
    )
    tree: Optional[NormalizedNode] = Field(
        default=None,
        description="Root normalized node or single frame AST",
    )
    pages: Optional[List[NormalizedNode]] = Field(
        default=None,
        description="List of canvas page ASTs",
    )
    nodes: Optional[List[NormalizedNode]] = Field(
        default=None,
        description="Selective list of individual component AST nodes",
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Design metadata passed from Node.js",
    )
    options: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Processing options and toggles",
    )

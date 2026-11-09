from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class IRSemantics(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    type: str = Field(default="Unknown")
    confidence: float = Field(default=0.1)
    evidence: List[str] = Field(default_factory=list)
    classification_source: str = Field(default="heuristic", alias="classificationSource")
    is_explicit: bool = Field(default=False, alias="isExplicit")


class IRBounds(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    x: float = Field(default=0.0)
    y: float = Field(default=0.0)
    width: float = Field(default=0.0)
    height: float = Field(default=0.0)


class IRLayout(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    mode: str = Field(default="NONE")
    direction: str = Field(default="none")
    gap: float = Field(default=0.0)
    padding: Optional[Dict[str, float]] = None
    justify_content: str = Field(default="flex-start", alias="justifyContent")
    align_items: str = Field(default="stretch", alias="alignItems")
    wrap: bool = Field(default=False)
    sizing: Optional[Dict[str, str]] = None


class IRNode(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: str
    figma_id: Optional[str] = Field(default=None, alias="figmaId")
    name: str = Field(default="Node")
    type: str = Field(default="FRAME")
    semantic_type: str = Field(default="Unknown", alias="semanticType")
    semantics: Optional[IRSemantics] = None
    bounds: IRBounds = Field(default_factory=IRBounds)
    relative_bounds: Optional[IRBounds] = Field(default=None, alias="relativeBounds")
    layout: Optional[IRLayout] = None
    styles: Optional[Dict[str, Any]] = None
    typography: Optional[Dict[str, Any]] = None
    effects: List[Dict[str, Any]] = Field(default_factory=list)
    fills: List[Dict[str, Any]] = Field(default_factory=list)
    strokes: Optional[Any] = None
    assets: List[Dict[str, Any]] = Field(default_factory=list)
    text: Optional[str] = None
    children: List["IRNode"] = Field(default_factory=list)
    relationships: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None


class IRPage(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: str
    name: str = Field(default="Page")
    dimensions: Optional[Dict[str, float]] = None
    sections: List[str] = Field(default_factory=list)
    children: List[IRNode] = Field(default_factory=list)
    metadata: Optional[Dict[str, Any]] = None


class IRComponent(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: str
    name: str
    source_node_id: str = Field(..., alias="sourceNodeId")
    component_type: str = Field(default="native_figma", alias="componentType")
    variants: List[Dict[str, Any]] = Field(default_factory=list)
    properties: Dict[str, Any] = Field(default_factory=dict)
    dependencies: Optional[Dict[str, Any]] = None
    children: Optional[Any] = None


class IRAsset(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    asset_id: str = Field(..., alias="assetId")
    source_node_id: Optional[str] = Field(default=None, alias="sourceNodeId")
    asset_type: str = Field(default="image", alias="assetType")
    format: str = Field(default="png")
    storage_reference: str = Field(default="", alias="storageReference")
    dimensions: Optional[Dict[str, Optional[float]]] = None
    file_size: Optional[int] = Field(default=0, alias="fileSize")
    mime_type: Optional[str] = Field(default=None, alias="mimeType")
    checksum: Optional[str] = None


class DesignIRDocument(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    document_id: str = Field(..., alias="documentId")
    file_key: str = Field(..., alias="fileKey")
    file_name: str = Field(default="Untitled Design", alias="fileName")
    version: str = Field(default="1.0.0")
    metadata: Dict[str, Any] = Field(default_factory=dict)
    pages: List[IRPage] = Field(default_factory=list)
    assets: List[IRAsset] = Field(default_factory=list)
    components: List[IRComponent] = Field(default_factory=list)
    tokens: Dict[str, Any] = Field(default_factory=dict)
    relationships: Dict[str, Any] = Field(default_factory=dict)


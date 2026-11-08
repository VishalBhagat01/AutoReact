from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class Bounds(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    x: float = Field(default=0.0, description="X coordinate")
    y: float = Field(default=0.0, description="Y coordinate")
    width: float = Field(default=0.0, description="Width in pixels")
    height: float = Field(default=0.0, description="Height in pixels")


class Padding(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    top: Optional[float] = None
    right: Optional[float] = None
    bottom: Optional[float] = None
    left: Optional[float] = None
    all: Optional[float] = None


class Layout(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    mode: Optional[str] = Field(default=None, description="Layout mode: 'row', 'column', or 'none'")
    justify_content: Optional[str] = Field(default=None, alias="justifyContent")
    align_items: Optional[str] = Field(default=None, alias="alignItems")
    gap: Optional[float] = None
    padding: Optional[Any] = None
    wrap: Optional[bool] = None


class Typography(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    font_family: Optional[str] = Field(default=None, alias="fontFamily")
    font_weight: Optional[Any] = Field(default=None, alias="fontWeight")
    font_size: Optional[float] = Field(default=None, alias="fontSize")
    line_height: Optional[Any] = Field(default=None, alias="lineHeight")
    letter_spacing: Optional[Any] = Field(default=None, alias="letterSpacing")
    text_align: Optional[str] = Field(default=None, alias="textAlign")


class Styles(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    colors: Optional[List[Any]] = None
    typography: Optional[Typography] = None
    border_radius: Optional[Any] = Field(default=None, alias="borderRadius")
    stroke: Optional[Any] = None
    effects: Optional[List[Any]] = None
    images: Optional[List[Any]] = None


class NormalizedNode(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: str = Field(..., description="Unique Figma or AST node ID")
    name: str = Field(default="Unnamed Node", description="Figma layer name")
    type: str = Field(default="FRAME", description="Figma node type: FRAME, TEXT, COMPONENT, etc.")
    bounds: Optional[Bounds] = None
    layout: Optional[Layout] = None
    styles: Optional[Styles] = None
    text: Optional[str] = None
    semantic: Optional[Dict[str, Any]] = None
    responsive: Optional[Dict[str, Any]] = None
    children: Optional[List["NormalizedNode"]] = None
    component_metadata: Optional[Dict[str, Any]] = Field(default=None, alias="componentMetadata")


NormalizedNode.model_rebuild()

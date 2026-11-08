from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.core.config import settings
from app.core.logging import logger
from app.engine.component_detector import detect_repeated_components
from app.engine.geometry import extract_bounding_box
from app.engine.graph_builder import build_design_relationship_graph
from app.engine.layout_inference import infer_node_layout
from app.engine.spatial import analyze_sibling_spatial_relationships
from app.models.design import NormalizedNode
from app.models.geometry import (
    AlignmentRelation,
    BoundingBox,
    DetectedComponent,
    GeometryAnalysisResult,
    GridCluster,
    LayoutInference,
    OverlapRelation,
    RelationshipGraphData,
    SpacingRelation,
)
from app.models.requests import DesignAnalysisRequest
from app.models.responses import (
    DesignAnalysisResponse,
    DesignMetadata,
    NodeBreakdown,
)


class DesignService:
    """
    Design intelligence service.
    Orchestrates deterministic geometry engine, spatial relationships,
    layout pattern inference, component detection, and relationship graph generation.
    """

    def analyze_design(self, request: DesignAnalysisRequest) -> DesignAnalysisResponse:
        """
        Process normalized design payload, compute structural metrics,
        execute geometry analysis, layout inference, and relationship graph generation.
        """
        logger.info(
            f"Analyzing design payload [req_id={request.request_id}] "
            f"file_key={request.file_key or 'n/a'} file_name={request.file_name}"
        )

        root_nodes = self._extract_root_nodes(request)
        breakdown = self._compute_node_breakdown(root_nodes)

        # Execute geometry analysis and relationship graph
        graph_data = build_design_relationship_graph(root_nodes, tolerance=3.0)
        all_flattened = self._flatten_nodes(root_nodes)
        detected_comps = detect_repeated_components(all_flattened)
        inferred_layouts = self._infer_all_layouts(root_nodes)

        capabilities_status = {
            "payload_validation": "completed",
            "metadata_extraction": "completed",
            "node_counting": "completed",
            "structural_inspection": "completed",
            "geometry_spatial_analysis": "completed",
            "relationship_graph": "completed",
            "layout_inference": "completed",
            "repeated_component_detection": "completed",
            "semantic_reasoning": "pending",
            "code_generation": "pending",
        }

        metadata = DesignMetadata(
            file_key=request.file_key,
            file_name=request.file_name,
            project_id=request.project_id,
            analyzed_at=datetime.now(timezone.utc).isoformat(),
        )

        message = (
            f"Validated design AST payload with {breakdown.total_nodes} node(s). "
            f"Geometry analysis and relationship graph completed successfully "
            f"({graph_data.edge_count} edges, {len(detected_comps)} components detected)."
        )

        return DesignAnalysisResponse(
            success=True,
            request_id=request.request_id,
            status="analyzed",
            service_version=settings.SERVICE_VERSION,
            node_count=breakdown.total_nodes,
            metadata=metadata,
            summary=breakdown,
            capabilities=capabilities_status,
            message=message,
            graph=graph_data,
            inferred_layouts=inferred_layouts,
            detected_components=detected_comps,
            geometry_summary={
                "total_edges": graph_data.edge_count,
                "edge_types": graph_data.edge_type_distribution,
                "warnings_count": len(graph_data.analysis_warnings),
            },
        )

    def analyze_geometry(self, request: DesignAnalysisRequest) -> GeometryAnalysisResult:
        """
        Deep geometry analysis: bounding boxes, alignments, spacing, overlaps, and grid clusters.
        """
        root_nodes = self._extract_root_nodes(request)
        all_nodes = self._flatten_nodes(root_nodes)

        bounds_map: Dict[str, BoundingBox] = {}
        alignments: List[AlignmentRelation] = []
        spacings: List[SpacingRelation] = []
        overlaps: List[OverlapRelation] = []
        grid_clusters: List[GridCluster] = []
        warnings: List[str] = []

        # 1. Bounds for all nodes
        for node in all_nodes:
            nid = getattr(node, "id", None) or (node.get("id") if isinstance(node, dict) else str(id(node)))
            box = extract_bounding_box(node)
            bounds_map[nid] = box
            if not box.is_valid:
                warnings.append(f"Node '{nid}' has zero or missing geometry")

        # 2. Container-level spatial analysis (hierarchy-scoped for performance)
        def process_container_spatial(node: Any):
            raw_children = getattr(node, "children", None) or (node.get("children") if isinstance(node, dict) else [])
            if raw_children and len(raw_children) >= 2:
                spatial_res = analyze_sibling_spatial_relationships(raw_children, tolerance=3.0)
                alignments.extend(spatial_res.get("alignments", []))
                spacings.extend(spatial_res.get("spacings", []))
                overlaps.extend(spatial_res.get("overlaps", []))
                grid_clusters.extend(spatial_res.get("grid_clusters", []))

            for child in raw_children or []:
                process_container_spatial(child)

        for root in root_nodes:
            process_container_spatial(root)

        # 3. Layout inference and component detection
        inferred_layouts = self._infer_all_layouts(root_nodes)
        detected_comps = detect_repeated_components(all_nodes)
        graph_data = build_design_relationship_graph(root_nodes, tolerance=3.0)

        return GeometryAnalysisResult(
            success=True,
            request_id=request.request_id,
            node_count=len(all_nodes),
            bounds_by_node_id=bounds_map,
            alignments=alignments,
            spacings=spacings,
            overlaps=overlaps,
            grid_clusters=grid_clusters,
            inferred_layouts=inferred_layouts,
            detected_components=detected_comps,
            graph=graph_data,
            warnings=list(set(warnings + graph_data.analysis_warnings)),
        )

    def infer_layout(self, request: DesignAnalysisRequest) -> List[LayoutInference]:
        """
        Infer deterministic layout patterns for all containers in design payload.
        """
        root_nodes = self._extract_root_nodes(request)
        return self._infer_all_layouts(root_nodes)

    def generate_graph(self, request: DesignAnalysisRequest) -> RelationshipGraphData:
        """
        Generate complete NetworkX relationship graph for design payload.
        """
        root_nodes = self._extract_root_nodes(request)
        return build_design_relationship_graph(root_nodes, tolerance=3.0)

    def detect_components(self, request: DesignAnalysisRequest) -> List[DetectedComponent]:
        """
        Detect native Figma components and inferred reusable patterns.
        """
        root_nodes = self._extract_root_nodes(request)
        all_nodes = self._flatten_nodes(root_nodes)
        return detect_repeated_components(all_nodes)

    def _extract_root_nodes(self, request: DesignAnalysisRequest) -> List[Any]:
        """Extract all candidate root nodes from request payload."""
        root_nodes: List[Any] = []
        if request.tree:
            root_nodes.append(request.tree)
        if request.pages:
            root_nodes.extend(request.pages)
        if request.nodes:
            root_nodes.extend(request.nodes)
        return root_nodes

    def _flatten_nodes(self, roots: List[Any]) -> List[Any]:
        """Flatten AST hierarchy into a list of all nodes."""
        flattened: List[Any] = []

        def traverse(node: Any):
            if node is None:
                return
            flattened.append(node)
            raw_children = getattr(node, "children", None) or (node.get("children") if isinstance(node, dict) else [])
            for child in raw_children or []:
                traverse(child)

        for root in roots:
            traverse(root)

        return flattened

    def _infer_all_layouts(self, roots: List[Any]) -> List[LayoutInference]:
        """Traverse tree and infer layout for all container frames."""
        layouts: List[LayoutInference] = []

        def traverse(node: Any):
            if node is None:
                return
            raw_children = getattr(node, "children", None) or (node.get("children") if isinstance(node, dict) else [])
            ntype = (getattr(node, "type", None) or (node.get("type") if isinstance(node, dict) else "")).upper()

            if raw_children or ntype in {"FRAME", "GROUP", "SECTION", "COMPONENT", "COMPONENT_SET", "INSTANCE"}:
                inf = infer_node_layout(node, raw_children)
                layouts.append(inf)

            for child in raw_children or []:
                traverse(child)

        for root in roots:
            traverse(root)

        return layouts

    def _compute_node_breakdown(self, roots: List[Any]) -> NodeBreakdown:
        """Recursively traverse nodes and compute structural counts and properties."""
        total = 0
        containers = 0
        text_nodes = 0
        vectors = 0
        instances = 0
        max_depth = 0
        has_layout = False
        has_styles = False

        container_types = {"FRAME", "GROUP", "SECTION", "COMPONENT", "COMPONENT_SET", "CANVAS"}
        vector_types = {"VECTOR", "STAR", "LINE", "ELLIPSE", "POLYGON", "BOOLEAN_OPERATION", "RECTANGLE"}

        def traverse(node: Any, current_depth: int):
            nonlocal total, containers, text_nodes, vectors, instances, max_depth, has_layout, has_styles
            total += 1
            if current_depth > max_depth:
                max_depth = current_depth

            node_type = (getattr(node, "type", None) or (node.get("type") if isinstance(node, dict) else "")).upper()
            if node_type in container_types:
                containers += 1
            elif node_type == "TEXT":
                text_nodes += 1
            elif node_type in vector_types:
                vectors += 1

            if node_type == "INSTANCE":
                instances += 1

            layout = getattr(node, "layout", None) or (node.get("layout") if isinstance(node, dict) else None)
            if layout:
                has_layout = True

            styles = getattr(node, "styles", None) or (node.get("styles") if isinstance(node, dict) else None)
            if styles:
                has_styles = True

            raw_children = getattr(node, "children", None) or (node.get("children") if isinstance(node, dict) else [])
            for child in raw_children or []:
                traverse(child, current_depth + 1)

        for root in roots:
            traverse(root, current_depth=1)

        return NodeBreakdown(
            total_nodes=total,
            container_nodes=containers,
            text_nodes=text_nodes,
            vector_nodes=vectors,
            component_instances=instances,
            max_tree_depth=max_depth,
            has_layout=has_layout,
            has_styles=has_styles,
        )


design_service = DesignService()

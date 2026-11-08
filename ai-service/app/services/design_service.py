from datetime import datetime, timezone
from typing import List, Optional
from app.core.config import settings
from app.core.logging import logger
from app.models.design import NormalizedNode
from app.models.requests import DesignAnalysisRequest
from app.models.responses import (
    DesignAnalysisResponse,
    DesignMetadata,
    NodeBreakdown,
)


class DesignService:
    """
    Design processing service.
    Validates design AST payloads, computes structural metrics, and reports
    capabilities status for subsequent geometry, relationship graph, and code-gen milestones.
    """

    def analyze_design(self, request: DesignAnalysisRequest) -> DesignAnalysisResponse:
        """
        Process normalized design payload and return validated inspection and metadata.
        """
        logger.info(
            f"Analyzing design payload [req_id={request.request_id}] "
            f"file_key={request.file_key or 'n/a'} file_name={request.file_name}"
        )

        # Collect root nodes from tree, pages, or selective nodes list
        root_nodes: List[NormalizedNode] = []
        if request.tree:
            root_nodes.append(request.tree)
        if request.pages:
            root_nodes.extend(request.pages)
        if request.nodes:
            root_nodes.extend(request.nodes)

        # Compute accurate node breakdown and metrics
        breakdown = self._compute_node_breakdown(root_nodes)

        # Formulate capability execution status
        capabilities_status = {
            "payload_validation": "completed",
            "metadata_extraction": "completed",
            "node_counting": "completed",
            "structural_inspection": "completed",
            "geometry_spatial_analysis": "pending",
            "semantic_reasoning": "pending",
            "relationship_graph": "pending",
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
            f"Structural inspection complete; advanced geometry and semantic AI reasoning pending."
        )

        return DesignAnalysisResponse(
            success=True,
            request_id=request.request_id,
            status="validated",
            service_version=settings.SERVICE_VERSION,
            node_count=breakdown.total_nodes,
            metadata=metadata,
            summary=breakdown,
            capabilities=capabilities_status,
            message=message,
        )

    def _compute_node_breakdown(self, roots: List[NormalizedNode]) -> NodeBreakdown:
        """
        Recursively traverse nodes and compute structural counts and properties.
        """
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

        def traverse(node: NormalizedNode, current_depth: int):
            nonlocal total, containers, text_nodes, vectors, instances, max_depth, has_layout, has_styles
            total += 1
            if current_depth > max_depth:
                max_depth = current_depth

            node_type = (node.type or "").upper()
            if node_type in container_types:
                containers += 1
            elif node_type == "TEXT":
                text_nodes += 1
            elif node_type in vector_types:
                vectors += 1

            if node_type == "INSTANCE":
                instances += 1

            if node.layout and (node.layout.mode or node.layout.gap is not None):
                has_layout = True

            if node.styles and (node.styles.colors or node.styles.typography or node.styles.border_radius):
                has_styles = True

            if node.children:
                for child in node.children:
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

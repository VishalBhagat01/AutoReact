from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple
import networkx as nx

from app.engine.component_detector import detect_repeated_components
from app.engine.geometry import compute_relative_bounds, extract_bounding_box
from app.engine.layout_inference import infer_node_layout
from app.engine.spatial import analyze_sibling_spatial_relationships, sort_nodes_reading_order
from app.models.geometry import (
    BoundingBox,
    DetectedComponent,
    GraphEdge,
    GraphNode,
    LayoutInference,
    RelationshipGraphData,
)


STANDARDIZED_NODE_TYPES = {
    "FRAME": "FRAME",
    "GROUP": "FRAME",
    "SECTION": "FRAME",
    "CANVAS": "FRAME",
    "COMPONENT": "COMPONENT",
    "COMPONENT_SET": "COMPONENT_SET",
    "INSTANCE": "INSTANCE",
    "TEXT": "TEXT",
    "VECTOR": "VECTOR",
    "STAR": "VECTOR",
    "LINE": "VECTOR",
    "ELLIPSE": "VECTOR",
    "POLYGON": "VECTOR",
    "BOOLEAN_OPERATION": "VECTOR",
    "RECTANGLE": "VECTOR",
    "IMAGE": "IMAGE",
}


def build_design_relationship_graph(
    root_nodes: List[Any],
    tolerance: float = 3.0,
) -> RelationshipGraphData:
    """
    Construct complete deterministic design relationship graph using NetworkX.
    Preserves original Figma hierarchy and integrates spatial, geometric, and component relationships.
    """
    g = nx.DiGraph()
    warnings: List[str] = []

    # Flatten and collect all nodes while preserving hierarchy
    all_nodes_list: List[Any] = []
    parent_map: Dict[str, str] = {}
    children_map: Dict[str, List[Any]] = defaultdict(list)
    bounds_map: Dict[str, BoundingBox] = {}

    def collect_hierarchy(node: Any, parent_id: Optional[str] = None, depth: int = 1):
        if node is None:
            return

        nid = getattr(node, "id", None) or (node.get("id") if isinstance(node, dict) else str(id(node)))
        all_nodes_list.append(node)
        box = extract_bounding_box(node)
        bounds_map[nid] = box

        if not box.is_valid:
            warnings.append(f"Node '{nid}' has zero or missing geometry bounds")

        if depth > 10:
            warnings.append(f"Deeply nested hierarchy detected at node '{nid}' (depth={depth})")

        if parent_id:
            parent_map[nid] = parent_id
            children_map[parent_id].append(node)

        raw_children = getattr(node, "children", None)
        if raw_children is None and isinstance(node, dict):
            raw_children = node.get("children", [])

        for child in raw_children or []:
            collect_hierarchy(child, parent_id=nid, depth=depth + 1)

    for root in root_nodes:
        collect_hierarchy(root, parent_id=None, depth=1)

    # 1. Run component detection
    detected_components = detect_repeated_components(all_nodes_list)
    component_membership: Dict[str, str] = {}
    for comp in detected_components:
        for inst_id in comp.instance_node_ids:
            component_membership[inst_id] = comp.component_id

    # 2. Add Graph Nodes
    inferred_layouts_by_node: Dict[str, LayoutInference] = {}

    for node in all_nodes_list:
        nid = getattr(node, "id", None) or (node.get("id") if isinstance(node, dict) else str(id(node)))
        nname = getattr(node, "name", "") or (node.get("name") if isinstance(node, dict) else "Node")
        raw_type = (getattr(node, "type", None) or (node.get("type") if isinstance(node, dict) else "OTHER")).upper()
        std_type = STANDARDIZED_NODE_TYPES.get(raw_type, "OTHER")

        box = bounds_map.get(nid, extract_bounding_box(node))
        node_children = children_map.get(nid, [])

        # Layout inference for container nodes
        layout_pattern = None
        if len(node_children) > 0 or std_type in {"FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE"}:
            layout_inf = infer_node_layout(node, node_children)
            inferred_layouts_by_node[nid] = layout_inf
            layout_pattern = layout_inf.pattern

        # Relative bounds
        parent_id = parent_map.get(nid)
        rel_bounds = None
        if parent_id and parent_id in bounds_map:
            rel_bounds = compute_relative_bounds(box, bounds_map[parent_id])

        is_comp = nid in component_membership or std_type in {"COMPONENT", "COMPONENT_SET", "INSTANCE"}
        comp_id = component_membership.get(nid)

        g.add_node(
            nid,
            id=nid,
            name=nname,
            type=std_type,
            bounds=box,
            relative_bounds=rel_bounds,
            inferred_layout=layout_pattern,
            is_component=is_comp,
            component_id=comp_id,
        )

    # 3. Add Edges: PARENT_OF & DEPENDS_ON (Figma hierarchy)
    for child_id, parent_id in parent_map.items():
        if g.has_node(parent_id) and g.has_node(child_id):
            g.add_edge(
                parent_id,
                child_id,
                type="PARENT_OF",
                confidence=1.0,
                metadata={"relationship": "hierarchy"},
            )
            g.add_edge(
                child_id,
                parent_id,
                type="DEPENDS_ON",
                confidence=0.95,
                metadata={"dependency": "layout_parent"},
            )

    # 4. Add Edges within each container (Sibling spatial relationships)
    for parent_id, siblings in children_map.items():
        if len(siblings) < 2:
            continue

        # Spatial analysis among siblings
        spatial_data = analyze_sibling_spatial_relationships(siblings, tolerance=tolerance)

        # A. ALIGNED_WITH edges
        for al in spatial_data.get("alignments", []):
            if g.has_node(al.node_a_id) and g.has_node(al.node_b_id):
                g.add_edge(
                    al.node_a_id,
                    al.node_b_id,
                    type="ALIGNED_WITH",
                    confidence=al.confidence,
                    metadata={"axis": al.axis, "alignment_type": al.alignment_type, "offset": al.offset},
                )
                g.add_edge(
                    al.node_b_id,
                    al.node_a_id,
                    type="ALIGNED_WITH",
                    confidence=al.confidence,
                    metadata={"axis": al.axis, "alignment_type": al.alignment_type, "offset": al.offset},
                )

        # B. NEXT_TO edges (consecutive in natural reading order)
        sorted_siblings = sort_nodes_reading_order(siblings)
        for i in range(len(sorted_siblings) - 1):
            curr_id = getattr(sorted_siblings[i], "id", None) or (sorted_siblings[i].get("id") if isinstance(sorted_siblings[i], dict) else "")
            next_id = getattr(sorted_siblings[i + 1], "id", None) or (sorted_siblings[i + 1].get("id") if isinstance(sorted_siblings[i + 1], dict) else "")
            if curr_id and next_id and g.has_node(curr_id) and g.has_node(next_id):
                b_curr = bounds_map.get(curr_id)
                b_next = bounds_map.get(next_id)
                gap = round(b_next.x - b_curr.right, 2) if b_curr and b_next else 0.0
                g.add_edge(
                    curr_id,
                    next_id,
                    type="NEXT_TO",
                    confidence=0.95,
                    metadata={"gap": gap, "direction": "reading_order"},
                )

        # C. CONTAINS & Overlaps
        for ov in spatial_data.get("overlaps", []):
            if ov.is_containment and ov.container_id:
                contained_id = ov.node_b_id if ov.container_id == ov.node_a_id else ov.node_a_id
                if g.has_node(ov.container_id) and g.has_node(contained_id):
                    g.add_edge(
                        ov.container_id,
                        contained_id,
                        type="CONTAINS",
                        confidence=0.90,
                        metadata={"spatial_containment": True, "area": ov.intersection_area},
                    )
            elif ov.intersection_area > 0 and not ov.is_containment:
                warnings.append(
                    f"Overlapping uncontained elements: '{ov.node_a_id}' and '{ov.node_b_id}' "
                    f"(overlap area: {ov.intersection_area}px²)"
                )

        # D. GROUPED_WITH edges (Grid clusters)
        for grid in spatial_data.get("grid_clusters", []):
            # Connect items in same row
            for row in grid.matrix:
                for idx in range(len(row) - 1):
                    id_1, id_2 = row[idx], row[idx + 1]
                    if id_1 and id_2 and g.has_node(id_1) and g.has_node(id_2):
                        g.add_edge(id_1, id_2, type="GROUPED_WITH", confidence=grid.confidence, metadata={"cluster": "grid_row"})
                        g.add_edge(id_2, id_1, type="GROUPED_WITH", confidence=grid.confidence, metadata={"cluster": "grid_row"})

    # 5. Add Edges: INSTANCE_OF & SHARES_STYLE_WITH
    for comp in detected_components:
        arch_id = comp.archetype_node_id
        for inst_id in comp.instance_node_ids:
            if inst_id != arch_id and g.has_node(inst_id) and g.has_node(arch_id):
                g.add_edge(
                    inst_id,
                    arch_id,
                    type="INSTANCE_OF",
                    confidence=comp.confidence,
                    metadata={"source": comp.source, "component_id": comp.component_id},
                )
                g.add_edge(
                    inst_id,
                    arch_id,
                    type="SHARES_STYLE_WITH",
                    confidence=comp.confidence,
                    metadata={"shared_pattern": comp.name},
                )

    # 6. Convert NetworkX graph to serializable RelationshipGraphData
    graph_nodes: List[GraphNode] = []
    for nid, attrs in g.nodes(data=True):
        graph_nodes.append(
            GraphNode(
                id=nid,
                name=attrs.get("name") or "Node",
                type=attrs.get("type") or "OTHER",
                bounds=attrs.get("bounds"),
                relative_bounds=attrs.get("relative_bounds"),
                inferred_layout=attrs.get("inferred_layout"),
                is_component=attrs.get("is_component", False),
                component_id=attrs.get("component_id"),
                metadata={},
            )
        )

    graph_edges: List[GraphEdge] = []
    edge_distribution: Dict[str, int] = defaultdict(int)

    for u, v, attrs in g.edges(data=True):
        edge_type = attrs.get("type", "DEPENDS_ON")
        edge_distribution[edge_type] += 1
        graph_edges.append(
            GraphEdge(
                source=u,
                target=v,
                type=edge_type,
                confidence=attrs.get("confidence", 1.0),
                metadata=attrs.get("metadata", {}),
            )
        )

    return RelationshipGraphData(
        nodes=graph_nodes,
        edges=graph_edges,
        node_count=len(graph_nodes),
        edge_count=len(graph_edges),
        edge_type_distribution=dict(edge_distribution),
        analysis_warnings=list(set(warnings)),
        metadata={
            "graph_engine": "NetworkX",
            "is_directed": True,
            "density": round(nx.density(g), 4) if len(graph_nodes) > 1 else 0.0,
            "detected_component_count": len(detected_components),
        },
    )

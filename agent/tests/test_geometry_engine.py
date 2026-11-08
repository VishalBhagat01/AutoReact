import pytest
from app.engine.component_detector import detect_repeated_components
from app.engine.geometry import (
    compute_box_overlap,
    compute_relative_bounds,
    detect_alignments,
    extract_bounding_box,
)
from app.engine.graph_builder import build_design_relationship_graph
from app.engine.layout_inference import infer_node_layout
from app.engine.spatial import analyze_sibling_spatial_relationships, detect_grid_clusters, sort_nodes_reading_order
from app.models.geometry import BoundingBox


def test_bounding_box_extraction_and_safe_fallback():
    """Test safe extraction of BoundingBox from various representations including missing geometry."""
    # From bounds object
    node1 = {"id": "1", "bounds": {"x": 10, "y": 20, "width": 100, "height": 50}}
    box1 = extract_bounding_box(node1)
    assert box1.is_valid is True
    assert box1.x == 10.0
    assert box1.y == 20.0
    assert box1.width == 100.0
    assert box1.height == 50.0
    assert box1.right == 110.0
    assert box1.bottom == 70.0
    assert box1.center_x == 60.0
    assert box1.center_y == 45.0
    assert box1.area == 5000.0

    # From missing / None
    box_empty = extract_bounding_box(None)
    assert box_empty.is_valid is False
    assert box_empty.width == 0.0

    # From node with zero dimensions
    node_zero = {"id": "2", "bounds": {"x": 0, "y": 0, "width": 0, "height": 0}}
    box_zero = extract_bounding_box(node_zero)
    assert box_zero.is_valid is False


def test_relative_bounds_computation():
    """Test relative bounds of a child inside its parent frame."""
    parent_box = BoundingBox(x=100, y=100, width=500, height=400, right=600, bottom=500)
    child_box = BoundingBox(x=140, y=130, width=200, height=50, right=340, bottom=180)

    rel = compute_relative_bounds(child_box, parent_box)
    assert rel.rel_x == 40.0
    assert rel.rel_y == 30.0
    assert rel.rel_right == 260.0  # 600 - 340
    assert rel.rel_bottom == 320.0  # 500 - 180


def test_alignment_detection_with_tolerances():
    """Test detection of top, bottom, center_y, left, right, and center_x alignments within tolerance."""
    # Top aligned with 1.5px difference (within 3px tolerance)
    box_a = BoundingBox(x=10, y=50, width=100, height=40, right=110, bottom=90, center_x=60, center_y=70)
    box_b = BoundingBox(x=130, y=51.5, width=80, height=40, right=210, bottom=91.5, center_x=170, center_y=71.5)

    alignments = detect_alignments(box_a, "node_a", box_b, "node_b", tolerance=3.0)
    alignment_types = [a.alignment_type for a in alignments]

    assert "top" in alignment_types
    assert "bottom" in alignment_types
    assert "center_y" in alignment_types

    # Vertical alignment (left and center_x)
    box_top = BoundingBox(x=100, y=20, width=120, height=30, right=220, bottom=50, center_x=160, center_y=35)
    box_bottom = BoundingBox(x=101, y=80, width=120, height=60, right=221, bottom=140, center_x=161, center_y=110)

    v_alignments = detect_alignments(box_top, "top", box_bottom, "bottom", tolerance=3.0)
    v_types = [a.alignment_type for a in v_alignments]

    assert "left" in v_types
    assert "right" in v_types
    assert "center_x" in v_types


def test_spacing_and_gap_detection():
    """Test detection of equal horizontal and vertical spacing among siblings."""
    # 3 items horizontally spaced with exact 16px gap
    siblings = [
        {"id": "c1", "bounds": {"x": 0, "y": 0, "width": 80, "height": 40}},
        {"id": "c2", "bounds": {"x": 96, "y": 0, "width": 80, "height": 40}},   # gap: 96 - 80 = 16
        {"id": "c3", "bounds": {"x": 192, "y": 0, "width": 80, "height": 40}},  # gap: 192 - 176 = 16
    ]

    res = analyze_sibling_spatial_relationships(siblings)
    spacings = res["spacings"]
    h_spacings = [s for s in spacings if s.direction == "horizontal"]

    assert len(h_spacings) == 2
    assert h_spacings[0].gap == 16.0
    assert h_spacings[1].gap == 16.0
    assert h_spacings[0].is_consistent is True
    assert h_spacings[1].is_consistent is True


def test_overlap_and_containment():
    """Test AABB overlap and spatial containment detection."""
    # Container fully containing child
    box_parent = BoundingBox(x=50, y=50, width=300, height=200, right=350, bottom=250, area=60000)
    box_child = BoundingBox(x=70, y=70, width=100, height=50, right=170, bottom=120, area=5000)

    overlap = compute_box_overlap(box_parent, "parent", box_child, "child")
    assert overlap is not None
    assert overlap.is_containment is True
    assert overlap.container_id == "parent"
    assert overlap.intersection_area == 5000.0

    # Partial overlap (badge hovering over top-right corner of card)
    box_card = BoundingBox(x=100, y=100, width=200, height=200, right=300, bottom=300, area=40000)
    box_badge = BoundingBox(x=280, y=85, width=40, height=40, right=320, bottom=125, area=1600)

    partial_overlap = compute_box_overlap(box_card, "card", box_badge, "badge")
    assert partial_overlap is not None
    assert partial_overlap.intersection_area > 0.0


def test_grid_cluster_detection():
    """Test detection of 2D grid matrix structure (2 rows x 3 columns)."""
    # 6 cards arranged in 2 rows of 3
    boxes = []
    # Row 1 (y = 50)
    boxes.append(("cell_0_0", BoundingBox(x=50, y=50, width=100, height=80, right=150, bottom=130, area=8000), {}))
    boxes.append(("cell_0_1", BoundingBox(x=170, y=50, width=100, height=80, right=270, bottom=130, area=8000), {}))
    boxes.append(("cell_0_2", BoundingBox(x=290, y=50, width=100, height=80, right=390, bottom=130, area=8000), {}))
    # Row 2 (y = 150)
    boxes.append(("cell_1_0", BoundingBox(x=50, y=150, width=100, height=80, right=150, bottom=230, area=8000), {}))
    boxes.append(("cell_1_1", BoundingBox(x=170, y=150, width=100, height=80, right=270, bottom=230, area=8000), {}))
    boxes.append(("cell_1_2", BoundingBox(x=290, y=150, width=100, height=80, right=390, bottom=230, area=8000), {}))

    grids = detect_grid_clusters(boxes)
    assert len(grids) == 1
    grid = grids[0]
    assert grid.rows == 2
    assert grid.columns == 3
    assert grid.cell_count == 6
    assert grid.row_gap == 20.0  # 150 - 130
    assert grid.col_gap == 20.0  # 170 - 150
    assert grid.matrix[0] == ["cell_0_0", "cell_0_1", "cell_0_2"]
    assert grid.matrix[1] == ["cell_1_0", "cell_1_1", "cell_1_2"]


def test_layout_inference_patterns():
    """Test deterministic layout inference across flex row, column, grid, and card."""
    # 1. Native Auto Layout row
    node_auto_row = {
        "id": "row_1",
        "name": "NavRow",
        "layout": {"mode": "row", "gap": 12, "justifyContent": "center"},
        "children": [{"id": "1", "type": "TEXT"}, {"id": "2", "type": "TEXT"}],
    }
    inf_row = infer_node_layout(node_auto_row)
    assert inf_row.pattern == "FLEX_ROW"
    assert inf_row.confidence >= 0.95
    assert len(inf_row.evidence) >= 1

    # 2. Geometric column flow without Auto Layout
    node_geo_col = {
        "id": "col_1",
        "name": "VerticalContainer",
        "bounds": {"x": 0, "y": 0, "width": 300, "height": 400},
        "children": [
            {"id": "c1", "type": "FRAME", "bounds": {"x": 20, "y": 20, "width": 260, "height": 60}},
            {"id": "c2", "type": "FRAME", "bounds": {"x": 20, "y": 90, "width": 260, "height": 60}},
            {"id": "c3", "type": "FRAME", "bounds": {"x": 20, "y": 160, "width": 260, "height": 60}},
        ],
    }
    inf_col = infer_node_layout(node_geo_col)
    assert inf_col.pattern == "FLEX_COLUMN"
    assert inf_col.confidence >= 0.75

    # 3. Card anatomy
    node_card = {
        "id": "card_1",
        "name": "ProductCard",
        "bounds": {"x": 0, "y": 0, "width": 280, "height": 380},
        "styles": {"borderRadius": {"all": 12}, "colors": [{"type": "SOLID", "color": "#FFF"}]},
        "children": [
            {"id": "img", "type": "IMAGE", "bounds": {"x": 10, "y": 10, "width": 260, "height": 160}},
            {"id": "title", "type": "TEXT", "bounds": {"x": 10, "y": 180, "width": 260, "height": 30}},
            {"id": "desc", "type": "TEXT", "bounds": {"x": 10, "y": 220, "width": 260, "height": 60}},
        ],
    }
    inf_card = infer_node_layout(node_card)
    assert inf_card.pattern == "CARD"
    assert inf_card.confidence >= 0.85


def test_repeated_component_detection():
    """Test detection of repeated visual patterns and native component instances."""
    # 3 repeating buttons with same structure and aspect ratio, varying text
    button_1 = {
        "id": "btn_1",
        "name": "Button",
        "type": "FRAME",
        "bounds": {"x": 50, "y": 50, "width": 140, "height": 44},
        "styles": {"borderRadius": {"all": 8}},
        "children": [{"id": "txt_1", "type": "TEXT", "text": "Save"}],
    }
    button_2 = {
        "id": "btn_2",
        "name": "Button",
        "type": "FRAME",
        "bounds": {"x": 200, "y": 50, "width": 140, "height": 44},
        "styles": {"borderRadius": {"all": 8}},
        "children": [{"id": "txt_2", "type": "TEXT", "text": "Cancel"}],
    }
    button_3 = {
        "id": "btn_3",
        "name": "Button",
        "type": "FRAME",
        "bounds": {"x": 350, "y": 50, "width": 140, "height": 44},
        "styles": {"borderRadius": {"all": 8}},
        "children": [{"id": "txt_3", "type": "TEXT", "text": "Submit"}],
    }

    all_nodes = [button_1, button_2, button_3]
    detected = detect_repeated_components(all_nodes, min_instances=2)

    assert len(detected) >= 1
    comp = detected[0]
    assert comp.source == "inferred_pattern"
    assert comp.instance_count == 3
    assert set(comp.instance_node_ids) == {"btn_1", "btn_2", "btn_3"}
    # Text variation should be detected
    var_names = [v.property_name for v in comp.variations]
    assert "text" in var_names


def test_relationship_graph_construction():
    """Test full NetworkX relationship graph construction and edge types."""
    tree = {
        "id": "root_frame",
        "name": "RootScreen",
        "type": "FRAME",
        "bounds": {"x": 0, "y": 0, "width": 800, "height": 600},
        "children": [
            {
                "id": "header",
                "name": "Header",
                "type": "FRAME",
                "bounds": {"x": 0, "y": 0, "width": 800, "height": 60},
                "children": [
                    {"id": "logo", "type": "VECTOR", "bounds": {"x": 20, "y": 15, "width": 30, "height": 30}},
                    {"id": "title", "type": "TEXT", "bounds": {"x": 60, "y": 20, "width": 120, "height": 20}},
                ],
            },
            {
                "id": "content",
                "name": "Content",
                "type": "FRAME",
                "bounds": {"x": 0, "y": 80, "width": 800, "height": 520},
                "children": [
                    {"id": "btn_a", "type": "FRAME", "bounds": {"x": 40, "y": 100, "width": 120, "height": 40}},
                    {"id": "btn_b", "type": "FRAME", "bounds": {"x": 180, "y": 100, "width": 120, "height": 40}},
                ],
            },
        ],
    }

    graph_data = build_design_relationship_graph([tree])

    assert graph_data.node_count >= 6
    assert graph_data.edge_count >= 6
    edge_types = graph_data.edge_type_distribution

    # Verify key relationship types exist
    assert "PARENT_OF" in edge_types
    assert "DEPENDS_ON" in edge_types
    assert "NEXT_TO" in edge_types
    assert "ALIGNED_WITH" in edge_types


def test_large_nested_tree_performance():
    """Performance test with large tree to ensure no quadratic explosion."""
    # Build tree with 1 root, 10 sections, each with 20 items = 201 nodes
    sections = []
    for s in range(10):
        items = []
        for i in range(20):
            items.append({
                "id": f"s{s}_item_{i}",
                "name": f"Item {i}",
                "type": "FRAME",
                "bounds": {"x": i * 60, "y": s * 80, "width": 50, "height": 40},
            })
        sections.append({
            "id": f"section_{s}",
            "name": f"Section {s}",
            "type": "FRAME",
            "bounds": {"x": 0, "y": s * 80, "width": 1200, "height": 60},
            "children": items,
        })

    large_root = {
        "id": "large_root",
        "name": "LargeRoot",
        "type": "FRAME",
        "bounds": {"x": 0, "y": 0, "width": 1200, "height": 1000},
        "children": sections,
    }

    import time
    t0 = time.perf_counter()
    graph_data = build_design_relationship_graph([large_root])
    elapsed = time.perf_counter() - t0

    assert graph_data.node_count == 211
    # Must complete fast (< 0.5s for 211 nodes)
    assert elapsed < 0.5

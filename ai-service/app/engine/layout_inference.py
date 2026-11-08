from typing import Any, Dict, List, Optional
from app.engine.geometry import extract_bounding_box
from app.engine.spatial import analyze_sibling_spatial_relationships
from app.models.geometry import BoundingBox, LayoutInference


def infer_node_layout(node: Any, children: Optional[List[Any]] = None) -> LayoutInference:
    """
    Infer the deterministic layout pattern for a container frame or component.
    Uses Figma Auto Layout properties as strong evidence.
    When Auto Layout is absent, infers cautiously from geometric relationships.
    Returns pattern name, confidence score, and supporting evidence.
    """
    node_id = getattr(node, "id", None) or (node.get("id") if isinstance(node, dict) else "unknown")
    node_name = getattr(node, "name", "") or (node.get("name") if isinstance(node, dict) else "")
    node_type = getattr(node, "type", "") or (node.get("type") if isinstance(node, dict) else "")
    bounds = extract_bounding_box(node)

    # Resolve children
    if children is None:
        children = getattr(node, "children", None)
        if children is None and isinstance(node, dict):
            children = node.get("children", [])
    children = children or []

    # 1. Check Figma Auto Layout properties (highest confidence evidence)
    layout = getattr(node, "layout", None)
    if layout is None and isinstance(node, dict):
        layout = node.get("layout")

    layout_mode = None
    gap = None
    padding = None
    justify_content = None
    align_items = None

    if layout:
        if isinstance(layout, dict):
            layout_mode = layout.get("mode")
            gap = layout.get("gap")
            padding = layout.get("padding")
            justify_content = layout.get("justifyContent")
            align_items = layout.get("alignItems")
        else:
            layout_mode = getattr(layout, "mode", None)
            gap = getattr(layout, "gap", None)
            padding = getattr(layout, "padding", None)
            justify_content = getattr(layout, "justify_content", None) or getattr(layout, "justifyContent", None)
            align_items = getattr(layout, "align_items", None) or getattr(layout, "alignItems", None)

    # If raw Figma layoutMode is present
    if not layout_mode:
        raw_mode = getattr(node, "layoutMode", None) or (node.get("layoutMode") if isinstance(node, dict) else None)
        if raw_mode == "HORIZONTAL":
            layout_mode = "row"
        elif raw_mode == "VERTICAL":
            layout_mode = "column"

    if layout_mode == "row":
        evidence = ["Native Figma Auto Layout mode is 'row' (flex-direction: row)"]
        if gap is not None:
            evidence.append(f"Configured item spacing gap: {gap}px")
        if justify_content:
            evidence.append(f"Primary axis alignment: {justify_content}")
        if align_items:
            evidence.append(f"Counter axis alignment: {align_items}")

        # Check if wide enough to be a navigation bar
        if bounds.aspect_ratio >= 3.5 and len(children) >= 2 and any("nav" in node_name.lower() or "menu" in node_name.lower() or "header" in node_name.lower() for _ in [1]):
            return LayoutInference(
                node_id=node_id,
                pattern="NAVIGATION",
                confidence=0.95,
                evidence=evidence + ["High aspect ratio horizontal bar matching navigation bar anatomy"],
                properties={"direction": "row", "gap": gap, "padding": padding},
            )

        return LayoutInference(
            node_id=node_id,
            pattern="FLEX_ROW",
            confidence=0.98,
            evidence=evidence,
            properties={"direction": "row", "gap": gap, "padding": padding},
        )

    if layout_mode == "column":
        evidence = ["Native Figma Auto Layout mode is 'column' (flex-direction: column)"]
        if gap is not None:
            evidence.append(f"Configured item spacing gap: {gap}px")
        if justify_content:
            evidence.append(f"Primary axis alignment: {justify_content}")
        if align_items:
            evidence.append(f"Counter axis alignment: {align_items}")

        # Check if container matches Card anatomy (media + text + optional CTA)
        if _is_card_anatomy(node, children, bounds):
            return LayoutInference(
                node_id=node_id,
                pattern="CARD",
                confidence=0.92,
                evidence=evidence + ["Structural visual card container with vertical content stacking"],
                properties={"direction": "column", "gap": gap, "padding": padding},
            )

        return LayoutInference(
            node_id=node_id,
            pattern="FLEX_COLUMN",
            confidence=0.98,
            evidence=evidence,
            properties={"direction": "column", "gap": gap, "padding": padding},
        )

    # 2. When Auto Layout is absent: infer cautiously from geometric relationships
    if len(children) == 0:
        return LayoutInference(
            node_id=node_id,
            pattern="ABSOLUTE",
            confidence=0.50,
            evidence=["Empty container node with no children"],
            properties={},
        )

    if len(children) == 1:
        child_box = extract_bounding_box(children[0])
        if bounds.is_valid and child_box.is_valid:
            if abs(child_box.center_x - bounds.center_x) <= 4.0 and abs(child_box.center_y - bounds.center_y) <= 4.0:
                return LayoutInference(
                    node_id=node_id,
                    pattern="STACK",
                    confidence=0.88,
                    evidence=["Single child centered horizontally and vertically inside container"],
                    properties={"centered": True},
                )
        return LayoutInference(
            node_id=node_id,
            pattern="FLEX_COLUMN",
            confidence=0.65,
            evidence=["Single child inside container; default column container flow"],
            properties={},
        )

    # 3. Analyze spatial arrangements of children
    spatial_result = analyze_sibling_spatial_relationships(children)
    grid_clusters = spatial_result.get("grid_clusters", [])

    if grid_clusters:
        grid = grid_clusters[0]
        return LayoutInference(
            node_id=node_id,
            pattern="GRID",
            confidence=grid.confidence,
            evidence=[
                f"Detected regular 2D grid of {grid.rows} rows x {grid.columns} columns",
                f"Consistent row gap: {grid.row_gap}px, column gap: {grid.col_gap}px",
                f"Uniform cell dimensions: {grid.cell_width}px x {grid.cell_height}px",
            ],
            properties={
                "rows": grid.rows,
                "columns": grid.columns,
                "rowGap": grid.row_gap,
                "colGap": grid.col_gap,
                "matrix": grid.matrix,
            },
        )

    # 4. Check for Stack or Overlay patterns (heavy overlaps among children)
    overlaps = spatial_result.get("overlaps", [])
    if overlaps:
        max_overlap = max(overlaps, key=lambda o: o.intersection_area)
        if max_overlap.overlap_ratio_a > 0.50 or max_overlap.overlap_ratio_b > 0.50:
            return LayoutInference(
                node_id=node_id,
                pattern="STACK",
                confidence=0.84,
                evidence=[
                    f"Children {max_overlap.node_a_id} and {max_overlap.node_b_id} overlap heavily "
                    f"({round(max_overlap.overlap_ratio_a * 100)}% area) indicating layered z-index stacking"
                ],
                properties={"overlapRatio": max_overlap.overlap_ratio_a},
            )

        if any(o.overlap_ratio_b < 0.30 and o.is_containment for o in overlaps):
            return LayoutInference(
                node_id=node_id,
                pattern="OVERLAY",
                confidence=0.82,
                evidence=["Small child positioned over container surface indicating floating badge or overlay"],
                properties={},
            )

    # 5. Check linear horizontal vs vertical geometric flow
    child_boxes = [extract_bounding_box(c) for c in children if extract_bounding_box(c).is_valid]
    if len(child_boxes) >= 2:
        # Sort along X
        x_sorted = sorted(child_boxes, key=lambda b: b.x)
        is_strictly_horizontal = all(
            x_sorted[i + 1].x >= x_sorted[i].right - 4.0 for i in range(len(x_sorted) - 1)
        )

        # Sort along Y
        y_sorted = sorted(child_boxes, key=lambda b: b.y)
        is_strictly_vertical = all(
            y_sorted[i + 1].y >= y_sorted[i].bottom - 4.0 for i in range(len(y_sorted) - 1)
        )

        # Horizontal alignment count
        horizontal_alignments = [a for a in spatial_result.get("alignments", []) if a.axis == "horizontal"]
        vertical_alignments = [a for a in spatial_result.get("alignments", []) if a.axis == "vertical"]

        if is_strictly_horizontal and not is_strictly_vertical:
            # Check consistent spacing
            h_spacings = [s for s in spatial_result.get("spacings", []) if s.direction == "horizontal"]
            is_consistent = any(s.is_consistent for s in h_spacings)
            avg_gap = round(sum(s.gap for s in h_spacings) / len(h_spacings), 1) if h_spacings else 0.0

            evidence = [
                "Children ordered left-to-right with clear horizontal separation",
                f"Detected {len(horizontal_alignments)} horizontal alignment relations (top/center_y)",
            ]
            if is_consistent:
                evidence.append(f"Consistent horizontal item spacing of ~{avg_gap}px")

            if bounds.aspect_ratio >= 3.5 and len(children) >= 2 and any("nav" in node_name.lower() or "menu" in node_name.lower() or "header" in node_name.lower() for _ in [1]):
                return LayoutInference(
                    node_id=node_id,
                    pattern="NAVIGATION",
                    confidence=0.90,
                    evidence=evidence + ["High aspect ratio horizontal bar matching navigation anatomy"],
                    properties={"direction": "row", "gap": avg_gap},
                )

            return LayoutInference(
                node_id=node_id,
                pattern="FLEX_ROW",
                confidence=0.85 if is_consistent else 0.76,
                evidence=evidence,
                properties={"direction": "row", "gap": avg_gap},
            )

        if is_strictly_vertical and not is_strictly_horizontal:
            v_spacings = [s for s in spatial_result.get("spacings", []) if s.direction == "vertical"]
            is_consistent = any(s.is_consistent for s in v_spacings)
            avg_gap = round(sum(s.gap for s in v_spacings) / len(v_spacings), 1) if v_spacings else 0.0

            evidence = [
                "Children ordered top-to-bottom with clear vertical separation",
                f"Detected {len(vertical_alignments)} vertical alignment relations (left/center_x)",
            ]
            if is_consistent:
                evidence.append(f"Consistent vertical item spacing of ~{avg_gap}px")

            if _is_card_anatomy(node, children, bounds):
                return LayoutInference(
                    node_id=node_id,
                    pattern="CARD",
                    confidence=0.88,
                    evidence=evidence + ["Visual card container with vertically stacked content"],
                    properties={"direction": "column", "gap": avg_gap},
                )

            return LayoutInference(
                node_id=node_id,
                pattern="FLEX_COLUMN",
                confidence=0.85 if is_consistent else 0.76,
                evidence=evidence,
                properties={"direction": "column", "gap": avg_gap},
            )

    # 6. Fallback: Absolute positioning
    return LayoutInference(
        node_id=node_id,
        pattern="ABSOLUTE",
        confidence=0.72,
        evidence=[
            "Non-auto-layout frame with irregular spatial distribution",
            "Children do not follow linear flex row, column, or grid baselines",
        ],
        properties={},
    )


def _is_card_anatomy(node: Any, children: List[Any], bounds: BoundingBox) -> bool:
    """
    Check if a container matches standard Card UI pattern.
    Characteristics:
      - Has visual surface (border radius or fill or stroke)
      - Contains combination of text, images/icons, and optional actions
      - Reasonable aspect ratio (not ultra-wide bar)
    """
    if bounds.aspect_ratio > 3.0 or bounds.aspect_ratio < 0.2:
        return False

    styles = getattr(node, "styles", None) or (node.get("styles") if isinstance(node, dict) else None)
    has_visual_surface = False
    if styles:
        if isinstance(styles, dict):
            has_visual_surface = bool(styles.get("borderRadius") or styles.get("colors") or styles.get("stroke") or styles.get("effects"))
        else:
            has_visual_surface = bool(getattr(styles, "border_radius", None) or getattr(styles, "colors", None) or getattr(styles, "stroke", None) or getattr(styles, "effects", None))

    child_types = [
        (getattr(c, "type", None) or (c.get("type") if isinstance(c, dict) else "")).upper()
        for c in children
    ]
    has_text = "TEXT" in child_types
    has_media_or_container = any(t in {"IMAGE", "VECTOR", "FRAME", "RECTANGLE"} for t in child_types)

    return (has_visual_surface and has_text and has_media_or_container and len(children) >= 2)

import math
from typing import Any, Dict, List, Optional, Tuple
from app.models.geometry import AlignmentRelation, BoundingBox, OverlapRelation, RelativeBounds


def extract_bounding_box(node: Any) -> BoundingBox:
    """
    Safely extract standardized BoundingBox from normalized node or raw Figma node dictionary.
    Handles absoluteBoundingBox, bounds, relativeTransform, and missing geometry safely.
    """
    if node is None:
        return BoundingBox(x=0.0, y=0.0, width=0.0, height=0.0, right=0.0, bottom=0.0, is_valid=False)

    # 1. Check normalized bounds object or attribute
    bounds = getattr(node, "bounds", None)
    if bounds is None and isinstance(node, dict):
        bounds = node.get("bounds") or node.get("absoluteBoundingBox") or node.get("absoluteRenderBounds")

    if bounds is not None:
        if isinstance(bounds, dict):
            x = float(bounds.get("x", 0.0) or 0.0)
            y = float(bounds.get("y", 0.0) or 0.0)
            w = float(bounds.get("width", 0.0) or 0.0)
            h = float(bounds.get("height", 0.0) or 0.0)
        else:
            x = float(getattr(bounds, "x", 0.0) or 0.0)
            y = float(getattr(bounds, "y", 0.0) or 0.0)
            w = float(getattr(bounds, "width", 0.0) or 0.0)
            h = float(getattr(bounds, "height", 0.0) or 0.0)
    else:
        # 2. Check top-level x, y, width, height
        if isinstance(node, dict):
            x = float(node.get("x", 0.0) or 0.0)
            y = float(node.get("y", 0.0) or 0.0)
            w = float(node.get("width", 0.0) or 0.0)
            h = float(node.get("height", 0.0) or 0.0)
        else:
            x = float(getattr(node, "x", 0.0) or 0.0)
            y = float(getattr(node, "y", 0.0) or 0.0)
            w = float(getattr(node, "width", 0.0) or 0.0)
            h = float(getattr(node, "height", 0.0) or 0.0)

    is_valid = (w > 0.0 or h > 0.0) and not (math.isnan(x) or math.isnan(y) or math.isnan(w) or math.isnan(h))
    w = max(0.0, w)
    h = max(0.0, h)
    right = x + w
    bottom = y + h
    center_x = x + w / 2.0
    center_y = y + h / 2.0
    area = w * h
    aspect_ratio = (w / h) if h > 0.0 else 1.0

    return BoundingBox(
        x=round(x, 2),
        y=round(y, 2),
        width=round(w, 2),
        height=round(h, 2),
        right=round(right, 2),
        bottom=round(bottom, 2),
        center_x=round(center_x, 2),
        center_y=round(center_y, 2),
        area=round(area, 2),
        aspect_ratio=round(aspect_ratio, 3),
        is_valid=is_valid,
    )


def compute_relative_bounds(child_box: BoundingBox, parent_box: BoundingBox) -> RelativeBounds:
    """
    Compute relative bounds of a child element with respect to its parent frame.
    """
    if not parent_box.is_valid or not child_box.is_valid:
        return RelativeBounds(rel_x=0.0, rel_y=0.0, rel_right=0.0, rel_bottom=0.0)

    rel_x = child_box.x - parent_box.x
    rel_y = child_box.y - parent_box.y
    rel_right = parent_box.right - child_box.right
    rel_bottom = parent_box.bottom - child_box.bottom

    return RelativeBounds(
        rel_x=round(rel_x, 2),
        rel_y=round(rel_y, 2),
        rel_right=round(rel_right, 2),
        rel_bottom=round(rel_bottom, 2),
    )


def detect_alignments(
    box_a: BoundingBox,
    id_a: str,
    box_b: BoundingBox,
    id_b: str,
    tolerance: float = 3.0,
) -> List[AlignmentRelation]:
    """
    Detect horizontal and vertical geometric alignment between two bounding boxes.
    Uses configurable tolerance rather than strict floating-point equality.
    """
    if not box_a.is_valid or not box_b.is_valid or id_a == id_b:
        return []

    alignments: List[AlignmentRelation] = []

    # Horizontal alignments (aligned along Y axis)
    top_diff = abs(box_a.y - box_b.y)
    if top_diff <= tolerance:
        alignments.append(
            AlignmentRelation(
                node_a_id=id_a,
                node_b_id=id_b,
                axis="horizontal",
                alignment_type="top",
                offset=round(top_diff, 2),
                tolerance=tolerance,
                confidence=round(1.0 - (top_diff / (tolerance + 0.01)) * 0.2, 2),
            )
        )

    bottom_diff = abs(box_a.bottom - box_b.bottom)
    if bottom_diff <= tolerance:
        alignments.append(
            AlignmentRelation(
                node_a_id=id_a,
                node_b_id=id_b,
                axis="horizontal",
                alignment_type="bottom",
                offset=round(bottom_diff, 2),
                tolerance=tolerance,
                confidence=round(1.0 - (bottom_diff / (tolerance + 0.01)) * 0.2, 2),
            )
        )

    center_y_diff = abs(box_a.center_y - box_b.center_y)
    if center_y_diff <= tolerance:
        alignments.append(
            AlignmentRelation(
                node_a_id=id_a,
                node_b_id=id_b,
                axis="horizontal",
                alignment_type="center_y",
                offset=round(center_y_diff, 2),
                tolerance=tolerance,
                confidence=round(1.0 - (center_y_diff / (tolerance + 0.01)) * 0.2, 2),
            )
        )

    # Vertical alignments (aligned along X axis)
    left_diff = abs(box_a.x - box_b.x)
    if left_diff <= tolerance:
        alignments.append(
            AlignmentRelation(
                node_a_id=id_a,
                node_b_id=id_b,
                axis="vertical",
                alignment_type="left",
                offset=round(left_diff, 2),
                tolerance=tolerance,
                confidence=round(1.0 - (left_diff / (tolerance + 0.01)) * 0.2, 2),
            )
        )

    right_diff = abs(box_a.right - box_b.right)
    if right_diff <= tolerance:
        alignments.append(
            AlignmentRelation(
                node_a_id=id_a,
                node_b_id=id_b,
                axis="vertical",
                alignment_type="right",
                offset=round(right_diff, 2),
                tolerance=tolerance,
                confidence=round(1.0 - (right_diff / (tolerance + 0.01)) * 0.2, 2),
            )
        )

    center_x_diff = abs(box_a.center_x - box_b.center_x)
    if center_x_diff <= tolerance:
        alignments.append(
            AlignmentRelation(
                node_a_id=id_a,
                node_b_id=id_b,
                axis="vertical",
                alignment_type="center_x",
                offset=round(center_x_diff, 2),
                tolerance=tolerance,
                confidence=round(1.0 - (center_x_diff / (tolerance + 0.01)) * 0.2, 2),
            )
        )

    return alignments


def compute_box_overlap(
    box_a: BoundingBox,
    id_a: str,
    box_b: BoundingBox,
    id_b: str,
    tolerance: float = 2.0,
) -> Optional[OverlapRelation]:
    """
    Compute Axis-Aligned Bounding Box (AABB) intersection and containment.
    Returns OverlapRelation if boxes intersect, or None otherwise.
    """
    if not box_a.is_valid or not box_b.is_valid or id_a == id_b:
        return None

    # Intersection coordinates
    inter_x1 = max(box_a.x, box_b.x)
    inter_y1 = max(box_a.y, box_b.y)
    inter_x2 = min(box_a.right, box_b.right)
    inter_y2 = min(box_a.bottom, box_b.bottom)

    # Check if intersection rectangle has positive area (accounting for tolerance)
    if inter_x2 > inter_x1 - tolerance and inter_y2 > inter_y1 - tolerance:
        inter_w = max(0.0, inter_x2 - inter_x1)
        inter_h = max(0.0, inter_y2 - inter_y1)
        inter_area = inter_w * inter_h

        if inter_area <= 0.0:
            return None

        ratio_a = inter_area / max(box_a.area, 0.01)
        ratio_b = inter_area / max(box_b.area, 0.01)

        # Check containment (>= 90% area overlap or bounds containment within tolerance)
        is_containment = False
        container_id = None

        a_contains_b = (
            box_a.x <= box_b.x + tolerance
            and box_a.right >= box_b.right - tolerance
            and box_a.y <= box_b.y + tolerance
            and box_a.bottom >= box_b.bottom - tolerance
        ) or (ratio_b >= 0.90)

        b_contains_a = (
            box_b.x <= box_a.x + tolerance
            and box_b.right >= box_a.right - tolerance
            and box_b.y <= box_a.y + tolerance
            and box_b.bottom >= box_a.bottom - tolerance
        ) or (ratio_a >= 0.90)

        if a_contains_b:
            is_containment = True
            container_id = id_a
        elif b_contains_a:
            is_containment = True
            container_id = id_b

        return OverlapRelation(
            node_a_id=id_a,
            node_b_id=id_b,
            intersection_area=round(inter_area, 2),
            overlap_ratio_a=round(ratio_a, 3),
            overlap_ratio_b=round(ratio_b, 3),
            is_containment=is_containment,
            container_id=container_id,
        )

    return None

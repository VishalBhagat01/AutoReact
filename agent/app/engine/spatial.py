from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple
from app.engine.geometry import compute_box_overlap, detect_alignments, extract_bounding_box
from app.models.geometry import (
    AlignmentRelation,
    BoundingBox,
    GridCluster,
    OverlapRelation,
    SpacingRelation,
)


def sort_nodes_reading_order(nodes: List[Any], row_tolerance: float = 8.0) -> List[Any]:
    """
    Sort elements into natural visual reading order: top-to-bottom, left-to-right.
    Elements sharing overlapping vertical range (within row_tolerance) are grouped in the same row
    and sorted left-to-right.
    """
    if not nodes or len(nodes) <= 1:
        return list(nodes)

    annotated = []
    for node in nodes:
        box = extract_bounding_box(node)
        annotated.append((node, box))

    # Initial sort by top Y coordinate
    annotated.sort(key=lambda item: (item[1].y, item[1].x))

    # Cluster into visual rows
    rows: List[List[Tuple[Any, BoundingBox]]] = []
    current_row: List[Tuple[Any, BoundingBox]] = []
    current_row_y = None

    for node, box in annotated:
        if not box.is_valid:
            # Place invalid bounds at the end
            continue

        if current_row_y is None:
            current_row = [(node, box)]
            current_row_y = box.y
        elif abs(box.y - current_row_y) <= row_tolerance:
            current_row.append((node, box))
        else:
            # Sort current row by X coordinate (left-to-right)
            current_row.sort(key=lambda item: item[1].x)
            rows.append(current_row)
            current_row = [(node, box)]
            current_row_y = box.y

    if current_row:
        current_row.sort(key=lambda item: item[1].x)
        rows.append(current_row)

    sorted_nodes = [item[0] for row in rows for item in row]

    # Append any nodes with missing/invalid geometry at the end preserving original relative order
    invalid_nodes = [node for node, box in annotated if not box.is_valid]
    sorted_nodes.extend(invalid_nodes)

    return sorted_nodes


def analyze_sibling_spatial_relationships(
    siblings: List[Any],
    tolerance: float = 3.0,
    gap_tolerance: float = 4.0,
) -> Dict[str, Any]:
    """
    Analyze spatial arrangements among siblings within a single container.
    Computes alignments, spacings, overlaps, and potential grid structures.
    """
    if not siblings or len(siblings) < 2:
        return {
            "alignments": [],
            "spacings": [],
            "overlaps": [],
            "grid_clusters": [],
        }

    # Extract bounds and node IDs
    boxes: List[Tuple[str, BoundingBox, Any]] = []
    for s in siblings:
        node_id = getattr(s, "id", None) or (s.get("id") if isinstance(s, dict) else str(id(s)))
        box = extract_bounding_box(s)
        if box.is_valid:
            boxes.append((node_id, box, s))

    n = len(boxes)
    if n < 2:
        return {
            "alignments": [],
            "spacings": [],
            "overlaps": [],
            "grid_clusters": [],
        }

    alignments: List[AlignmentRelation] = []
    overlaps: List[OverlapRelation] = []

    # 1. Pairwise alignments and overlaps among siblings
    for i in range(n):
        id_a, box_a, _ = boxes[i]
        for j in range(i + 1, n):
            id_b, box_b, _ = boxes[j]

            # Alignments
            detected = detect_alignments(box_a, id_a, box_b, id_b, tolerance=tolerance)
            alignments.extend(detected)

            # Overlaps & containment
            overlap = compute_box_overlap(box_a, id_a, box_b, id_b, tolerance=tolerance)
            if overlap:
                overlaps.append(overlap)

    # 2. Spacing analysis along horizontal reading order
    spacings: List[SpacingRelation] = []
    horizontal_sorted = sorted(boxes, key=lambda item: item[1].x)
    h_gaps = []

    for i in range(len(horizontal_sorted) - 1):
        id_a, box_a, _ = horizontal_sorted[i]
        id_b, box_b, _ = horizontal_sorted[i + 1]

        # Calculate horizontal clearance gap (only if box_a is strictly to the left of box_b)
        gap = round(box_b.x - box_a.right, 2)
        h_gaps.append(gap)
        spacings.append(
            SpacingRelation(
                node_a_id=id_a,
                node_b_id=id_b,
                direction="horizontal",
                gap=gap,
                is_consistent=False,
            )
        )

    # Check horizontal gap consistency
    if len(h_gaps) >= 2:
        avg_h_gap = sum(h_gaps) / len(h_gaps)
        is_consistent_h = all(abs(g - avg_h_gap) <= gap_tolerance for g in h_gaps)
        if is_consistent_h:
            for s in spacings:
                if s.direction == "horizontal":
                    s.is_consistent = True

    # 3. Spacing analysis along vertical reading order
    vertical_sorted = sorted(boxes, key=lambda item: item[1].y)
    v_gaps = []

    for i in range(len(vertical_sorted) - 1):
        id_a, box_a, _ = vertical_sorted[i]
        id_b, box_b, _ = vertical_sorted[i + 1]

        gap = round(box_b.y - box_a.bottom, 2)
        v_gaps.append(gap)
        spacings.append(
            SpacingRelation(
                node_a_id=id_a,
                node_b_id=id_b,
                direction="vertical",
                gap=gap,
                is_consistent=False,
            )
        )

    # Check vertical gap consistency
    if len(v_gaps) >= 2:
        avg_v_gap = sum(v_gaps) / len(v_gaps)
        is_consistent_v = all(abs(g - avg_v_gap) <= gap_tolerance for g in v_gaps)
        if is_consistent_v:
            for s in spacings:
                if s.direction == "vertical":
                    s.is_consistent = True

    # 4. Grid structure detection
    grid_clusters = detect_grid_clusters(boxes, tolerance=tolerance, gap_tolerance=gap_tolerance)

    return {
        "alignments": alignments,
        "spacings": spacings,
        "overlaps": overlaps,
        "grid_clusters": grid_clusters,
    }


def detect_grid_clusters(
    boxes: List[Tuple[str, BoundingBox, Any]],
    tolerance: float = 4.0,
    gap_tolerance: float = 6.0,
) -> List[GridCluster]:
    """
    Detect regular 2D grid structures (elements aligned along both rows and columns with equal spacing).
    Requires at least 2 rows and 2 columns (4 elements minimum).
    """
    if len(boxes) < 4:
        return []

    # Group by distinct Y baselines (rows)
    sorted_by_y = sorted(boxes, key=lambda b: b[1].y)
    row_groups: List[List[Tuple[str, BoundingBox, Any]]] = []

    for item in sorted_by_y:
        _, box, _ = item
        placed = False
        for row in row_groups:
            # Check if box.y aligns with row baseline
            row_baseline = sum(b[1].y for b in row) / len(row)
            if abs(box.y - row_baseline) <= tolerance:
                row.append(item)
                placed = True
                break
        if not placed:
            row_groups.append([item])

    # Filter to candidate grid rows (need at least 2 rows with matching column counts >= 2)
    if len(row_groups) < 2:
        return []

    # Sort each row left-to-right
    for row in row_groups:
        row.sort(key=lambda b: b[1].x)

    row_lengths = [len(r) for r in row_groups]
    most_common_len = max(set(row_lengths), key=row_lengths.count)

    if most_common_len < 2:
        return []

    # Select rows matching the expected column count
    matching_rows = [r for r in row_groups if len(r) == most_common_len]
    if len(matching_rows) < 2:
        return []

    num_rows = len(matching_rows)
    num_cols = most_common_len

    # Verify column X alignments across rows
    col_x_consistent = True
    for c in range(num_cols):
        col_x_values = [matching_rows[r][c][1].x for r in range(num_rows)]
        avg_col_x = sum(col_x_values) / len(col_x_values)
        if any(abs(x - avg_col_x) > tolerance * 1.5 for x in col_x_values):
            col_x_consistent = False
            break

    if not col_x_consistent:
        return []

    # Check cell width and height uniformity
    widths = [matching_rows[r][c][1].width for r in range(num_rows) for c in range(num_cols)]
    heights = [matching_rows[r][c][1].height for r in range(num_rows) for c in range(num_cols)]
    avg_w = sum(widths) / len(widths)
    avg_h = sum(heights) / len(heights)

    # Verify dimensions are reasonably uniform within 20%
    if any(abs(w - avg_w) > max(10.0, avg_w * 0.25) for w in widths):
        return []
    if any(abs(h - avg_h) > max(10.0, avg_h * 0.25) for h in heights):
        return []

    # Compute row gaps and col gaps
    row_gaps = []
    for r in range(num_rows - 1):
        gap = matching_rows[r + 1][0][1].y - matching_rows[r][0][1].bottom
        row_gaps.append(round(gap, 2))

    col_gaps = []
    for c in range(num_cols - 1):
        gap = matching_rows[0][c + 1][1].x - matching_rows[0][c][1].right
        col_gaps.append(round(gap, 2))

    avg_row_gap = sum(row_gaps) / len(row_gaps) if row_gaps else 0.0
    avg_col_gap = sum(col_gaps) / len(col_gaps) if col_gaps else 0.0

    node_ids = [item[0] for row in matching_rows for item in row]
    matrix = [[matching_rows[r][c][0] for c in range(num_cols)] for r in range(num_rows)]

    return [
        GridCluster(
            rows=num_rows,
            columns=num_cols,
            cell_count=len(node_ids),
            row_gap=round(avg_row_gap, 2),
            col_gap=round(avg_col_gap, 2),
            cell_width=round(avg_w, 2),
            cell_height=round(avg_h, 2),
            node_ids=node_ids,
            matrix=matrix,
            confidence=0.92,
        )
    ]

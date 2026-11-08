from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple
from app.engine.geometry import extract_bounding_box
from app.models.geometry import BoundingBox, ComponentVariation, DetectedComponent


def detect_repeated_components(all_nodes: List[Any], min_instances: int = 2) -> List[DetectedComponent]:
    """
    Identify potential reusable components and visual patterns.
    Distinguishes native Figma component instances from inferred reusable patterns.
    Analyzes structural hierarchy, geometry aspect ratio, and style similarity.
    """
    if not all_nodes:
        return []

    detected_components: List[DetectedComponent] = []
    processed_node_ids: Set[str] = set()

    # 1. Native Figma Component & Instance Grouping
    figma_components_by_id: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"master": None, "instances": []})

    for node in all_nodes:
        node_id = getattr(node, "id", None) or (node.get("id") if isinstance(node, dict) else "")
        node_type = (getattr(node, "type", None) or (node.get("type") if isinstance(node, dict) else "")).upper()
        node_name = getattr(node, "name", "") or (node.get("name") if isinstance(node, dict) else "Component")

        # Native Figma Master Component
        if node_type in {"COMPONENT", "COMPONENT_SET"}:
            figma_components_by_id[node_id]["master"] = node

        # Native Figma Instance
        component_id = (
            getattr(node, "component_id", None)
            or getattr(node, "componentId", None)
            or (node.get("componentId") if isinstance(node, dict) else None)
        )
        if node_type == "INSTANCE" or component_id:
            target_id = component_id or f"master_{node_name}"
            figma_components_by_id[target_id]["instances"].append(node)

    for comp_id, group in figma_components_by_id.items():
        master_node = group["master"]
        instances = group["instances"]
        if master_node or instances:
            archetype = master_node or (instances[0] if instances else None)
            arch_id = getattr(archetype, "id", None) or (archetype.get("id") if isinstance(archetype, dict) else comp_id)
            arch_name = getattr(archetype, "name", "") or (archetype.get("name") if isinstance(archetype, dict) else "FigmaComponent")

            instance_ids = [
                getattr(inst, "id", None) or (inst.get("id") if isinstance(inst, dict) else "")
                for inst in instances
            ]
            if master_node and arch_id not in instance_ids:
                instance_ids.insert(0, arch_id)

            for nid in instance_ids:
                processed_node_ids.add(nid)

            detected_components.append(
                DetectedComponent(
                    component_id=comp_id,
                    name=arch_name,
                    source="figma_component",
                    archetype_node_id=arch_id,
                    instance_node_ids=instance_ids,
                    instance_count=len(instance_ids),
                    confidence=1.0,
                    similarity_factors={"figma_component_link": 1.0, "structural_match": 1.0},
                    variations=_extract_variations(instances),
                )
            )

    # 2. Inferred Reusable Patterns (structural & visual similarity)
    # Collect container nodes (FRAME, GROUP) that are not already bound to a native component
    candidates: List[Tuple[Any, str, BoundingBox, str]] = []
    for node in all_nodes:
        nid = getattr(node, "id", None) or (node.get("id") if isinstance(node, dict) else "")
        if nid in processed_node_ids:
            continue

        ntype = (getattr(node, "type", None) or (node.get("type") if isinstance(node, dict) else "")).upper()
        if ntype in {"FRAME", "GROUP", "SECTION", "RECTANGLE"}:
            box = extract_bounding_box(node)
            if box.is_valid and box.width >= 16.0 and box.height >= 16.0:
                sig = _compute_structural_signature(node, box)
                candidates.append((node, nid, box, sig))

    # Group candidates by structural signature
    signature_buckets: Dict[str, List[Tuple[Any, str, BoundingBox]]] = defaultdict(list)
    for node, nid, box, sig in candidates:
        signature_buckets[sig].append((node, nid, box))

    pattern_counter = 1
    for sig, group in signature_buckets.items():
        if len(group) >= min_instances:
            # Pairwise similarity evaluation within signature group
            archetype_node, archetype_id, arch_box = group[0]
            instance_ids = [archetype_id]
            sim_scores = [1.0]

            for other_node, other_id, other_box in group[1:]:
                score = _compute_similarity(archetype_node, arch_box, other_node, other_box)
                if score >= 0.75:
                    instance_ids.append(other_id)
                    sim_scores.append(score)

            if len(instance_ids) >= min_instances:
                for nid in instance_ids:
                    processed_node_ids.add(nid)

                avg_conf = round(sum(sim_scores) / len(sim_scores), 2)
                arch_name = getattr(archetype_node, "name", "") or (
                    archetype_node.get("name") if isinstance(archetype_node, dict) else "Pattern"
                )
                comp_name = f"Inferred_{_sanitize_name(arch_name)}_{pattern_counter}"
                pattern_counter += 1

                matching_nodes = [item[0] for item in group if item[1] in instance_ids]

                detected_components.append(
                    DetectedComponent(
                        component_id=f"inferred_comp_{archetype_id.replace(':', '_')}",
                        name=comp_name,
                        source="inferred_pattern",
                        archetype_node_id=archetype_id,
                        instance_node_ids=instance_ids,
                        instance_count=len(instance_ids),
                        confidence=avg_conf,
                        similarity_factors={
                            "structural_match": 1.0,
                            "geometry_aspect_ratio": round(arch_box.aspect_ratio, 2),
                            "average_similarity": avg_conf,
                        },
                        variations=_extract_variations(matching_nodes),
                    )
                )

    return detected_components


def _compute_structural_signature(node: Any, box: BoundingBox) -> str:
    """
    Generate deterministic structural fingerprint for a node.
    Combines: node type, child count, child type tuple, and binned aspect ratio.
    """
    ntype = (getattr(node, "type", None) or (node.get("type") if isinstance(node, dict) else "")).upper()
    children = getattr(node, "children", None) or (node.get("children") if isinstance(node, dict) else [])
    children = children or []

    child_types = tuple(
        (getattr(c, "type", None) or (c.get("type") if isinstance(c, dict) else "")).upper()
        for c in children
    )

    # Bin aspect ratio to nearest 0.25 to tolerate slight responsive dimension changes
    aspect_bin = round(box.aspect_ratio * 4.0) / 4.0

    return f"{ntype}|len={len(children)}|types={child_types}|aspect={aspect_bin}"


def _compute_similarity(node_a: Any, box_a: BoundingBox, node_b: Any, box_b: BoundingBox) -> float:
    """
    Compute multi-factor similarity between two nodes sharing structural signature.
    Factors: Geometry dimensions (50%), Styles & Colors (50%).
    """
    # 1. Geometry dimension similarity
    w_ratio = min(box_a.width, box_b.width) / max(max(box_a.width, box_b.width), 0.01)
    h_ratio = min(box_a.height, box_b.height) / max(max(box_a.height, box_b.height), 0.01)
    geo_sim = (w_ratio + h_ratio) / 2.0

    # 2. Style similarity
    styles_a = getattr(node_a, "styles", None) or (node_a.get("styles") if isinstance(node_a, dict) else {})
    styles_b = getattr(node_b, "styles", None) or (node_b.get("styles") if isinstance(node_b, dict) else {})

    style_score = 0.5
    if styles_a and styles_b:
        # Check border radius match
        br_a = getattr(styles_a, "border_radius", None) or (styles_a.get("borderRadius") if isinstance(styles_a, dict) else None)
        br_b = getattr(styles_b, "border_radius", None) or (styles_b.get("borderRadius") if isinstance(styles_b, dict) else None)
        br_match = (br_a == br_b) if (br_a is not None and br_b is not None) else 0.5

        # Check color count or fills
        colors_a = getattr(styles_a, "colors", None) or (styles_a.get("colors") if isinstance(styles_a, dict) else [])
        colors_b = getattr(styles_b, "colors", None) or (styles_b.get("colors") if isinstance(styles_b, dict) else [])
        colors_match = 1.0 if len(colors_a or []) == len(colors_b or []) else 0.5

        style_score = (br_match + colors_match) / 2.0

    return round(0.5 * geo_sim + 0.5 * style_score, 3)


def _extract_variations(instances: List[Any]) -> List[ComponentVariation]:
    """
    Identify properties that differ across instances (candidate React props: text content, background, etc.).
    """
    if len(instances) <= 1:
        return []

    variations: List[ComponentVariation] = []

    # 1. Text variations
    text_values_by_id: Dict[str, str] = {}
    for inst in instances:
        nid = getattr(inst, "id", None) or (inst.get("id") if isinstance(inst, dict) else "")
        text = _extract_first_text(inst)
        if text:
            text_values_by_id[nid] = text

    if len(set(text_values_by_id.values())) > 1:
        variations.append(
            ComponentVariation(
                property_name="text",
                variation_type="content",
                values_by_node_id=text_values_by_id,
            )
        )

    return variations


def _extract_first_text(node: Any) -> Optional[str]:
    """Recursively find first text content within node."""
    text = getattr(node, "text", None) or (node.get("text") if isinstance(node, dict) else None)
    if text:
        return str(text).strip()

    children = getattr(node, "children", None) or (node.get("children") if isinstance(node, dict) else [])
    for child in children or []:
        child_text = _extract_first_text(child)
        if child_text:
            return child_text
    return None


def _sanitize_name(name: Optional[str]) -> str:
    """Format alphanumeric name for inferred components."""
    if not name:
        return "Component"
    clean = "".join(c for c in str(name) if c.isalnum() or c == "_")
    return clean.capitalize() if clean else "Component"

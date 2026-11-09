from fastapi.testclient import TestClient


def test_enrich_design_ir_success(client: TestClient, auth_headers: dict):
    """
    Test POST /api/v1/ir/enrich successfully accepts canonical Design IR,
    constructs spatial relationship graph using NetworkX, and enriches document.
    """
    payload = {
        "documentId": "ir_proj_e2e_12345",
        "fileKey": "testFigmaKey456",
        "fileName": "E-Commerce App Design",
        "version": "1.0.0",
        "metadata": {
            "figmaVersion": "1.0",
            "generator": "Reagmat Design IR Builder v1.0.0",
        },
        "pages": [
            {
                "id": "page_01",
                "name": "Main Storefront",
                "dimensions": {"width": 1440, "height": 900},
                "children": [
                    {
                        "id": "1:100",
                        "figmaId": "1:100",
                        "name": "Navbar Frame",
                        "type": "FRAME",
                        "semanticType": "Navbar",
                        "semantics": {
                            "type": "Navbar",
                            "confidence": 0.95,
                            "evidence": ["Auto-layout row at top of frame"],
                            "classificationSource": "HEURISTIC",
                            "isExplicit": False,
                        },
                        "bounds": {"x": 0, "y": 0, "width": 1440, "height": 80},
                        "layout": {
                            "mode": "FLEX_ROW",
                            "direction": "horizontal",
                            "gap": 16,
                            "padding": {"top": 12, "right": 24, "bottom": 12, "left": 24},
                        },
                        "children": [
                            {
                                "id": "1:101",
                                "figmaId": "1:101",
                                "name": "Brand Logo",
                                "type": "TEXT",
                                "semanticType": "Text",
                                "bounds": {"x": 24, "y": 28, "width": 120, "height": 24},
                                "text": "Reagmat Shop",
                            },
                            {
                                "id": "1:102",
                                "figmaId": "1:102",
                                "name": "Checkout CTA",
                                "type": "COMPONENT",
                                "semanticType": "Button",
                                "bounds": {"x": 1280, "y": 20, "width": 136, "height": 40},
                            },
                        ],
                    }
                ],
            }
        ],
        "tokens": {
            "colors": {"raw": ["#2563EB", "#FFFFFF"], "semantic": {"primary": "#2563EB"}},
            "radii": {"sm": 4, "md": 8},
        },
        "components": [
            {
                "id": "comp_1:102",
                "name": "Checkout CTA",
                "sourceNodeId": "1:102",
                "componentType": "NATIVE_FIGMA",
                "variants": [],
                "properties": {},
                "dependencies": {"componentIds": [], "assetIds": [], "tokenKeys": []},
            }
        ],
        "assets": [
            {
                "assetId": "asset_img_1",
                "sourceNodeId": "1:101",
                "assetType": "image",
                "format": "png",
                "storageReference": "/api/assets/testFigmaKey456/1-101.png",
                "dimensions": {"width": 120, "height": 24},
            }
        ],
        "relationships": {
            "nodes": [],
            "edges": [],
            "statistics": {},
        },
    }

    response = client.post(
        "/api/v1/ir/enrich",
        headers=auth_headers,
        json=payload,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "data" in data
    assert data["data"]["documentId"] == "ir_proj_e2e_12345"
    assert data["data"]["version"] == "1.0.0"

    # Enriched relationships verification
    relationships = data["data"]["relationships"]
    assert "nodes" in relationships
    assert "edges" in relationships
    assert len(relationships["nodes"]) > 0


def test_enrich_design_ir_auth_required(client: TestClient):
    """
    Test POST /api/v1/ir/enrich rejects unauthenticated calls with 401.
    """
    response = client.post(
        "/api/v1/ir/enrich",
        json={"documentId": "ir_123", "fileKey": "key123"},
    )
    assert response.status_code == 401


def test_enrich_design_ir_invalid_credentials(client: TestClient):
    """
    Test POST /api/v1/ir/enrich rejects invalid credentials with 403.
    """
    response = client.post(
        "/api/v1/ir/enrich",
        headers={"X-Service-Secret": "invalid_wrong_secret"},
        json={"documentId": "ir_123", "fileKey": "key123"},
    )
    assert response.status_code == 403


def test_enrich_design_ir_validation_error(client: TestClient, auth_headers: dict):
    """
    Test POST /api/v1/ir/enrich rejects malformed payloads missing required fields with 422.
    """
    # Missing required 'fileKey' and 'documentId'
    response = client.post(
        "/api/v1/ir/enrich",
        headers=auth_headers,
        json={"invalidField": 123},
    )
    assert response.status_code == 422


def test_enrich_design_ir_empty_pages(client: TestClient, auth_headers: dict):
    """
    Test POST /api/v1/ir/enrich handles document with empty pages gracefully.
    """
    payload = {
        "documentId": "ir_empty_doc_001",
        "fileKey": "emptyKey",
        "pages": [],
    }
    response = client.post(
        "/api/v1/ir/enrich",
        headers=auth_headers,
        json=payload,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["documentId"] == "ir_empty_doc_001"


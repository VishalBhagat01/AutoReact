from fastapi.testclient import TestClient


def test_valid_analysis_request(client: TestClient, auth_headers: dict, sample_analysis_payload: dict):
    """
    Test POST /api/v1/design/analyze returns structured analysis for valid payload.
    """
    response = client.post(
        "/api/v1/design/analyze",
        headers=auth_headers,
        json=sample_analysis_payload,
    )
    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["requestId"] == sample_analysis_payload["requestId"]
    assert data["status"] == "validated"
    assert data["nodeCount"] == 2  # Button Frame + Text child
    assert data["serviceVersion"] == "1.0.0"

    # Metadata verification
    assert data["metadata"]["fileKey"] == "test_figma_key_123"
    assert data["metadata"]["fileName"] == "Reagmat Landing Page"

    # Summary verification
    summary = data["summary"]
    assert summary["totalNodes"] == 2
    assert summary["containerNodes"] == 1
    assert summary["textNodes"] == 1
    assert summary["hasLayout"] is True
    assert summary["hasStyles"] is True

    # Capabilities verification (completed vs pending)
    capabilities = data["capabilities"]
    assert capabilities["payload_validation"] == "completed"
    assert capabilities["node_counting"] == "completed"
    assert capabilities["geometry_spatial_analysis"] == "pending"
    assert capabilities["semantic_reasoning"] == "pending"
    assert capabilities["code_generation"] == "pending"


def test_selective_nodes_analysis(client: TestClient, auth_headers: dict, sample_design_node: dict):
    """
    Test analysis with selective nodes list rather than single root tree.
    """
    payload = {
        "fileKey": "selective_file_key",
        "fileName": "Selective Components",
        "nodes": [sample_design_node],
    }

    response = client.post(
        "/api/v1/design/analyze",
        headers=auth_headers,
        json=payload,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["nodeCount"] == 2
    assert data["requestId"].startswith("req_")


def test_invalid_node_payload_fails_validation(client: TestClient, auth_headers: dict):
    """
    Test invalid payload (e.g. node missing required 'id') triggers 422 with structured envelope.
    """
    bad_payload = {
        "fileKey": "key_123",
        "tree": {
            # missing "id"
            "name": "Invalid Node Without ID",
            "type": "FRAME",
        },
    }

    response = client.post(
        "/api/v1/design/analyze",
        headers=auth_headers,
        json=bad_payload,
    )
    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["code"] == "VALIDATION_ERROR"
    assert "error" in data
    assert "details" in data

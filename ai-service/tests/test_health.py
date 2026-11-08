from fastapi.testclient import TestClient
from app.core.config import settings


def test_root_health(client: TestClient):
    """
    Test GET /health returns operational status.
    """
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == settings.SERVICE_NAME
    assert data["version"] == settings.SERVICE_VERSION
    assert "timestamp" in data
    assert data["environment"] == settings.ENVIRONMENT


def test_v1_health(client: TestClient):
    """
    Test GET /api/v1/health returns operational status.
    """
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == settings.SERVICE_NAME
    assert data["version"] == settings.SERVICE_VERSION


def test_capabilities_endpoint(client: TestClient):
    """
    Test GET /api/v1/capabilities accurately reflects operational vs pending capabilities.
    Must not advertise future features as operational.
    """
    response = client.get("/api/v1/capabilities")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == settings.SERVICE_NAME
    assert data["status"] == "operational"
    assert "v1" in data["supported_versions"]

    capabilities = data["capabilities"]
    # Foundational features
    assert capabilities["health_check"] is True
    assert capabilities["internal_service_authentication"] is True
    assert capabilities["design_payload_validation"] is True
    assert capabilities["design_metadata_extraction"] is True
    assert capabilities["node_counting"] is True
    assert capabilities["structural_inspection"] is True

    # Milestone 6 Geometry & Intelligence capabilities
    assert capabilities["geometry_spatial_analysis"] is True
    assert capabilities["relationship_graph"] is True
    assert capabilities["layout_inference"] is True
    assert capabilities["repeated_component_detection"] is True

    # Future features must NOT be marked operational
    assert capabilities["semantic_reasoning"] is False
    assert capabilities["langgraph_orchestration"] is False
    assert capabilities["llm_code_generation"] is False
    assert capabilities["code_generation"] is False
    assert capabilities["react_code_synthesis"] is False
    assert capabilities["visual_validation"] is False

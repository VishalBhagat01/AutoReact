from fastapi.testclient import TestClient
from app.core.config import settings


def test_missing_authentication_header_rejected(client: TestClient, sample_analysis_payload: dict):
    """
    Test requests without internal authentication header receive 401 Unauthorized.
    """
    response = client.post(
        "/api/v1/design/analyze",
        json=sample_analysis_payload,
        # No auth header
    )
    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False
    assert data["code"] == "UNAUTHORIZED"
    assert "Missing internal service authentication" in data["error"]
    # Secret must not appear anywhere in error
    assert settings.SERVICE_SECRET not in response.text


def test_incorrect_authentication_secret_rejected(client: TestClient, sample_analysis_payload: dict):
    """
    Test requests with invalid service secret receive 403 Forbidden.
    """
    response = client.post(
        "/api/v1/design/analyze",
        headers={"X-Service-Secret": "invalid_wrong_secret_12345"},
        json=sample_analysis_payload,
    )
    assert response.status_code == 403
    data = response.json()
    assert data["success"] is False
    assert data["code"] == "FORBIDDEN"
    assert "Invalid internal service credentials" in data["error"]
    assert settings.SERVICE_SECRET not in response.text


def test_bearer_authorization_header_accepted(client: TestClient, sample_analysis_payload: dict):
    """
    Test standard Authorization: Bearer <secret> format is also accepted.
    """
    response = client.post(
        "/api/v1/design/analyze",
        headers={"Authorization": f"Bearer {settings.SERVICE_SECRET}"},
        json=sample_analysis_payload,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

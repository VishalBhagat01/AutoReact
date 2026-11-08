import pytest
from fastapi.testclient import TestClient
from app.core.config import settings
from app.main import app


@pytest.fixture(scope="session")
def client() -> TestClient:
    """
    TestClient fixture for FastAPI application.
    """
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth_headers() -> dict:
    """
    Valid internal service authentication headers.
    """
    return {"X-Service-Secret": settings.SERVICE_SECRET}


@pytest.fixture
def sample_design_node() -> dict:
    """
    Sample normalized node conforming to the Reagmat Design AST.
    """
    return {
        "id": "1:24",
        "name": "HeroButton",
        "type": "FRAME",
        "bounds": {
            "x": 100.0,
            "y": 200.0,
            "width": 140.0,
            "height": 48.0,
        },
        "layout": {
            "mode": "row",
            "justifyContent": "center",
            "alignItems": "center",
            "gap": 8.0,
            "padding": {"all": 12.0},
        },
        "styles": {
            "colors": [{"type": "SOLID", "color": "#2563EB", "opacity": 1.0}],
            "borderRadius": {"all": 8.0},
        },
        "children": [
            {
                "id": "1:25",
                "name": "ButtonText",
                "type": "TEXT",
                "text": "Get Started",
                "bounds": {
                    "x": 120.0,
                    "y": 214.0,
                    "width": 100.0,
                    "height": 20.0,
                },
                "styles": {
                    "typography": {
                        "fontFamily": "Inter",
                        "fontSize": 16.0,
                        "fontWeight": 600,
                    }
                },
            }
        ],
    }


@pytest.fixture
def sample_analysis_payload(sample_design_node) -> dict:
    """
    Valid DesignAnalysisRequest payload.
    """
    return {
        "requestId": "req_test_001",
        "fileKey": "test_figma_key_123",
        "fileName": "Reagmat Landing Page",
        "projectId": "672f00000000000000000001",
        "tree": sample_design_node,
        "metadata": {
            "version": "1.0",
            "source": "figma_export",
        },
    }

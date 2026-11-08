# Reagmat AI & Design Intelligence Microservice

A dedicated Python FastAPI microservice providing design AST validation, spatial geometry intelligence, and AI code generation orchestration for the Reagmat Figma-to-React platform.

---

## 1. Architecture & Responsibilities

The Reagmat platform utilizes a hybrid architecture:
- **Node.js (Express Gateway):** Owns user authentication, Figma REST API fetching, MongoDB persistence, asset caching, and client communication.
- **Python (FastAPI Core):** Owns design intelligence, spatial reasoning, component graph generation, AI workflows, and React code synthesis.

```
┌─────────────────────────┐       Internal HTTP (Secret)       ┌───────────────────────────────┐
│  Node.js Backend Gateway│ ─────────────────────────────────> │   Python FastAPI Microservice │
│  - /api/figma/*         │                                    │  - /api/v1/design/analyze     │
│  - /api/projects/*      │ <───────────────────────────────── │  - /api/v1/capabilities       │
│  - MongoDB Persistence  │           Structured JSON          │  - /health & /api/v1/health   │
└─────────────────────────┘                                    └───────────────────────────────┘
```

---

## 2. API Endpoints

| Method | Path | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/health` | No | Service health check |
| `GET` | `/api/v1/health` | No | Versioned health check |
| `GET` | `/api/v1/capabilities` | No | Operational vs. pending features |
| `POST` | `/api/v1/design/analyze` | Yes (`X-Service-Secret`) | Validates AST and returns structural analysis |

---

## 3. Local Development Setup (Windows PowerShell)

Run the service independently using a virtual environment:

```powershell
# 1. Navigate to service directory
cd agent

# 2. Create virtual environment
python -m venv .venv

# 3. Activate virtual environment
.venv\Scripts\Activate.ps1

# 4. Install dependencies
pip install -r requirements.txt

# 5. Start development server with hot-reload
uvicorn app.main:app --reload --port 8000
```

---

## 4. Environment Variables

Create `.env` inside `agent/` (copy from `.env.example`):

```env
HOST=0.0.0.0
PORT=8000
ENVIRONMENT=development
LOG_LEVEL=info
SERVICE_SECRET=your_internal_service_secret
```

---

## 5. Running Tests

Execute automated tests with `pytest`:

```powershell
.venv\Scripts\pytest tests/ -v
```

---

## 6. Docker Container

Build and run using Docker:

```bash
docker build -t reagmat-ai-service ./agent
docker run -p 8000:8000 --env-file ./agent/.env reagmat-ai-service
```

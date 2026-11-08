# Reagmat - Repository Audit & Development Status Report

**Date:** November 2026  
**Repository:** Reagmat (Figma-to-React AI Platform)  
**Status:** Audit Complete | Architecture Extended for Python FastAPI AI Intelligence

---

## 1. Executive Summary

Reagmat is currently a **Figma Design Parser MVP** capable of importing a Figma file via URL, fetching its JSON document via the Figma REST API, parsing it into a normalized tree structure with extracted layout and styling properties, and displaying that tree in an interactive inspector UI.

The platform's next evolutionary stage is transforming from an AST inspector into an **AI-powered Figma-to-React compiler platform** capable of:
1. **Full Application Synthesis:** Converting an entire multi-screen or single-page Figma design into a production-ready, structured React application.
2. **Selective Component Extraction:** Converting individually selected Figma frames, components, or sections into modular, self-contained, and reusable React components.

This audit evaluates the codebase across 14 architectural dimensions, pinpoints critical bugs and technical debt (including an immediate module resolution crash in the backend), and outlines a hybrid **Node.js/Express + Python/FastAPI + React/Vite + MongoDB** architecture.

---

## 2. Architecture Overview & Current State

```
Current State:
┌─────────────────────────┐       HTTP (REST)       ┌───────────────────────────────┐
│   React 19 + Vite UI    │ ──────────────────────> │    Node.js + Express Server    │
│  - Figma URL Importer   │                         │  - /api/figma/import          │
│  - TreeViewer (Zustand) │ <────────────────────── │  - Figma API Client (Axios)   │
│  - NodeDetailsPanel     │        JSON Tree        │  - Normalizer & Style Parser  │
└─────────────────────────┘                         │  - (Mongoose installed, unused)│
                                                    └──────────────┬────────────────┘
                                                                   │ Figma API (Token)
                                                                   ▼
                                                            ┌──────────────┐
                                                            │  Figma Cloud │
                                                            └──────────────┘

Target Extended State:
┌─────────────────────────┐       HTTP / WS         ┌───────────────────────────────┐
│   React 19 + Vite UI    │ ──────────────────────> │    Node.js / Express Gateway  │
│  - Design Tree Viewer   │                         │  - Auth & Project Management  │
│  - Interactive Canvas   │ <────────────────────── │  - Figma Fetch & Cache Engine │
│  - Component Selector   │                         │  - MongoDB Persistence        │
│  - Code Preview & Diff  │                         │  - Job Orchestrator           │
└─────────────────────────┘                         └───────┬───────────────┬───────┘
                                                            │               │
                                              Internal HTTP │               │ Mongoose
                                                            ▼               ▼
                                            ┌─────────────────────┐   ┌─────────────┐
                                            │ Python FastAPI Core │   │   MongoDB   │
                                            │ - Spatial/Geo Graph │   │ - Projects  │
                                            │ - Semantic Engine   │   │ - AST Cache │
                                            │ - LLM Code Gen      │   │ - Gen Code  │
                                            │ - AST-to-JSX Synthes│   └─────────────┘
                                            └─────────────────────┘
```

---

## 3. Deep-Dive Audit Across 14 Dimensions

### 3.1 Frontend Architecture
* **Stack:** React 19.2.5, Vite 8.0.10, Tailwind CSS 3.4.1, Zustand 4.4.0, Axios 1.6.0.
* **Structure:** Single-page dashboard divided into a 2-column layout (`App.jsx`):
  * Left sidebar (`384px` / `w-96`): URL input (`FigmaImport.jsx`) and collapsible hierarchy tree (`TreeViewer.jsx`).
  * Right panel (`flex-1`): Node inspector (`NodeDetailsPanel.jsx`).
* **Evaluation:**
  * Clean UI aesthetics (dark mode, glassmorphic styling, JetBrains Mono typography).
  * Missing multi-page views, routing, canvas preview, selection tool, code editor, and export capabilities.

### 3.2 Backend Architecture
* **Stack:** Node.js (ES Modules, `"type": "module"`), Express 5.2.1, CORS, Dotenv, Axios 1.16.0, Mongoose 9.6.2.
* **Structure:** Layered pattern (`controllers/`, `routes/`, `services/`, `utils/`).
* **Evaluation:**
  * Clean modular separation of concerns.
  * Express 5.2.1 handles async errors natively.
  * An empty directory exists (`src/middleware/`).
  * Redundant legacy CommonJS file exists (`src/utility/url.js`) which breaks if imported under ESM.

### 3.3 Figma API Integration
* **File:** `backend/src/services/figmaService.js`
* **Implementation:**
  * `fetchFigmaFile(fileKey, token)`: Calls `GET https://api.figma.com/v1/files/:fileKey` with `X-Figma-Token`.
  * `extractFileKey(url)`: Regex matches standard Figma URLs (`/file/:key` and `/design/:key`).
* **Evaluation:**
  * Functional for basic document retrieval.
  * **Limitations:**
    * Fetches only entire file documents (`/files/:key`). Does not use node-specific retrieval (`/v1/files/:key/nodes?ids=...`), which will be required for converting selected components.
    * No image/asset exporting (`/v1/images/:key`). SVGs, icons, and raster images are not downloaded.
    * No token refresh or OAuth2 flow (only hardcoded personal access tokens).
    * No rate limit handling (HTTP 429) or exponential backoff.

### 3.4 Figma JSON Parser
* **Files:** `backend/src/services/figmaService.js`, `backend/src/utils/nodeProcessor.js`, `backend/src/utils/nodeFilter.js`.
* **Implementation:**
  * Traverses document canvas pages (`child.type === 'CANVAS'`).
  * Recursively processes children, pruning decorative nodes, empty containers, invisible layers, and tiny nodes (<5px).
  * Extracts bounds, text characters, styles, and auto-layout.
* **Evaluation:**
  * Efficient recursive traversal.
  * Pruning rules are solid for MVP noise reduction.

### 3.5 Design AST Implementation
* **Files:** `backend/src/utils/nodeProcessor.js`, `backend/src/utils/layoutExtractor.js`, `backend/src/utils/styleExtractor.js`.
* **Structure:**
  ```json
  {
    "id": "1:23",
    "name": "Button",
    "type": "FRAME",
    "layout": { "mode": "row", "justifyContent": "center", "alignItems": "center", "gap": 8, "padding": { "all": 12 } },
    "styles": { "colors": [...], "typography": {...}, "borderRadius": {...}, "stroke": {...}, "effects": [...] },
    "bounds": { "x": 100, "y": 200, "width": 120, "height": 44 },
    "text": "Submit",
    "children": [...]
  }
  ```
* **Evaluation:**
  * Good intermediate tree for UI inspection.
  * **Not yet a true Compiler Design AST:** Missing semantic roles, component props interfaces, state bindings, import declarations, responsive breakpoint descriptors, and vector/path geometry data.

### 3.6 Geometry Utilities
* **Current State:**
  * Simple bounding box extraction (`absoluteBoundingBox` -> `x, y, width, height` integers).
  * Filter check: `isSmallDimension` (< 5x5 px).
  * In uncommitted/deleted git history: `calculateAlignment` (center offsets) and coordinate variance checking (< 20px) for horizontal/vertical flow.
* **Missing:**
  * Bounding box overlap and intersection detection (AABB collision algorithms).
  * Absolute-to-relative coordinate conversion for nested containers.
  * Visual reading order sorting (top-to-bottom, left-to-right) for non-auto-layout frames.
  * Grid and flex wrapping clustering algorithms.

### 3.7 Semantic Detection
* **Critical Finding - Split and Broken Implementation:**
  1. **Working Tree Bug:** `backend/src/services/figmaService.js` line 4 imports:
     ```javascript
     import { analyzeSemanticTree } from './figma/semantic/semanticEngine.js';
     ```
     However, the entire `backend/src/services/figma/semantic/` directory was deleted in the working directory (uncommitted git deletion). Starting `node index.js` immediately throws `ERR_MODULE_NOT_FOUND`.
  2. **Alternative Utility Exists:** `backend/src/utils/semanticClassifier.js` exists and contains heuristic classifiers for text (headings 1-3, button text, labels) and containers (cards, forms, inputs, navbars, heroes, modals, lists, grids, avatars, badges). It also contains a `semanticTypeToReactComponent` mapping. However, it is **not hooked into `figmaService.js`**.
  3. **Committed Architecture:** Git HEAD contains a modular rule-based engine (`confidenceScoring.js`, `detectButton.js`, `detectCard.js`, `detectInput.js`, `detectNavbar.js`, etc.) with weighted scoring.
* **Evaluation:**
  * Rule-based regex naming heuristics are fragile (break when designers name layers `Frame 1024` or `Group 5`).
  * This is the exact domain where Python AI intelligence (spatial reasoning + multi-modal vision / LLM reasoning) provides the necessary breakthrough.

### 3.8 Relationship Graph
* **Current State:**
  * Strictly a standard hierarchical tree (`children: []`).
* **Missing:**
  * No component definition vs. instance linkage (`COMPONENT` vs `INSTANCE`).
  * No sibling flow or layout dependency graph.
  * No design token / style inheritance graph (color palette, typography scale).
  * No section-to-component reference graph.

### 3.9 Existing APIs
* **Endpoints:**
  * `POST /api/figma/import`: Accepts `{ url }`, returns `{ success, data: { fileName, fileVersion, totalNodeCount, tree, pages } }`.
  * `GET /api/figma/health`: Returns `{ success, message: "Figma API is operational" }`.
  * `GET /health`: Express root health check.
* **Missing Endpoints:**
  * No endpoints for component extraction (`/api/codegen/component`).
  * No endpoints for full app generation (`/api/codegen/app`).
  * No project persistence or retrieval (`/api/projects`).
  * No asset export endpoints (`/api/figma/assets`).

### 3.10 MongoDB Schemas
* **Current State:**
  * `mongoose: ^9.6.2` is in `backend/package.json`.
  * **Zero implementation:** No connection call in `index.js`, no `.env` connection string, no models folder, no schemas.
  * The current application is entirely stateless in-memory.

### 3.11 State Management
* **Store:** `frontend/src/store/treeStore.js` (Zustand).
* **State Managed:** `tree`, `fileName`, `fileVersion`, `totalNodeCount`, `selectedNodeId`, `expandedNodes` (Set), `loading`, `error`.
* **Evaluation:**
  * Fast and lightweight for the single-page tree viewer.
  * Missing: Multi-selection, isolated component preview state, code generation output state, project history.

### 3.12 Existing UI
* **Current State:**
  * Split pane with Figma URL input, animated loading, interactive tree view with expand/collapse, and detailed property inspector for styles and layout.
* **Missing:**
  * Graphical Figma canvas/frame preview.
  * Component selection checkboxes / "Extract this Component" buttons.
  * Code viewer (Monaco / Prism syntax highlighting) with JSX, CSS/Tailwind, and props tabs.
  * Full application preview (sandboxed iframe or Live Preview).
  * Export modal (Download ZIP, copy code, push to GitHub).

### 3.13 Existing Tests
* **Current State:**
  * Backend: `"test": "echo \"Error: no test specified\" && exit 1"`. Zero test files.
  * Frontend: No test framework configured (no Vitest / Jest). Zero test files.

### 3.14 Environment Configuration
* **Current State:**
  * `backend/.env`: Configures `FIGMA_TOKEN` and `PORT`.
  * `frontend/.env`: Configures `VITE_API_URL`.
  * Missing: `backend/.env.example` and `frontend/.env.example` (referenced in documentation but missing on disk).
  * Missing: MongoDB connection URI (`MONGODB_URI`), Python microservice URL (`AI_SERVICE_URL`).

---

## 4. Status Matrix

| Area | Status | Notes |
| :--- | :---: | :--- |
| **Figma API REST Fetching** | ✅ Implemented | Works for file documents; prepared for node-specific queries |
| **Design Tree Traversal & Pruning** | ✅ Implemented | Noise reduction & recursive children processing working |
| **Layout & Style Normalization** | ✅ Implemented | Auto-layout to Flexbox, colors, typography, bounds extracted |
| **Inspector Frontend UI** | ✅ Implemented | TreeViewer, TreeNode, and NodeDetailsPanel functional |
| **Zustand State Store** | ✅ Implemented | Stores loaded tree, selection, and expand/collapse states |
| **Tailwind & Styling** | ✅ Implemented | Dark theme, JetBrains Mono font, custom glassmorphism |
| **Semantic Classification** | ✅ Unified & Recovered | Modular weighted engine restored, extended (Avatar, Badge, Modal, Hero, List), and unified |
| **Figma URL Parser** | ✅ Robust ESM | Supports /file/, /design/, /proto/, node-id query params (colon, hyphen, url-encoded) |
| **Backend Error Handling** | ✅ Express 5 Ready | Centralized errorHandler, validator middleware, Figma API 401/403/404/429/timeout mappings |
| **Backend Test Suite** | ✅ 44/44 Passing | Native Node 22 test runner covering URLs, Semantics, Node Processing, API endpoints |
| **Layout to Tailwind Class Mapping** | ⚠️ Partial | Utility exists in `layoutExtractor.js` & `constants.js`, ready for Python code gen |
| **Geometry Utilities** | ⚠️ Partial | Bounding boxes, centering, alignment; spatial clustering to be handled in Python AI service |
| **Figma Image / SVG Asset Export** | ❌ Missing | Next phase: add Figma image download pipeline |
| **Design-to-React Code Generation** | ❌ Missing | Next phase: Python FastAPI AI microservice integration |
| **Full App vs Component Extraction** | ❌ Missing | Target of Python AI code generator (Phases 3-4) |
| **Python + FastAPI AI Service** | ❌ Missing | Target of Phase 2 |
| **MongoDB / Mongoose Persistence** | ❌ Missing | Mongoose installed; target of Phase 1 persistence setup |
| **Visual Canvas / Code Preview UI** | ❌ Missing | Target of Phase 5 |
| **Environment Examples** | ✅ Completed | `.env.example` created in both `backend` and `frontend` |

---

## 5. What Needs Refactoring vs. What Must Remain Unchanged

### What Should Remain Unchanged
1. **Frontend Core Stack:** React 19 + Vite + Tailwind CSS + Zustand setup is modern, fast, and completely appropriate.
2. **Backend Gateway Stack:** Node.js + Express is ideal as the client-facing orchestrator, API gateway, and Figma integration service.
3. **Figma REST Fetch Logic:** The core Axios call with `X-Figma-Token` and URL regex extractor is sound and should be retained.
4. **Style & Layout Extractors:** `styleExtractor.js` and `layoutExtractor.js` contain accurate Figma-to-CSS normalization mappings (RGB-to-HEX, auto-layout to flexbox, border radius, typography) and should be preserved.

### What Needs Immediate Refactoring
1. **Fix Broken Semantic Engine Import:** Restore or rewire `figmaService.js` so the backend runs without crashing. Reconnect `semanticClassifier.js` or restore the modular semantic engine.
2. **Remove / Standardize Legacy Files:**
   * Delete or migrate `backend/src/utility/url.js` (CommonJS module conflicting with ES module setup).
   * Clean up empty `backend/src/middleware/` directory by adding proper validation and error handling middlewares.
3. **Selective Node Fetching & URL Parsing:**
   * Update Figma URL parser to support node links: `https://www.figma.com/design/:key/:name?node-id=1-23`.
   * Add support for fetching specific subtrees via Figma API `GET /v1/files/:key/nodes?ids=...`.

---

## 6. Architecture for Python + FastAPI AI Intelligence

To add AI and design intelligence without replacing the existing Node.js platform, we introduce **Python + FastAPI as a dedicated AI microservice**.

### Why This Separation Works
* **Node.js/Express:** Handles client HTTP sessions, WebSocket streams, Figma API rate limiting, MongoDB CRUD, project persistence, and bundle packaging.
* **Python/FastAPI:** Handles computational geometry (NumPy / Shapely), visual design heuristics, relationship graphs (NetworkX), embeddings, LLM orchestration (LangChain / instructor / official Gemini SDK), and AST-to-React synthesis.

### Data Flow for Code Generation

```
[ User in React UI ]
        │
        │ 1. Request: "Generate Component" (Node ID) OR "Generate Full App"
        ▼
[ Node.js Express Gateway ]
        │
        │ 2. Extract Subtree AST or Full Document AST from Cache/Figma
        │ 3. Forward AST + User Requirements to Python Service
        ▼
[ Python FastAPI AI Microservice ]
        │
        ├── A. Spatial & Geometry Engine:
        │      Compute relative coordinates, detect visual hierarchy, align flex/grid
        │
        ├── B. Relationship Graph Builder:
        │      Build component dependency DAG, deduplicate repeated UI patterns
        │
        ├── C. Design Intelligence & Semantic Agent:
        │      Infer intents, form states, interactive handlers, accessibility roles
        │
        └── D. Code Synthesis Engine:
               Synthesize clean, typed React 19 + Tailwind CSS components
        │
        │ 4. Return Structured Code Payload { files: [{ path, code }], metadata }
        ▼
[ Node.js Express Gateway ]
        │
        │ 5. Save generated code & version in MongoDB
        │ 6. Send payload to Frontend (and optional ZIP export stream)
        ▼
[ React Frontend ]
        │
        └─► Live Interactive Preview + Monaco Code Viewer + Component Sandbox
```

---

## 7. Implementation Roadmap

### Phase 1: Stability & Foundation (Node.js & MongoDB)
* **Goal:** Resolve active crash bugs, initialize database persistence, and prepare clean interfaces.
* **Tasks:**
  1. Fix the backend crash by restoring the modular semantic engine or unifying with `src/utils/semanticClassifier.js`.
  2. Clean up CommonJS artifact (`src/utility/url.js`).
  3. Initialize MongoDB connection in `backend/index.js` via Mongoose.
  4. Create core schemas:
     * `Project`: Figma file key, title, version, settings.
     * `DesignTree`: Cached normalized AST for fast re-generation.
     * `GeneratedCode`: Export history, component files, generation parameters.
  5. Add `.env.example` to both backend and frontend.

### Phase 2: Python + FastAPI Microservice Setup
* **Goal:** Establish high-performance AI backend for design reasoning.
* **Tasks:**
  1. Initialize `ai-service/` with FastAPI, Uvicorn, and Pydantic v2.
  2. Define Pydantic models matching the normalized Design AST.
  3. Implement Spatial & Geometry Utilities:
     * Overlap & containment tree solver.
     * Flexbox row/column inference for non-auto-layout frames.
     * Reading-order node sorter.
  4. Build Relationship Graph builder (NetworkX) for detecting component reuse.
  5. Connect Gemini API / LLM provider for contextual code generation.

### Phase 3: Selective Component Conversion Pipeline
* **Goal:** Allow users to pick any frame, component, or section and generate a single reusable React component.
* **Tasks:**
  1. Support `?node-id=` URL extraction and selective node API query.
  2. Implement backend endpoint `POST /api/codegen/component`.
  3. FastAPI pipeline for single component:
     * Isolation of styles and child nodes.
     * Props inference (text content -> props, images -> prop URLs).
     * React component emission (Tailwind CSS, JSX/TSX).
  4. Frontend: "Select Component" mode in `TreeViewer` with "Convert to Component" CTA.

### Phase 4: Full Figma Design to React Application
* **Goal:** Transform multi-frame or complete page designs into full React apps.
* **Tasks:**
  1. Multi-page & multi-frame parsing in Node.js and FastAPI.
  2. Navigation and routing synthesis (React Router structure).
  3. Shared component extraction (deduplicating recurring cards, buttons, navbars).
  4. Global theme generation (`tailwind.config.js` with extracted colors, typography, border radii).
  5. Project ZIP bundling in Node.js (Archiver) for single-click download.

### Phase 5: Interactive Code Preview & UX Polish
* **Goal:** Deliver a modern developer workspace experience.
* **Tasks:**
  1. Integrate Monaco Editor or Prism syntax highlighter in the right-hand panel with tabs:
     * Design Inspector
     * Generated JSX / TSX
     * Live Preview Sandbox
  2. Multi-component selection in the tree.
  3. Comprehensive unit & integration tests (Vitest for frontend, Jest/Supertest for backend, Pytest for FastAPI).



---

## 8. Milestone Completed: Backend Stabilization & Semantic Engine Recovery (Step 2)

### 8.1 Critical Issues Resolved
1. **Semantic Engine Crash (`ERR_MODULE_NOT_FOUND`):**
   * **Root Cause:** `backend/src/services/figma/semantic/` was deleted in the local working tree while `figmaService.js` was importing `analyzeSemanticTree` from it. In addition, corrupted dependency files in `backend/node_modules/` (including an incomplete `axios` package missing its `lib/` directory) caused secondary module resolution crashes.
   * **Resolution:** Restored and elevated the modular semantic engine from Git HEAD. Reinstalled dependencies via clean `npm ci`. Unified the engine by incorporating the additional detectors (`Badge`, `Avatar`, `Modal`, `HeroSection`, `List`/`Grid`) and mapping to React component suggestions. Rewrote `backend/src/utils/semanticClassifier.js` to serve as a backward-compatible adapter delegating directly to the unified modular engine, eliminating duplicate competing logic.
2. **ESM / CommonJS Conflict in `url.js`:**
   * **Root Cause:** `backend/src/utility/url.js` used legacy `module.exports` syntax in an ES module project (`"type": "module"`).
   * **Resolution:** Completely migrated `backend/src/utility/url.js` to ES module syntax. Expanded it into a comprehensive URL parsing engine supporting `/file/`, `/design/`, `/proto/`, and modern Figma node ID formats (`?node-id=1:23`, `?node-id=1%3A23`, `?node-id=1-23`). Consolidated duplicate parsing in `helpers.js` and `figmaService.js`.
3. **Missing Error Handling & Request Validation:**
   * **Resolution:** Built Express 5-compatible middleware in `backend/src/middleware/`:
     * `errorHandler.js`: Handles operational errors, 404s, and maps Figma API status codes (401 invalid token, 403 forbidden, 404 not found, 429 rate limit with `Retry-After` header, 504 timeout, 503 network failure).
     * `validator.js`: Validates URL parameters, rejects malformed inputs, and attaches parsed metadata to request objects.
4. **Environment Configuration Loading:**
   * Resolved a path-resolution issue in `backend/index.js` by resolving `.env` relative to the server script location (`path.resolve(__dirname, '.env')`), ensuring environment variables are always loaded regardless of the execution working directory. Created `.env.example` in both `backend` and `frontend`.
5. **Node.js Native Automated Test Suite:**
   * Implemented 44 automated tests across 5 test suites (`url.test.js`, `semantic.test.js`, `nodeProcessor.test.js`, `figmaService.test.js`, `apiErrorHandling.test.js`). 100% passing.

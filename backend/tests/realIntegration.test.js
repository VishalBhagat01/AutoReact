import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from '../index.js';
import { PythonServiceClient } from '../src/services/pythonServiceClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

describe('Real Live Integration: Node.js Express Gateway <-> Real Python FastAPI Microservice', () => {
  let pythonProcess;
  let expressServer;
  let expressBaseUrl;
  const pythonPort = 8005;
  const pythonBaseUrl = `http://127.0.0.1:${pythonPort}`;
  const sharedSecret = 'test_integration_secret_2026';
  let client;

  before(async () => {
    // 1. Launch real Python FastAPI service via uvicorn in ai-service or agent directory
    const candidateDirs = ['ai-service', 'agent'];
    let agentDir = path.join(rootDir, 'ai-service');
    let pythonExe = path.join(agentDir, '.venv', 'Scripts', 'python.exe');
    for (const dir of candidateDirs) {
      const pExe = path.join(rootDir, dir, '.venv', 'Scripts', 'python.exe');
      if (fs.existsSync(pExe)) {
        agentDir = path.join(rootDir, dir);
        pythonExe = pExe;
        break;
      }
    }

    await new Promise((resolve, reject) => {
      pythonProcess = spawn(
        pythonExe,
        ['-m', 'uvicorn', 'app.main:app', '--port', String(pythonPort), '--host', '127.0.0.1'],
        {
          cwd: agentDir,
          env: {
            ...process.env,
            PORT: String(pythonPort),
            HOST: '127.0.0.1',
            SERVICE_SECRET: sharedSecret,
            ENVIRONMENT: 'test',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', data => {
        stdout += data.toString();
        if (stdout.includes('Application startup complete') || stdout.includes('Uvicorn running on')) {
          resolve();
        }
      });

      pythonProcess.stderr.on('data', data => {
        stderr += data.toString();
        if (stderr.includes('Application startup complete') || stderr.includes('Uvicorn running on')) {
          resolve();
        }
      });

      pythonProcess.on('error', err => {
        reject(new Error(`Failed to start Python FastAPI process: ${err.message}`));
      });

      pythonProcess.on('exit', code => {
        if (code !== null && code !== 0) {
          reject(new Error(`Python process exited prematurely with code ${code}. Stderr: ${stderr}`));
        }
      });

      // 10s fallback timeout for startup check
      setTimeout(async () => {
        try {
          const res = await fetch(`${pythonBaseUrl}/health`);
          if (res.ok) return resolve();
        } catch {
          // continue waiting
        }
      }, 3000);
    });

    // 2. Initialize PythonServiceClient pointing to real FastAPI microservice
    client = new PythonServiceClient({
      baseUrl: pythonBaseUrl,
      secret: sharedSecret,
      timeout: 5000,
      maxRetries: 1,
    });

    // 3. Start Express ephemeral server
    await new Promise(resolve => {
      expressServer = app.listen(0, '127.0.0.1', () => {
        const address = expressServer.address();
        expressBaseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (expressServer) {
      await new Promise(resolve => expressServer.close(resolve));
    }
    if (pythonProcess) {
      pythonProcess.kill('SIGTERM');
      setTimeout(() => {
        try {
          pythonProcess.kill('SIGKILL');
        } catch {}
      }, 500);
    }
  });

  it('1. Node.js reaches real Python FastAPI GET /health', async () => {
    const health = await client.checkHealth();
    assert.equal(health.status, 'ok');
    assert.equal(health.service, 'reagmat-ai-service');
    assert.equal(health.version, '1.0.0');
  });

  it('2. Node.js reaches real Python FastAPI GET /api/v1/capabilities', async () => {
    const caps = await client.getCapabilities();
    assert.equal(caps.status, 'operational');
    assert.equal(caps.capabilities.internal_service_authentication, true);
    assert.equal(caps.capabilities.design_payload_validation, true);
    assert.equal(caps.capabilities.geometry_spatial_analysis, true);
    assert.equal(caps.capabilities.relationship_graph, true);
    assert.equal(caps.capabilities.layout_inference, true);
    assert.equal(caps.capabilities.repeated_component_detection, true);
    assert.equal(caps.capabilities.code_generation, false);
  });

  it('3. Real Python FastAPI validates AST and returns structural analysis & graph via Node.js client', async () => {
    const payload = {
      requestId: 'req_live_test_42',
      fileKey: 'figma_live_key_999',
      fileName: 'Live Integration Frame',
      tree: {
        id: '1:1',
        name: 'Card Container',
        type: 'FRAME',
        bounds: { x: 0, y: 0, width: 320, height: 480 },
        layout: { mode: 'column', gap: 16, padding: { all: 24 } },
        styles: { colors: [{ type: 'SOLID', color: '#FFFFFF' }] },
        children: [
          {
            id: '1:2',
            name: 'Card Title',
            type: 'TEXT',
            text: 'Real-time AI Synthesis',
            bounds: { x: 24, y: 24, width: 272, height: 28 },
          },
          {
            id: '1:3',
            name: 'Card Subtitle',
            type: 'TEXT',
            text: 'Live Python microservice integration',
            bounds: { x: 24, y: 60, width: 272, height: 20 },
          },
        ],
      },
    };

    const result = await client.analyzeDesign(payload);

    assert.equal(result.success, true);
    assert.equal(result.requestId, 'req_live_test_42');
    assert.equal(result.status, 'analyzed');
    assert.equal(result.nodeCount, 3); // 1 container + 2 text nodes
    assert.equal(result.summary.totalNodes, 3);
    assert.equal(result.summary.containerNodes, 1);
    assert.equal(result.summary.textNodes, 2);
    assert.equal(result.summary.hasLayout, true);
    assert.equal(result.summary.hasStyles, true);
    assert.equal(result.capabilities.geometry_spatial_analysis, 'completed');
    assert.equal(result.capabilities.relationship_graph, 'completed');
    assert.equal(result.capabilities.code_generation, 'pending');

    // Graph verification
    assert.ok(result.graph);
    assert.equal(result.graph.nodeCount, 3);
    assert.ok(result.graph.edgeCount >= 2);
  });

  it('4. Real Python FastAPI analyzes geometry (POST /api/v1/geometry/analyze)', async () => {
    const payload = {
      fileKey: 'geo_key_1',
      fileName: 'Geometry Frame',
      tree: {
        id: 'p1',
        name: 'ParentRow',
        type: 'FRAME',
        bounds: { x: 0, y: 0, width: 400, height: 100 },
        children: [
          { id: 'b1', name: 'Item 1', type: 'FRAME', bounds: { x: 20, y: 30, width: 80, height: 40 } },
          { id: 'b2', name: 'Item 2', type: 'FRAME', bounds: { x: 120, y: 30, width: 80, height: 40 } },
        ],
      },
    };

    const geoResult = await client.analyzeGeometry(payload);
    assert.equal(geoResult.success, true);
    assert.equal(geoResult.nodeCount, 3);
    assert.ok(geoResult.alignments.length >= 1);
    assert.ok(geoResult.spacings.length >= 1);
  });

  it('5. Real Python FastAPI infers layouts (POST /api/v1/layout/infer)', async () => {
    const payload = {
      tree: {
        id: 'col_container',
        name: 'ColumnContainer',
        type: 'FRAME',
        layout: { mode: 'column', gap: 12 },
        children: [
          { id: 'c1', type: 'TEXT', bounds: { x: 0, y: 0, width: 100, height: 20 } },
          { id: 'c2', type: 'TEXT', bounds: { x: 0, y: 32, width: 100, height: 20 } },
        ],
      },
    };

    const layouts = await client.inferLayout(payload);
    assert.ok(Array.isArray(layouts));
    assert.equal(layouts[0].pattern, 'FLEX_COLUMN');
    assert.ok(layouts[0].confidence >= 0.95);
  });

  it('6. Real Python FastAPI generates relationship graph (POST /api/v1/graph/generate)', async () => {
    const payload = {
      tree: {
        id: 'g_root',
        name: 'GraphRoot',
        type: 'FRAME',
        bounds: { x: 0, y: 0, width: 500, height: 300 },
        children: [
          { id: 'child_1', name: 'Child 1', type: 'TEXT', bounds: { x: 10, y: 10, width: 100, height: 20 } },
        ],
      },
    };

    const graph = await client.generateGraph(payload);
    assert.equal(graph.nodeCount, 2);
    assert.ok(graph.edges.length >= 1);
    assert.equal(graph.edges[0].type, 'PARENT_OF');
  });

  it('7. Real Python FastAPI detects repeated components (POST /api/v1/components/detect)', async () => {
    const payload = {
      tree: {
        id: 'screen',
        type: 'FRAME',
        bounds: { x: 0, y: 0, width: 600, height: 400 },
        children: [
          {
            id: 'btn1',
            name: 'Button',
            type: 'FRAME',
            bounds: { x: 20, y: 20, width: 120, height: 40 },
            children: [{ id: 't1', type: 'TEXT', text: 'OK' }],
          },
          {
            id: 'btn2',
            name: 'Button',
            type: 'FRAME',
            bounds: { x: 160, y: 20, width: 120, height: 40 },
            children: [{ id: 't2', type: 'TEXT', text: 'Cancel' }],
          },
        ],
      },
    };

    const comps = await client.detectComponents(payload);
    assert.ok(Array.isArray(comps));
    assert.ok(comps.length >= 1);
    assert.equal(comps[0].instanceCount, 2);
  });

  it('8. Real Python FastAPI rejects unauthorized request with 401', async () => {
    const unauthClient = new PythonServiceClient({
      baseUrl: pythonBaseUrl,
      secret: '', // Missing secret
      maxRetries: 0,
    });

    await assert.rejects(
      async () => {
        await unauthClient.analyzeDesign({
          tree: { id: '1:1', name: 'Frame', type: 'FRAME' },
        });
      },
      (err) => {
        assert.equal(err.status, 500);
        assert.equal(err.code, 'AI_SERVICE_AUTH_ERROR');
        return true;
      }
    );
  });

  it('9. Real Python FastAPI rejects invalid service secret with 403', async () => {
    const invalidClient = new PythonServiceClient({
      baseUrl: pythonBaseUrl,
      secret: 'wrong_secret_123',
      maxRetries: 0,
    });

    await assert.rejects(
      async () => {
        await invalidClient.analyzeDesign({
          tree: { id: '1:1', name: 'Frame', type: 'FRAME' },
        });
      },
      (err) => {
        assert.equal(err.status, 500);
        assert.equal(err.code, 'AI_SERVICE_FORBIDDEN');
        return true;
      }
    );
  });

  it('10. End-to-end HTTP request through Express gateway endpoints to real Python FastAPI service', async () => {
    const originalEnvUrl = process.env.PYTHON_SERVICE_URL;
    const originalEnvSecret = process.env.PYTHON_SERVICE_SECRET;
    process.env.PYTHON_SERVICE_URL = pythonBaseUrl;
    process.env.PYTHON_SERVICE_SECRET = sharedSecret;

    try {
      // Test /api/ai/analyze
      const resAnalyze = await fetch(`${expressBaseUrl}/api/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileKey: 'e2e_test_key',
          fileName: 'E2E Design',
          tree: {
            id: '2:1',
            name: 'Root Frame',
            type: 'FRAME',
            bounds: { x: 0, y: 0, width: 400, height: 600 },
          },
        }),
      });

      const bodyAnalyze = await resAnalyze.json();
      assert.equal(resAnalyze.status, 200);
      assert.equal(bodyAnalyze.success, true);
      assert.equal(bodyAnalyze.data.nodeCount, 1);
      assert.equal(bodyAnalyze.data.status, 'analyzed');

      // Test /api/ai/geometry
      const resGeo = await fetch(`${expressBaseUrl}/api/ai/geometry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tree: {
            id: '2:2',
            name: 'Geo Frame',
            type: 'FRAME',
            bounds: { x: 0, y: 0, width: 300, height: 200 },
          },
        }),
      });
      const bodyGeo = await resGeo.json();
      assert.equal(resGeo.status, 200);
      assert.equal(bodyGeo.success, true);
      assert.ok(bodyGeo.data.boundsByNodeId);

      // Test /api/ai/layout
      const resLayout = await fetch(`${expressBaseUrl}/api/ai/layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tree: {
            id: '2:3',
            name: 'Layout Frame',
            type: 'FRAME',
            layout: { mode: 'row' },
            children: [{ id: 'ch1', type: 'TEXT' }],
          },
        }),
      });
      const bodyLayout = await resLayout.json();
      assert.equal(resLayout.status, 200);
      assert.equal(bodyLayout.success, true);
      assert.equal(bodyLayout.data[0].pattern, 'FLEX_ROW');

      // Test /api/ai/graph
      const resGraph = await fetch(`${expressBaseUrl}/api/ai/graph`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tree: {
            id: '2:4',
            name: 'Graph Frame',
            type: 'FRAME',
            bounds: { x: 0, y: 0, width: 200, height: 100 },
          },
        }),
      });
      const bodyGraph = await resGraph.json();
      assert.equal(resGraph.status, 200);
      assert.equal(bodyGraph.success, true);
      assert.equal(bodyGraph.data.nodeCount, 1);

      // Test /api/ai/components/detect
      const resComp = await fetch(`${expressBaseUrl}/api/ai/components/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tree: {
            id: '2:5',
            type: 'FRAME',
            children: [
              { id: 'b1', type: 'FRAME', bounds: { x: 0, y: 0, width: 80, height: 30 } },
              { id: 'b2', type: 'FRAME', bounds: { x: 90, y: 0, width: 80, height: 30 } },
            ],
          },
        }),
      });
      const bodyComp = await resComp.json();
      assert.equal(resComp.status, 200);
      assert.equal(bodyComp.success, true);
      assert.ok(Array.isArray(bodyComp.data));
    } finally {
      process.env.PYTHON_SERVICE_URL = originalEnvUrl;
      process.env.PYTHON_SERVICE_SECRET = originalEnvSecret;
    }
  });
});

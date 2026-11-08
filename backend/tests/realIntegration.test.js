import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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
    // 1. Launch real Python FastAPI service via uvicorn in agent directory
    const pythonExe = path.join(rootDir, 'agent', '.venv', 'Scripts', 'python.exe');
    const agentDir = path.join(rootDir, 'agent');

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
      // On Windows ensure tree is killed if necessary
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
    assert.equal(caps.capabilities.geometry_spatial_analysis, false);
    assert.equal(caps.capabilities.code_generation, false);
  });

  it('3. Real Python FastAPI validates AST and returns structural analysis via Node.js client', async () => {
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
    assert.equal(result.status, 'validated');
    assert.equal(result.nodeCount, 3); // 1 container + 2 text nodes
    assert.equal(result.summary.totalNodes, 3);
    assert.equal(result.summary.containerNodes, 1);
    assert.equal(result.summary.textNodes, 2);
    assert.equal(result.summary.hasLayout, true);
    assert.equal(result.summary.hasStyles, true);
    assert.equal(result.capabilities.geometry_spatial_analysis, 'pending');
    assert.equal(result.capabilities.code_generation, 'pending');
  });

  it('4. Real Python FastAPI rejects unauthorized request with 401', async () => {
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

  it('5. Real Python FastAPI rejects invalid service secret with 403', async () => {
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

  it('6. Real Python FastAPI rejects invalid Pydantic schema with 422', async () => {
    await assert.rejects(
      async () => {
        await client.analyzeDesign({
          tree: { name: 'Node Without Required ID Field' }, // missing id
        });
      },
      (err) => {
        assert.equal(err.status, 422);
        assert.equal(err.code, 'AI_SERVICE_VALIDATION_ERROR');
        return true;
      }
    );
  });

  it('7. End-to-end HTTP request through Express gateway to real Python FastAPI service', async () => {
    const originalEnvUrl = process.env.PYTHON_SERVICE_URL;
    const originalEnvSecret = process.env.PYTHON_SERVICE_SECRET;
    process.env.PYTHON_SERVICE_URL = pythonBaseUrl;
    process.env.PYTHON_SERVICE_SECRET = sharedSecret;

    try {
      const res = await fetch(`${expressBaseUrl}/api/ai/analyze`, {
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

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data.success, true);
      assert.equal(body.data.nodeCount, 1);
      assert.equal(body.data.status, 'validated');
    } finally {
      process.env.PYTHON_SERVICE_URL = originalEnvUrl;
      process.env.PYTHON_SERVICE_SECRET = originalEnvSecret;
    }
  });
});

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../index.js';
import { PythonServiceClient, pythonServiceClient } from '../src/services/pythonServiceClient.js';

describe('Python AI Service Client & Integration', () => {
  let expressServer;
  let expressBaseUrl;
  let mockPythonServer;
  let mockPythonPort;
  let mockPythonUrl;
  let receivedAuthHeader = null;
  let lastReceivedPayload = null;

  before(async () => {
    // 1. Start a Mock Python FastAPI server to test contracts and headers deterministically
    await new Promise((resolve) => {
      mockPythonServer = http.createServer((req, res) => {
        receivedAuthHeader = req.headers['x-service-secret'] || null;

        // Health check endpoint
        if (req.method === 'GET' && (req.url === '/health' || req.url === '/api/v1/health')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            status: 'ok',
            service: 'reagmat-ai-service',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            environment: 'test',
          }));
        }

        // Capabilities endpoint
        if (req.method === 'GET' && req.url === '/api/v1/capabilities') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            service: 'reagmat-ai-service',
            version: '1.0.0',
            status: 'operational',
            capabilities: {
              health_check: true,
              design_payload_validation: true,
              design_metadata_extraction: true,
              node_counting: true,
              geometry_spatial_analysis: true,
              relationship_graph: true,
              layout_inference: true,
              repeated_component_detection: true,
              semantic_reasoning: false,
              code_generation: false,
            },
            supported_versions: ['v1'],
            environment: 'test',
          }));
        }

        // Check authentication for all protected endpoints
        if (req.url.startsWith('/api/v1/')) {
          if (!receivedAuthHeader) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              success: false,
              error: 'Missing internal service authentication. Expected X-Service-Secret header.',
              code: 'UNAUTHORIZED',
            }));
          }

          if (receivedAuthHeader !== 'test_secret_key_xyz') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              success: false,
              error: 'Invalid internal service credentials.',
              code: 'FORBIDDEN',
            }));
          }
        }

        // POST /api/v1/geometry/analyze
        if (req.method === 'POST' && req.url === '/api/v1/geometry/analyze') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: true,
            requestId: 'req_geo_1',
            nodeCount: 2,
            boundsByNodeId: { '1:1': { x: 0, y: 0, width: 100, height: 100 } },
            alignments: [],
            spacings: [],
            overlaps: [],
            gridClusters: [],
          }));
        }

        // POST /api/v1/layout/infer
        if (req.method === 'POST' && req.url === '/api/v1/layout/infer') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([
            { nodeId: '1:1', pattern: 'FLEX_ROW', confidence: 0.95, evidence: ['Auto layout'] },
          ]));
        }

        // POST /api/v1/graph/generate
        if (req.method === 'POST' && req.url === '/api/v1/graph/generate') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            nodes: [{ id: '1:1', name: 'Root', type: 'FRAME' }],
            edges: [],
            nodeCount: 1,
            edgeCount: 0,
            edgeTypeDistribution: {},
            analysisWarnings: [],
          }));
        }

        // POST /api/v1/components/detect
        if (req.method === 'POST' && req.url === '/api/v1/components/detect') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([
            { componentId: 'comp_1', name: 'Button', source: 'inferred_pattern', instanceCount: 2 },
          ]));
        }

        // POST /api/v1/design/analyze
        if (req.method === 'POST' && req.url === '/api/v1/design/analyze') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              lastReceivedPayload = data;

              // Validate payload requires node ID if tree is given
              if (data.tree && !data.tree.id) {
                res.writeHead(422, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({
                  success: false,
                  error: 'Validation error: tree.id required',
                  code: 'VALIDATION_ERROR',
                }));
              }

              res.writeHead(200, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({
                success: true,
                requestId: data.requestId || 'req_mock_123',
                status: 'validated',
                serviceVersion: '1.0.0',
                nodeCount: 1,
                metadata: {
                  fileKey: data.fileKey || 'mock_file_key',
                  fileName: data.fileName || 'Mock Design',
                  analyzedAt: new Date().toISOString(),
                },
                summary: {
                  totalNodes: 1,
                  containerNodes: 1,
                  textNodes: 0,
                  hasLayout: true,
                  hasStyles: true,
                },
                capabilities: {
                  payload_validation: 'completed',
                  geometry_spatial_analysis: 'completed',
                  relationship_graph: 'completed',
                  semantic_reasoning: 'pending',
                  code_generation: 'pending',
                },
                message: 'Validated design AST payload with 1 node(s).',
              }));
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ error: 'Invalid JSON body' }));
            }
          });
          return;
        }

        // Default 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      });

      mockPythonServer.listen(0, '127.0.0.1', () => {
        mockPythonPort = mockPythonServer.address().port;
        mockPythonUrl = `http://127.0.0.1:${mockPythonPort}`;
        resolve();
      });
    });

    // 2. Start Express app ephemeral server
    await new Promise((resolve) => {
      expressServer = app.listen(0, '127.0.0.1', () => {
        const address = expressServer.address();
        expressBaseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (expressServer) {
      await new Promise((resolve) => expressServer.close(resolve));
    }
    if (mockPythonServer) {
      await new Promise((resolve) => mockPythonServer.close(resolve));
    }
  });

  describe('PythonServiceClient Unit Functionality', () => {
    it('initializes with default and custom configurations', () => {
      const client = new PythonServiceClient({
        baseUrl: 'http://localhost:8000',
        secret: 'custom_secret_123',
        timeout: 5000,
        maxRetries: 1,
      });

      assert.equal(client.baseUrl, 'http://localhost:8000');
      assert.equal(client.secret, 'custom_secret_123');
      assert.equal(client.timeout, 5000);
      assert.equal(client.maxRetries, 1);
    });

    it('masks service secret to prevent leakage in logs or exceptions', () => {
      const client = new PythonServiceClient({ secret: 'super_secret_value_xyz' });
      const rawMsg = 'Failed request with secret super_secret_value_xyz at endpoint';
      const sanitized = client.maskSecret(rawMsg);

      assert.ok(!sanitized.includes('super_secret_value_xyz'));
      assert.ok(sanitized.includes('***REDACTED_SECRET***'));
    });

    it('detects service downtime and throws 503 AI_SERVICE_UNAVAILABLE', async () => {
      const client = new PythonServiceClient({
        baseUrl: 'http://127.0.0.1:49876',
        secret: 'test_secret',
        timeout: 500,
        maxRetries: 0,
      });

      await assert.rejects(
        async () => {
          await client.checkHealth();
        },
        (err) => {
          assert.equal(err.status, 503);
          assert.equal(err.code, 'AI_SERVICE_UNAVAILABLE');
          assert.ok(err.message.includes('unreachable'));
          return true;
        }
      );
    });

    it('rejects design payload when required input is missing', async () => {
      const client = new PythonServiceClient();
      await assert.rejects(
        async () => {
          await client.analyzeDesign(null);
        },
        (err) => {
          assert.equal(err.status, 400);
          assert.equal(err.code, 'MISSING_PAYLOAD');
          return true;
        }
      );
    });
  });

  describe('Node-Python Contract & Communication (via Mock Server)', () => {
    let client;

    before(() => {
      client = new PythonServiceClient({
        baseUrl: mockPythonUrl,
        secret: 'test_secret_key_xyz',
        timeout: 2000,
        maxRetries: 1,
      });
    });

    it('successfully queries /health and returns parsed JSON', async () => {
      const result = await client.checkHealth();
      assert.equal(result.status, 'ok');
      assert.equal(result.service, 'reagmat-ai-service');
      assert.equal(result.version, '1.0.0');
    });

    it('successfully queries /api/v1/capabilities', async () => {
      const result = await client.getCapabilities();
      assert.equal(result.status, 'operational');
      assert.equal(result.capabilities.health_check, true);
      assert.equal(result.capabilities.geometry_spatial_analysis, true);
      assert.equal(result.capabilities.code_generation, false);
    });

    it('transmits internal authentication header (X-Service-Secret)', async () => {
      await client.analyzeDesign({
        requestId: 'req_auth_test',
        tree: { id: '1:1', name: 'Frame 1', type: 'FRAME' },
      });

      assert.equal(receivedAuthHeader, 'test_secret_key_xyz');
    });

    it('client queries analyzeGeometry successfully', async () => {
      const geo = await client.analyzeGeometry({ tree: { id: '1:1' } });
      assert.equal(geo.success, true);
      assert.equal(geo.nodeCount, 2);
    });

    it('client queries inferLayout successfully', async () => {
      const layouts = await client.inferLayout({ tree: { id: '1:1' } });
      assert.equal(layouts[0].pattern, 'FLEX_ROW');
    });

    it('client queries generateGraph successfully', async () => {
      const graph = await client.generateGraph({ tree: { id: '1:1' } });
      assert.equal(graph.nodeCount, 1);
    });

    it('client queries detectComponents successfully', async () => {
      const comps = await client.detectComponents({ tree: { id: '1:1' } });
      assert.equal(comps[0].componentId, 'comp_1');
    });

    it('handles 401 Unauthorized when secret is missing', async () => {
      const unauthClient = new PythonServiceClient({
        baseUrl: mockPythonUrl,
        secret: '', // Empty secret
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

    it('handles 403 Forbidden when secret is incorrect', async () => {
      const invalidClient = new PythonServiceClient({
        baseUrl: mockPythonUrl,
        secret: 'wrong_secret_value',
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

    it('handles 422 validation failure from Python service', async () => {
      await assert.rejects(
        async () => {
          await client.analyzeDesign({
            tree: { name: 'Invalid Node Without ID' }, // Missing id
          });
        },
        (err) => {
          assert.equal(err.status, 422);
          assert.equal(err.code, 'AI_SERVICE_VALIDATION_ERROR');
          return true;
        }
      );
    });
  });

  describe('Express Gateway AI Endpoints (/api/ai/*)', () => {
    let originalEnvUrl;
    let originalEnvSecret;

    before(() => {
      originalEnvUrl = process.env.PYTHON_SERVICE_URL;
      originalEnvSecret = process.env.PYTHON_SERVICE_SECRET;
      process.env.PYTHON_SERVICE_URL = mockPythonUrl;
      process.env.PYTHON_SERVICE_SECRET = 'test_secret_key_xyz';
      pythonServiceClient.baseUrl = mockPythonUrl;
      pythonServiceClient.secret = 'test_secret_key_xyz';
      pythonServiceClient.maxRetries = 0;
    });

    after(() => {
      process.env.PYTHON_SERVICE_URL = originalEnvUrl;
      process.env.PYTHON_SERVICE_SECRET = originalEnvSecret;
      pythonServiceClient.baseUrl = null;
      pythonServiceClient.secret = null;
      pythonServiceClient.maxRetries = 2;
    });

    it('GET /api/ai/health proxies Python health check', async () => {
      const res = await fetch(`${expressBaseUrl}/api/ai/health`);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.aiService.status, 'ok');
      assert.equal(body.aiService.service, 'reagmat-ai-service');
    });

    it('GET /api/ai/capabilities proxies capabilities status', async () => {
      const res = await fetch(`${expressBaseUrl}/api/ai/capabilities`);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data.status, 'operational');
      assert.equal(body.data.capabilities.node_counting, true);
      assert.equal(body.data.capabilities.geometry_spatial_analysis, true);
      assert.equal(body.data.capabilities.code_generation, false);
    });

    it('POST /api/ai/analyze forwards design AST and returns structured analysis', async () => {
      const res = await fetch(`${expressBaseUrl}/api/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileKey: 'figma_test_key',
          fileName: 'Test File',
          tree: {
            id: '1:100',
            name: 'Main Card',
            type: 'FRAME',
          },
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data.status, 'validated');
      assert.equal(body.data.nodeCount, 1);
      assert.equal(body.data.summary.totalNodes, 1);
      assert.ok(body.data.requestId.startsWith('req_'));
    });

    it('POST /api/ai/geometry proxies geometry analysis', async () => {
      const res = await fetch(`${expressBaseUrl}/api/ai/geometry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tree: { id: '1:101', name: 'Frame', type: 'FRAME' },
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data.nodeCount, 2);
    });

    it('POST /api/ai/layout proxies layout inference', async () => {
      const res = await fetch(`${expressBaseUrl}/api/ai/layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tree: { id: '1:102', name: 'Frame', type: 'FRAME' },
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data[0].pattern, 'FLEX_ROW');
    });

    it('POST /api/ai/graph proxies graph generation', async () => {
      const res = await fetch(`${expressBaseUrl}/api/ai/graph`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tree: { id: '1:103', name: 'Frame', type: 'FRAME' },
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data.nodeCount, 1);
    });

    it('POST /api/ai/components/detect proxies component detection', async () => {
      const res = await fetch(`${expressBaseUrl}/api/ai/components/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tree: { id: '1:104', name: 'Frame', type: 'FRAME' },
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data[0].componentId, 'comp_1');
    });

    it('POST /api/ai/analyze validates missing design payload', async () => {
      const res = await fetch(`${expressBaseUrl}/api/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.equal(body.code, 'MISSING_DESIGN_PAYLOAD');
    });

    it('POST /api/ai/analyze handles Python service downtime with 503', async () => {
      pythonServiceClient.baseUrl = 'http://127.0.0.1:49999';

      const res = await fetch(`${expressBaseUrl}/api/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tree: { id: '1:1', name: 'Frame', type: 'FRAME' },
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 503);
      assert.equal(body.success, false);
      assert.equal(body.code, 'AI_SERVICE_UNAVAILABLE');
      assert.ok(body.error.includes('unreachable'));
      assert.ok(!JSON.stringify(body).includes('test_secret_key_xyz'));

      pythonServiceClient.baseUrl = mockPythonUrl;
    });
  });
});

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../index.js';
import { handleFigmaApiError, AppError } from '../src/services/figmaService.js';

describe('API Endpoints and Error Handling', () => {
  let server;
  let baseUrl;

  before(async () => {
    // Start an ephemeral test server
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('Health Endpoints', () => {
    it('GET /health returns 200 with operational status', async () => {
      const res = await fetch(`${baseUrl}/health`);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.status, 'ok');
      assert.ok(body.message.includes('running'));
    });

    it('GET /api/figma/health returns 200 operational message', async () => {
      const res = await fetch(`${baseUrl}/api/figma/health`);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.ok(body.message.includes('operational'));
    });
  });

  describe('Request Validation & Error Responses on /api/figma/import', () => {
    it('returns 400 when url is missing from body', async () => {
      const res = await fetch(`${baseUrl}/api/figma/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.equal(body.code, 'MISSING_URL');
    });

    it('returns 400 when url is not a valid Figma URL', async () => {
      const res = await fetch(`${baseUrl}/api/figma/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://google.com/search?q=figma' }),
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.equal(body.code, 'INVALID_FIGMA_URL');
    });

    it('returns 404 with standard code when hitting nonexistent routes', async () => {
      const res = await fetch(`${baseUrl}/api/nonexistent`);
      const body = await res.json();

      assert.equal(res.status, 404);
      assert.equal(body.success, false);
      assert.equal(body.code, 'ROUTE_NOT_FOUND');
    });
  });

  describe('handleFigmaApiError Unit Tests', () => {
    it('maps 401 Unauthorized to FIGMA_UNAUTHORIZED', () => {
      const mock401 = { response: { status: 401, data: { message: 'Invalid token' } } };
      assert.throws(() => handleFigmaApiError(mock401), {
        status: 401,
        code: 'FIGMA_UNAUTHORIZED',
      });
    });

    it('maps 403 Forbidden to FIGMA_FORBIDDEN', () => {
      const mock403 = { response: { status: 403, data: { message: 'Access denied' } } };
      assert.throws(() => handleFigmaApiError(mock403), {
        status: 403,
        code: 'FIGMA_FORBIDDEN',
      });
    });

    it('maps 404 Not Found to FIGMA_NOT_FOUND', () => {
      const mock404 = { response: { status: 404, data: { message: 'Not found' } } };
      assert.throws(() => handleFigmaApiError(mock404), {
        status: 404,
        code: 'FIGMA_NOT_FOUND',
      });
    });

    it('maps 429 Rate Limit to FIGMA_RATE_LIMITED with retryAfter', () => {
      const mock429 = {
        response: {
          status: 429,
          headers: { 'retry-after': '30' },
          data: { message: 'Rate limit exceeded' },
        },
      };
      assert.throws(() => handleFigmaApiError(mock429), (err) => {
        return err.status === 429 && err.code === 'FIGMA_RATE_LIMITED' && err.retryAfter === '30';
      });
    });

    it('maps network timeout to 504 GATEWAY_TIMEOUT', () => {
      const mockTimeout = { code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' };
      assert.throws(() => handleFigmaApiError(mockTimeout), {
        status: 504,
        code: 'GATEWAY_TIMEOUT',
      });
    });

    it('maps network disconnect to 503 NETWORK_ERROR', () => {
      const mockNetworkError = { request: {}, message: 'Network Error' };
      assert.throws(() => handleFigmaApiError(mockNetworkError), {
        status: 503,
        code: 'NETWORK_ERROR',
      });
    });
  });
});


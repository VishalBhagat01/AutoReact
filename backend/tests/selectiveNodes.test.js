import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import app from '../index.js';
import { getSelectiveNodes, fetchFigmaNodes } from '../src/services/figmaService.js';
import { AppError } from '../src/middleware/errorHandler.js';

describe('Selective Node Retrieval Pipeline', () => {
  let server;
  let baseUrl;
  const originalAxiosGet = axios.get;

  before(async () => {
    // Start ephemeral server for API tests
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    axios.get = originalAxiosGet;
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  afterEach(() => {
    axios.get = originalAxiosGet;
  });

  const mockFigmaNodesResponse = {
    name: 'Selective UI Test Design',
    version: '2.1.0',
    nodes: {
      '1:23': {
        document: {
          id: '1:23',
          name: 'Primary Button',
          type: 'COMPONENT',
          absoluteBoundingBox: { x: 50, y: 100, width: 140, height: 44 },
          layoutMode: 'HORIZONTAL',
          paddingLeft: 16,
          paddingRight: 16,
          fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.5, b: 0.9, a: 1 } }],
          children: [
            {
              id: '1:24',
              name: 'Button Label',
              type: 'TEXT',
              characters: 'Get Started',
              style: { fontSize: 16, fontWeight: 600 },
            },
          ],
        },
        components: {
          '1:23': {
            name: 'Primary Button',
            description: 'Reusable primary button component',
          },
        },
      },
      '2:45': {
        document: {
          id: '2:45',
          name: 'Feature Card',
          type: 'FRAME',
          absoluteBoundingBox: { x: 200, y: 100, width: 320, height: 240 },
          layoutMode: 'VERTICAL',
          cornerRadius: 12,
          fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
          effects: [{ type: 'DROP_SHADOW', visible: true, radius: 8 }],
          children: [
            {
              id: '2:46',
              name: 'Card Title',
              type: 'TEXT',
              characters: 'AI-Powered Parser',
              style: { fontSize: 20, fontWeight: 700 },
            },
          ],
        },
      },
      '3:99': null, // Missing / deleted node
    },
  };

  describe('getSelectiveNodes Service Method', () => {
    it('retrieves and normalizes nodes with layout, styles, and semantic classification', async () => {
      axios.get = async (url, config) => {
        assert.ok(url.includes('/files/testFileKey/nodes'));
        assert.equal(config.headers['X-Figma-Token'], 'test-token');
        return { data: mockFigmaNodesResponse };
      };

      const result = await getSelectiveNodes(
        'testFileKey',
        ['1:23', '2:45'],
        'test-token'
      );

      assert.equal(result.fileKey, 'testFileKey');
      assert.equal(result.fileName, 'Selective UI Test Design');
      assert.equal(result.fileVersion, '2.1.0');
      assert.equal(result.totalFound, 2);
      assert.equal(result.totalRequested, 2);
      assert.equal(result.missingNodeIds.length, 0);

      // Verify node 1:23
      const buttonNode = result.nodes.find((n) => n.id === '1:23');
      assert.ok(buttonNode, 'Button node should be returned');
      assert.equal(buttonNode.name, 'Primary Button');
      assert.equal(buttonNode.type, 'COMPONENT');
      assert.equal(buttonNode.semanticType, 'Button');
      assert.equal(buttonNode.bounds.width, 140);
      assert.equal(buttonNode.bounds.height, 44);
      assert.ok(buttonNode.styles?.colors?.length > 0);
      assert.ok(buttonNode.componentMetadata, 'Component metadata should be preserved');

      // Verify node 2:45
      const cardNode = result.nodes.find((n) => n.id === '2:45');
      assert.ok(cardNode, 'Card node should be returned');
      assert.equal(cardNode.name, 'Feature Card');
      assert.ok(['Card', 'Container'].includes(cardNode.semanticType));
    });

    it('normalizes URL-style hyphenated and encoded node IDs (1-23, 1%3A23)', async () => {
      let requestedIdsParam = '';
      axios.get = async (url, config) => {
        requestedIdsParam = config.params.ids;
        return { data: mockFigmaNodesResponse };
      };

      await getSelectiveNodes('testFileKey', ['1-23', '2%3A45'], 'test-token');

      assert.equal(requestedIdsParam, '1:23,2:45');
    });

    it('identifies and reports missing or deleted node IDs gracefully', async () => {
      axios.get = async () => ({ data: mockFigmaNodesResponse });

      const result = await getSelectiveNodes(
        'testFileKey',
        ['1:23', '3:99', '4:00'],
        'test-token'
      );

      assert.equal(result.totalFound, 1);
      assert.equal(result.totalRequested, 3);
      assert.deepEqual(result.missingNodeIds, ['3:99', '4:00']);
    });

    it('validates required parameters and throws AppError', async () => {
      await assert.rejects(
        () => getSelectiveNodes('', ['1:23'], 'token'),
        (err) => err instanceof AppError && err.code === 'MISSING_FILE_KEY'
      );

      await assert.rejects(
        () => getSelectiveNodes('fileKey', [], 'token'),
        (err) => err instanceof AppError && err.code === 'MISSING_NODE_IDS'
      );

      await assert.rejects(
        () => getSelectiveNodes('fileKey', ['1:23'], null),
        (err) => err instanceof AppError && err.code === 'MISSING_FIGMA_TOKEN'
      );
    });
  });

  describe('POST /api/figma/nodes API Endpoint', () => {
    it('returns 400 when request body lacks URL or fileKey', async () => {
      const res = await fetch(`${baseUrl}/api/figma/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.code, 'MISSING_FILE_IDENTIFIER');
    });

    it('returns 400 when URL is invalid format', async () => {
      const res = await fetch(`${baseUrl}/api/figma/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/not-figma' }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.code, 'INVALID_FIGMA_URL');
    });

    it('returns 400 when no node-id is provided in URL nor in body', async () => {
      const res = await fetch(`${baseUrl}/api/figma/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://www.figma.com/design/testKey123/MyApp',
        }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.code, 'MISSING_NODE_IDS');
    });

    it('successfully extracts node-id from Figma URL query parameters', async () => {
      process.env.FIGMA_TOKEN = 'test-figma-env-token';

      axios.get = async (url, config) => {
        assert.equal(config.params.ids, '1:23');
        return { data: mockFigmaNodesResponse };
      };

      const res = await fetch(`${baseUrl}/api/figma/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://www.figma.com/design/testKey123/MyApp?node-id=1-23',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.fileKey, 'testKey123');
      assert.equal(json.data.nodes.length, 1);
      assert.equal(json.data.nodes[0].id, '1:23');
    });

    it('successfully fetches multiple nodes specified in request body', async () => {
      process.env.FIGMA_TOKEN = 'test-figma-env-token';

      axios.get = async (url, config) => {
        assert.equal(config.params.ids, '1:23,2:45');
        return { data: mockFigmaNodesResponse };
      };

      const res = await fetch(`${baseUrl}/api/figma/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileKey: 'testKey123',
          nodeIds: ['1-23', '2:45'],
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.totalFound, 2);
      assert.equal(json.data.nodes.length, 2);
    });
  });
});

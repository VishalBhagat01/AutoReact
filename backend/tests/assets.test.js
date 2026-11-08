import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import axios from 'axios';
import app from '../index.js';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Project } from '../src/models/Project.js';
import { Asset } from '../src/models/Asset.js';
import {
  identifyAssetCandidates,
  downloadAsset,
  saveAssetToDisk,
  isSafePath,
  getAssetFilename,
  sanitizeNodeId,
  attachAssetsToTree,
  exportAndDownloadAssets,
  getAssetFilePath,
  getStorageDir,
} from '../src/services/assetService.js';
import { AppError } from '../src/middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_STORAGE_DIR = path.resolve(__dirname, 'test_storage_assets');
const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/reagmat_test_assets';

describe('Figma Visual Asset Extraction and Storage Pipeline', () => {
  let server;
  let baseUrl;
  const originalAxiosGet = axios.get;
  const originalStorageDir = process.env.ASSET_STORAGE_DIR;

  before(async () => {
    process.env.ASSET_STORAGE_DIR = TEST_STORAGE_DIR;
    await connectDB(TEST_DB_URI);
    await Asset.init();
    await Project.init();

    // Start ephemeral server
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
    process.env.ASSET_STORAGE_DIR = originalStorageDir;

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await disconnectDB();
    }

    // Clean up test storage directory
    if (fs.existsSync(TEST_STORAGE_DIR)) {
      fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    axios.get = originalAxiosGet;
  });

  describe('Candidate Detection (identifyAssetCandidates)', () => {
    const mockDesignTree = {
      id: '0:1',
      name: 'Homepage Screen',
      type: 'FRAME',
      children: [
        {
          id: '1:10',
          name: 'Hero Banner Image',
          type: 'RECTANGLE',
          bounds: { x: 0, y: 0, width: 1200, height: 400 },
          styles: {
            images: [{ type: 'IMAGE', scaleMode: 'FILL', imageRef: 'img_hash_123' }],
          },
        },
        {
          id: '1:11',
          name: 'Search Icon',
          type: 'VECTOR',
          bounds: { x: 20, y: 20, width: 24, height: 24 },
        },
        {
          id: '1:12',
          name: 'Cart-Icon',
          type: 'FRAME',
          semanticType: 'icon',
          bounds: { x: 60, y: 20, width: 24, height: 24 },
        },
        {
          id: '1:13',
          name: 'Heading Text',
          type: 'TEXT',
          characters: 'Welcome to Reagmat',
        },
      ],
    };

    it('discovers image fills and vector/icon candidate nodes', () => {
      const candidates = identifyAssetCandidates(mockDesignTree);

      assert.equal(candidates.length, 3);

      const heroImage = candidates.find((c) => c.nodeId === '1:10');
      assert.ok(heroImage, 'Hero image should be identified');
      assert.equal(heroImage.assetType, 'image');
      assert.equal(heroImage.suggestedFormat, 'png');
      assert.equal(heroImage.imageRef, 'img_hash_123');

      const searchVector = candidates.find((c) => c.nodeId === '1:11');
      assert.ok(searchVector, 'Search icon vector should be identified');
      assert.equal(searchVector.assetType, 'vector_svg');
      assert.equal(searchVector.suggestedFormat, 'svg');

      const cartIcon = candidates.find((c) => c.nodeId === '1:12');
      assert.ok(cartIcon, 'Cart icon frame should be identified');
      assert.equal(cartIcon.assetType, 'icon');
      assert.equal(cartIcon.suggestedFormat, 'svg');
    });
  });

  describe('Filesystem Utilities & Security (Path Traversal Protection)', () => {
    it('sanitizes illegal filename characters across platforms', () => {
      assert.equal(sanitizeNodeId('1:23'), '1-23');
      assert.equal(sanitizeNodeId('I12:34;5:67'), 'I12-34_5-67');
      assert.equal(getAssetFilename('1:23', 2, 'png'), '1-23_2x.png');
      assert.equal(getAssetFilename('1:23', 1, 'svg'), '1-23_1x.svg');
    });

    it('strictly detects and blocks path traversal attempts', () => {
      const base = path.resolve('/var/storage/assets');
      assert.equal(isSafePath(base, path.resolve('/var/storage/assets/key123/file.png')), true);
      assert.equal(isSafePath(base, path.resolve('/var/storage/assets/../etc/passwd')), false);
      assert.equal(isSafePath(base, path.resolve('/var/other/path')), false);
    });

    it('saves binary data to disk and returns public access URL', async () => {
      const testBuffer = Buffer.from('FAKE_PNG_BINARY_CONTENT');
      const fileKey = 'sampleKey456';
      const filename = '1-23_1x.png';

      const result = await saveAssetToDisk(fileKey, filename, testBuffer);

      assert.ok(fs.existsSync(result.fullPath));
      assert.equal(result.fileSize, testBuffer.length);
      assert.equal(result.publicUrl, `/api/assets/${fileKey}/${filename}`);
    });
  });

  describe('Tree Asset Attachment (attachAssetsToTree)', () => {
    it('attaches asset metadata onto corresponding tree nodes', () => {
      const tree = {
        id: '1:1',
        name: 'Header',
        children: [
          {
            id: '1:10',
            name: 'Hero Image',
            styles: {},
          },
          {
            id: '1:11',
            name: 'Button',
          },
        ],
      };

      const assets = [
        {
          _id: 'asset_id_abc',
          figmaNodeId: '1:10',
          assetType: 'image',
          format: 'png',
          publicUrl: '/api/assets/key/1-10_1x.png',
          exportScale: 1,
          dimensions: { width: 400, height: 200 },
          fileSize: 15420,
        },
      ];

      attachAssetsToTree(tree, assets);

      const hero = tree.children[0];
      assert.ok(hero.asset, 'Asset reference should be attached');
      assert.equal(hero.asset.assetId, 'asset_id_abc');
      assert.equal(hero.asset.publicUrl, '/api/assets/key/1-10_1x.png');
      assert.equal(hero.asset.format, 'png');

      const button = tree.children[1];
      assert.equal(button.asset, undefined, 'Nodes without matching assets remain unchanged');
    });
  });

  describe('Mongoose Asset Model Persistence', () => {
    it('creates an Asset document with valid fields', async () => {
      const asset = await Asset.create({
        figmaFileKey: 'dbTestKey',
        figmaNodeId: '10:20',
        assetType: 'vector_svg',
        format: 'svg',
        storagePath: 'storage/assets/dbTestKey/10-20_1x.svg',
        publicUrl: '/api/assets/dbTestKey/10-20_1x.svg',
        dimensions: { width: 32, height: 32 },
        exportScale: 1,
        fileSize: 512,
        mimeType: 'image/svg+xml',
      });

      assert.ok(asset._id);
      assert.equal(asset.figmaFileKey, 'dbTestKey');
      assert.equal(asset.format, 'svg');
    });

    it('enforces compound uniqueness on fileKey + nodeId + format + scale', async () => {
      const duplicateData = {
        figmaFileKey: 'uniqueKey123',
        figmaNodeId: '1:1',
        format: 'png',
        exportScale: 1,
        storagePath: 'some/path.png',
        publicUrl: '/api/assets/uniqueKey123/1-1_1x.png',
      };

      await Asset.create(duplicateData);

      await assert.rejects(
        () => Asset.create(duplicateData),
        (err) => err.code === 11000
      );
    });
  });

  describe('exportAndDownloadAssets Service Workflow', () => {
    it('exports, downloads, saves to disk, and persists asset metadata', async () => {
      process.env.FIGMA_TOKEN = 'test-token';

      axios.get = async (url) => {
        if (url.includes('/images/workflowKey')) {
          return {
            data: {
              err: null,
              images: {
                '1:10': 'https://s3.figma.com/test-hero.png',
                '1:99': null, // Unrenderable node
              },
            },
          };
        }
        if (url.includes('s3.figma.com/test-hero.png')) {
          return {
            data: Buffer.from('<FAKE_IMAGE_DATA>'),
            headers: { 'content-type': 'image/png' },
          };
        }
        throw new Error(`Unexpected URL: ${url}`);
      };

      const result = await exportAndDownloadAssets({
        fileKey: 'workflowKey',
        nodeIds: ['1:10', '1:99'],
        format: 'png',
        scale: 1,
        token: 'test-token',
        nodeDimensionsMap: { '1:10': { width: 800, height: 400 } },
      });

      assert.equal(result.fileKey, 'workflowKey');
      assert.equal(result.exportedCount, 1);
      assert.equal(result.assets.length, 1);
      assert.deepEqual(result.failedNodeIds, ['1:99']);

      const asset = result.assets[0];
      assert.equal(asset.figmaNodeId, '1:10');
      assert.equal(asset.format, 'png');
      assert.ok(asset.publicUrl.includes('/api/assets/workflowKey/'));
      assert.deepEqual(asset.dimensions, { width: 800, height: 400 });

      // Verify persistence in DB
      const dbRecord = await Asset.findOne({ figmaFileKey: 'workflowKey', figmaNodeId: '1:10' });
      assert.ok(dbRecord);
      assert.equal(dbRecord.fileSize, Buffer.from('<FAKE_IMAGE_DATA>').length);
    });
  });

  describe('API Endpoints (Asset Export & Serving)', () => {
    it('POST /api/figma/assets/export validates format and scale', async () => {
      const invalidFormatRes = await fetch(`${baseUrl}/api/figma/assets/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileKey: 'testKey', format: 'bmp', nodeIds: ['1:1'] }),
      });
      assert.equal(invalidFormatRes.status, 400);

      const invalidScaleRes = await fetch(`${baseUrl}/api/figma/assets/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileKey: 'testKey', format: 'png', scale: 10, nodeIds: ['1:1'] }),
      });
      assert.equal(invalidScaleRes.status, 400);
    });

    it('POST /api/figma/assets/export performs export and returns assets', async () => {
      process.env.FIGMA_TOKEN = 'test-token';

      axios.get = async (url) => {
        if (url.includes('/images/apiExportKey')) {
          return {
            data: {
              err: null,
              images: { '5:50': 'https://s3.figma.com/icon.svg' },
            },
          };
        }
        if (url.includes('s3.figma.com/icon.svg')) {
          return {
            data: Buffer.from('<svg><circle r="10"/></svg>'),
            headers: { 'content-type': 'image/svg+xml' },
          };
        }
        throw new Error(`Unexpected URL: ${url}`);
      };

      const res = await fetch(`${baseUrl}/api/figma/assets/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileKey: 'apiExportKey',
          nodeIds: ['5:50'],
          format: 'svg',
          scale: 1,
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.exportedCount, 1);
      assert.equal(json.data.assets[0].format, 'svg');
      assert.equal(json.data.assets[0].figmaNodeId, '5:50');
    });

    it('GET /api/assets/:fileKey/:filename serves static file with correct headers', async () => {
      const testFileKey = 'serveTestKey';
      const testFilename = 'serve_icon_1x.svg';
      const fileContent = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="20" height="20"/></svg>';

      await saveAssetToDisk(testFileKey, testFilename, Buffer.from(fileContent));

      const res = await fetch(`${baseUrl}/api/assets/${testFileKey}/${testFilename}`);

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'image/svg+xml');
      assert.ok(res.headers.get('cache-control')?.includes('max-age=86400'));
      const text = await res.text();
      assert.equal(text, fileContent);
    });

    it('GET /api/assets/:fileKey/:filename returns 404 for nonexistent files', async () => {
      const res = await fetch(`${baseUrl}/api/assets/serveTestKey/nonexistent.png`);
      assert.equal(res.status, 404);
      const json = await res.json();
      assert.equal(json.code, 'ASSET_NOT_FOUND');
    });

    it('GET /api/projects/:id/assets returns assets belonging to project', async () => {
      const project = await Project.create({
        name: 'Asset Project',
        figmaFileKey: 'projAssetKey',
        figmaFileUrl: 'https://figma.com/design/projAssetKey/App',
      });

      await Asset.create({
        projectId: project._id,
        figmaFileKey: 'projAssetKey',
        figmaNodeId: '10:99',
        format: 'png',
        storagePath: 'storage/test.png',
        publicUrl: '/api/assets/projAssetKey/10-99_1x.png',
      });

      const res = await fetch(`${baseUrl}/api/projects/${project._id}/assets`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.count, 1);
      assert.equal(json.data[0].figmaNodeId, '10:99');
    });
  });
});


import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import app from '../index.js';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Project } from '../src/models/Project.js';
import { DesignTree } from '../src/models/DesignTree.js';
import { Asset } from '../src/models/Asset.js';
import { DesignIR } from '../src/models/DesignIR.js';
import { DesignIRPage } from '../src/models/DesignIRPage.js';
import {
  buildDesignIR,
  validateDesignIR,
  serializeDesignIR,
  deserializeDesignIR,
  migrateDesignIR,
  calculateDependencyClosure,
  extractDesignTokens,
  extractComponents,
  IR_VERSION,
  SemanticTypes,
  createIRNode,
  createIRDocument,
  createIRPage,
} from '../src/ir/index.js';
import {
  saveDesignIR,
  getDesignIRByProjectId,
  getDesignIRPage,
  updateDesignIRPage,
} from '../src/services/designIRService.js';

const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/reagmat_test_design_ir';

describe('Unified Versioned Design Intermediate Representation (Design IR)', () => {
  let server;
  let baseUrl;

  before(async () => {
    await connectDB(TEST_DB_URI);
    await DesignIR.init();
    await DesignIRPage.init();
    await Project.init();
    await DesignTree.init();
    await Asset.init();

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
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await disconnectDB();
    }
  });

  const sampleFigmaData = {
    name: 'E-Commerce App Design',
    version: '1.4.0',
    fileKey: 'ecomKey789',
    pages: [
      {
        id: '0:1',
        name: 'Storefront Page',
        children: [
          {
            id: '1:100',
            name: 'App Header Navbar',
            type: 'FRAME',
            bounds: { x: 0, y: 0, width: 1440, height: 80 },
            layout: { mode: 'FLEX_ROW', gap: 24, padding: { top: 16, bottom: 16, left: 32, right: 32 } },
            fills: [{ type: 'SOLID', hex: '#FFFFFF', rgba: 'rgba(255, 255, 255, 1)' }],
            children: [
              {
                id: '1:101',
                name: 'Brand Logo',
                type: 'TEXT',
                text: 'ReagmatStore',
                typography: { fontFamily: 'Inter', fontSize: 24, fontWeight: 700 },
                fills: [{ type: 'SOLID', hex: '#111827', rgba: 'rgba(17, 24, 39, 1)' }],
                bounds: { x: 32, y: 24, width: 180, height: 32 },
              },
              {
                id: '1:102',
                name: 'Search Bar Input',
                type: 'FRAME',
                semanticType: 'InputField',
                bounds: { x: 300, y: 16, width: 400, height: 48 },
                fills: [{ type: 'SOLID', hex: '#F3F4F6', rgba: 'rgba(243, 244, 246, 1)' }],
                strokes: { color: '#E5E7EB', width: 1 },
                styles: { borderRadius: 8 },
                children: [
                  {
                    id: '1:103',
                    name: 'Placeholder',
                    type: 'TEXT',
                    text: 'Search products...',
                    typography: { fontFamily: 'Inter', fontSize: 14, fontWeight: 400 },
                    fills: [{ type: 'SOLID', hex: '#9CA3AF', rgba: 'rgba(156, 163, 175, 1)' }],
                  },
                ],
              },
              {
                id: '1:104',
                name: 'Checkout Button',
                type: 'COMPONENT',
                bounds: { x: 1280, y: 18, width: 128, height: 44 },
                layout: { mode: 'FLEX_ROW', gap: 8, padding: { top: 10, bottom: 10, left: 16, right: 16 } },
                fills: [{ type: 'SOLID', hex: '#2563EB', rgba: 'rgba(37, 99, 235, 1)' }],
                styles: { borderRadius: 6 },
                children: [
                  {
                    id: '1:105',
                    name: 'Button Text',
                    type: 'TEXT',
                    text: 'Cart (0)',
                    typography: { fontFamily: 'Inter', fontSize: 14, fontWeight: 600 },
                    fills: [{ type: 'SOLID', hex: '#FFFFFF', rgba: 'rgba(255, 255, 255, 1)' }],
                  },
                ],
              },
            ],
          },
          {
            id: '2:200',
            name: 'Product Card Grid',
            type: 'FRAME',
            bounds: { x: 0, y: 100, width: 1440, height: 600 },
            layout: { mode: 'GRID', gap: 32 },
            children: [
              {
                id: '2:201',
                name: 'Product Card Item',
                type: 'COMPONENT',
                semanticType: 'Card',
                bounds: { x: 32, y: 120, width: 320, height: 420 },
                styles: {
                  borderRadius: 12,
                  effects: [{ type: 'DROP_SHADOW', offsetX: 0, offsetY: 4, blur: 12, color: '#000000', opacity: 0.1 }],
                },
                fills: [{ type: 'SOLID', hex: '#FFFFFF', rgba: 'rgba(255, 255, 255, 1)' }],
                children: [
                  {
                    id: '2:202',
                    name: 'Product Thumbnail Image',
                    type: 'RECTANGLE',
                    bounds: { x: 32, y: 120, width: 320, height: 200 },
                    fills: [{ type: 'IMAGE', imageRef: 'img_shoe_123' }],
                  },
                  {
                    id: '2:203',
                    name: 'Add To Cart Action',
                    type: 'INSTANCE',
                    componentId: '1:104', // References Checkout Button
                    bounds: { x: 48, y: 460, width: 288, height: 40 },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const sampleAssets = [
    {
      _id: new mongoose.Types.ObjectId(),
      figmaFileKey: 'ecomKey789',
      figmaNodeId: '2:202',
      assetType: 'image',
      format: 'png',
      publicUrl: '/api/assets/ecomKey789/2-202_1x.png',
      storagePath: 'storage/assets/ecomKey789/2-202_1x.png',
      dimensions: { width: 320, height: 200 },
      fileSize: 45200,
    },
  ];

  describe('1. Canonical Design IR Builder & Normalization', () => {
    it('builds a canonical Design IR document with documentId, tokens, components, and pages', () => {
      const ir = buildDesignIR(sampleFigmaData, {
        fileKey: 'ecomKey789',
        fileName: 'E-Commerce App Design',
        assets: sampleAssets,
      });

      assert.equal(ir.version, IR_VERSION);
      assert.equal(ir.fileKey, 'ecomKey789');
      assert.equal(ir.fileName, 'E-Commerce App Design');
      assert.ok(ir.documentId.startsWith('ir_'));
      assert.equal(ir.pages.length, 1);
      assert.ok(ir.metadata.totalNodeCount > 5);

      const page = ir.pages[0];
      assert.equal(page.id, '0:1');
      assert.equal(page.name, 'Storefront Page');
      assert.equal(page.children.length, 2);

      // Verify node 1:100 (Navbar)
      const navbar = page.children[0];
      assert.equal(navbar.id, '1:100');
      assert.equal(navbar.semanticType, SemanticTypes.NAVBAR);
      assert.equal(navbar.semantics.classificationSource, 'heuristic');
      assert.ok(navbar.semantics.confidence >= 0.7);
      assert.equal(navbar.layout.mode, 'FLEX_ROW');
      assert.equal(navbar.layout.gap, 24);

      // Verify node 1:102 (Input)
      const input = navbar.children[1];
      assert.equal(input.semanticType, SemanticTypes.INPUT);
      assert.equal(input.styles.borderRadius, 8);

      // Verify node 1:104 (Button component)
      const button = navbar.children[2];
      assert.equal(button.semanticType, SemanticTypes.BUTTON);
      assert.equal(button.type, 'COMPONENT');
      assert.equal(button.metadata.isComponent, true);

      // Verify node 2:202 (Image asset attachment)
      const card = page.children[1].children[0];
      assert.equal(card.semanticType, SemanticTypes.CARD);
      const imageNode = card.children[0];
      assert.equal(imageNode.semanticType, SemanticTypes.IMAGE);
      assert.equal(imageNode.assets.length, 1);
      assert.equal(imageNode.assets[0].format, 'png');
      assert.equal(imageNode.assets[0].publicUrl, '/api/assets/ecomKey789/2-202_1x.png');

      // Verify relativeBounds
      assert.equal(imageNode.relativeBounds.x, 0); // 32 - 32
      assert.equal(imageNode.relativeBounds.y, 0); // 120 - 120
    });
  });

  describe('2. Design Tokens Extraction Engine', () => {
    it('extracts unified palette, semantic roles, typography scales, spacing, and radii', () => {
      const tokens = extractDesignTokens(sampleFigmaData.pages);

      assert.ok(tokens.colors);
      assert.ok(tokens.colors.raw.length > 0);
      assert.ok(tokens.colors.semantic.primary, '#2563EB');
      assert.ok(tokens.colors.semantic.text, '#111827');

      assert.deepEqual(tokens.typography.fontFamilies, ['Inter']);
      assert.ok(tokens.typography.fontSizes.includes(14));
      assert.ok(tokens.typography.fontSizes.includes(24));
      assert.ok(tokens.typography.fontWeights.includes(400));
      assert.ok(tokens.typography.fontWeights.includes(700));

      assert.ok(tokens.spacing.includes(24));
      assert.ok(tokens.spacing.includes(32));
      assert.ok(tokens.radii.includes(6));
      assert.ok(tokens.radii.includes(8));
      assert.ok(tokens.radii.includes(12));

      assert.equal(tokens.shadows.length, 1);
      assert.equal(tokens.shadows[0].blur, 12);
    });
  });

  describe('3. Component Definition & Dependency Resolution', () => {
    let ir;

    before(() => {
      ir = buildDesignIR(sampleFigmaData, {
        fileKey: 'ecomKey789',
        assets: sampleAssets,
      });
    });

    it('extracts native components, component sets, and properties', () => {
      assert.ok(ir.components.length >= 2);

      const buttonComp = ir.components.find((c) => c.id === '1:104');
      assert.ok(buttonComp);
      assert.equal(buttonComp.name, 'Checkout Button');
      assert.equal(buttonComp.componentType, 'native_figma');
      assert.ok(buttonComp.properties.label);
      assert.equal(buttonComp.properties.label.defaultValue, 'Cart (0)');

      const cardComp = ir.components.find((c) => c.id === '2:201');
      assert.ok(cardComp);
      assert.equal(cardComp.name, 'Product Card Item');
      assert.ok(cardComp.dependencies.componentIds.includes('1:104')); // Card depends on Checkout Button
      assert.ok(cardComp.dependencies.assetIds.length > 0); // Card depends on thumbnail image
    });

    it('calculates complete transitive dependency closure for nested components', () => {
      const closure = calculateDependencyClosure('2:201', ir);

      assert.equal(closure.componentId, '2:201');
      assert.equal(closure.componentName, 'Product Card Item');
      assert.deepEqual(closure.transitiveDependencies.componentIds, ['1:104']);
      assert.ok(closure.transitiveDependencies.assetIds.length > 0);
      assert.equal(closure.isCircular, false);
      assert.ok(closure.dependencyGraph.nodes.length >= 2);
    });

    it('detects and flags circular dependency chains safely', () => {
      // Create artificial cycle: A -> B -> A
      const cycleIR = {
        components: [
          {
            id: 'comp_A',
            name: 'Component A',
            sourceNodeId: 'comp_A',
            dependencies: { componentIds: ['comp_B'], assetIds: [] },
          },
          {
            id: 'comp_B',
            name: 'Component B',
            sourceNodeId: 'comp_B',
            dependencies: { componentIds: ['comp_A'], assetIds: [] },
          },
        ],
      };

      const closure = calculateDependencyClosure('comp_A', cycleIR);
      assert.equal(closure.isCircular, true);
      assert.ok(closure.cycleDetails.includes('Circular dependency detected'));
    });
  });

  describe('4. Schema Validation Engine', () => {
    let validIR;

    before(() => {
      validIR = buildDesignIR(sampleFigmaData, {
        fileKey: 'ecomKey789',
        assets: sampleAssets,
      });
    });

    it('validates a conformant Design IR document with zero errors', () => {
      const validation = validateDesignIR(validIR);
      assert.equal(validation.isValid, true);
      assert.equal(validation.errors.length, 0);
      assert.ok(validation.stats.totalNodes > 0);
    });

    it('rejects documents with missing documentId or fileKey', () => {
      const invalid = { ...validIR, documentId: null };
      const validation = validateDesignIR(invalid);
      assert.equal(validation.isValid, false);
      assert.ok(validation.errors.some((e) => e.includes('documentId')));
    });

    it('rejects documents with duplicate node IDs across pages', () => {
      const duplicateIR = JSON.parse(JSON.stringify(validIR));
      duplicateIR.pages[0].children.push({
        id: '1:100', // Duplicate ID
        type: 'FRAME',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      });

      const validation = validateDesignIR(duplicateIR);
      assert.equal(validation.isValid, false);
      assert.ok(validation.errors.some((e) => e.includes('Duplicate node ID detected')));
    });

    it('warns on missing or invalid geometry bounds without crashing', () => {
      const malformedIR = JSON.parse(JSON.stringify(validIR));
      malformedIR.pages[0].children[0].bounds = null;

      const validation = validateDesignIR(malformedIR);
      assert.ok(validation.warnings.some((w) => w.includes('missing or invalid bounds geometry')));
    });
  });

  describe('5. Serialization, Deserialization & Migration', () => {
    let ir;

    before(() => {
      ir = buildDesignIR(sampleFigmaData, { fileKey: 'ecomKey789' });
    });

    it('serializes to stable JSON and deserializes identically', () => {
      const json = serializeDesignIR(ir, false);
      assert.equal(typeof json, 'string');

      const restored = deserializeDesignIR(json);
      assert.equal(restored.documentId, ir.documentId);
      assert.equal(restored.version, ir.version);
      assert.equal(restored.pages.length, ir.pages.length);
    });

    it('automatically migrates legacy v0.x schema versions to 1.0.0', () => {
      const legacyDoc = {
        documentId: 'doc_legacy',
        fileKey: 'key_legacy',
        fileName: 'Legacy App',
        version: '0.8.0',
        pages: [],
      };

      const migrated = deserializeDesignIR(legacyDoc);
      assert.equal(migrated.version, '1.0.0');
      assert.ok(migrated.tokens);
      assert.ok(migrated.metadata.migratedFrom, '0.8.0');
    });
  });

  describe('6. MongoDB Persistence & Chunking Engine', () => {
    let testProjectId;
    let ir;

    before(async () => {
      const project = await Project.create({
        name: 'Persistent IR Project',
        figmaFileKey: 'irPersistKey123',
        figmaFileUrl: 'https://figma.com/file/irPersistKey123/App',
      });
      testProjectId = project._id;
      ir = buildDesignIR(sampleFigmaData, {
        projectId: testProjectId,
        fileKey: 'irPersistKey123',
        assets: sampleAssets,
      });
    });

    it('persists and retrieves canonical Design IR document from MongoDB', async () => {
      const savedDoc = await saveDesignIR(testProjectId, ir);
      assert.ok(savedDoc._id);
      assert.equal(savedDoc.isChunked, false);

      const retrieved = await getDesignIRByProjectId(testProjectId);
      assert.equal(retrieved.fileKey, 'irPersistKey123');
      assert.equal(retrieved.pages.length, 1);
      assert.equal(retrieved.tokens.colors.semantic.primary, '#2563EB');
    });

    it('splits large multi-page designs into DesignIRPage chunks to respect MongoDB limits', async () => {
      // Test forced chunking
      const savedChunked = await saveDesignIR(testProjectId, ir, { forceChunk: true });
      assert.equal(savedChunked.isChunked, true);
      assert.equal(savedChunked.pages.length, 0); // Root doc holds empty pages array when chunked

      // Verify separate DesignIRPage record created
      const pageRecord = await DesignIRPage.findOne({ projectId: testProjectId, pageId: '0:1' });
      assert.ok(pageRecord);
      assert.equal(pageRecord.name, 'Storefront Page');
      assert.ok(pageRecord.children.length > 0);

      // Verify seamless reassembly when loading complete document
      const retrievedFull = await getDesignIRByProjectId(testProjectId);
      assert.equal(retrievedFull.pages.length, 1);
      assert.equal(retrievedFull.pages[0].id, '0:1');
    });

    it('allows fast direct retrieval and partial updates of an individual page', async () => {
      const page = await getDesignIRPage(testProjectId, '0:1');
      assert.equal(page.id, '0:1');
      assert.equal(page.name, 'Storefront Page');

      // Update page partially
      const updated = await updateDesignIRPage(testProjectId, '0:1', {
        name: 'Updated Storefront V2',
        dimensions: { width: 1920, height: 1080 },
      });

      assert.equal(updated.name, 'Updated Storefront V2');

      const reloadedPage = await getDesignIRPage(testProjectId, '0:1');
      assert.equal(reloadedPage.name, 'Updated Storefront V2');
    });
  });

  describe('7. Design IR REST APIs & Backward Compatibility', () => {
    let apiProjectId;
    const testKey = 'apiTestKey999';

    before(async () => {
      const project = await Project.create({
        name: 'API Test Design',
        figmaFileKey: testKey,
        figmaFileUrl: `https://figma.com/file/${testKey}/App`,
      });
      apiProjectId = project._id;

      await DesignTree.create({
        projectId: apiProjectId,
        figmaFileKey: testKey,
        pages: sampleFigmaData.pages,
        totalNodeCount: 15,
      });

      await Asset.create({
        projectId: apiProjectId,
        figmaFileKey: testKey,
        figmaNodeId: '2:202',
        assetType: 'image',
        format: 'png',
        publicUrl: `/api/assets/${testKey}/2-202_1x.png`,
        storagePath: `storage/assets/${testKey}/2-202_1x.png`,
      });
    });

    it('POST /api/projects/:id/ir/generate generates and persists canonical IR', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${apiProjectId}/ir/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceEnrich: false }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.fileKey, testKey);
      assert.equal(json.data.version, '1.0.0');
    });

    it('GET /api/projects/:id/ir returns complete canonical Design IR', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${apiProjectId}/ir`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.pages.length, 1);
      assert.ok(json.data.tokens.colors);
    });

    it('GET /api/projects/:id/ir/pages/:pageId returns individual page', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${apiProjectId}/ir/pages/0:1`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.id, '0:1');
    });

    it('GET /api/projects/:id/ir/tokens returns unified design tokens', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${apiProjectId}/ir/tokens`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.colors.semantic);
    });

    it('GET /api/projects/:id/ir/components returns all extracted components', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${apiProjectId}/ir/components`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.count >= 2);
    });

    it('GET /api/projects/:id/ir/components/:componentId/dependencies returns transitive closure', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${apiProjectId}/ir/components/2:201/dependencies`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.componentId, '2:201');
      assert.deepEqual(json.data.transitiveDependencies.componentIds, ['1:104']);
      assert.equal(json.data.isCircular, false);
    });

    it('preserves existing backward-compatible tree and design endpoints', async () => {
      // Existing GET /api/projects/:id/design
      const designRes = await fetch(`${baseUrl}/api/projects/${apiProjectId}/design`);
      assert.equal(designRes.status, 200);
      const designJson = await designRes.json();
      assert.equal(designJson.success, true);
      assert.ok(designJson.data.designTree);

      // Existing GET /api/projects/:id/tree
      const treeRes = await fetch(`${baseUrl}/api/projects/${apiProjectId}/tree`);
      assert.equal(treeRes.status, 200);
      const treeJson = await treeRes.json();
      assert.equal(treeJson.success, true);
      assert.ok(treeJson.data.tree);

      // Existing GET /api/projects/:id/components
      const compRes = await fetch(`${baseUrl}/api/projects/${apiProjectId}/components`);
      assert.equal(compRes.status, 200);
      const compJson = await compRes.json();
      assert.equal(compJson.success, true);
      assert.ok(compJson.count > 0);
    });
  });
});


import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import app from '../index.js';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Project } from '../src/models/Project.js';
import { DesignTree } from '../src/models/DesignTree.js';
import { GeneratedCode } from '../src/models/GeneratedCode.js';

const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/reagmat_test_projects_api';

describe('Project Persistence and Design Retrieval APIs', () => {
  let server;
  let baseUrl;

  before(async () => {
    await connectDB(TEST_DB_URI);

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
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await disconnectDB();
    }
  });

  describe('Project CRUD Endpoints', () => {
    let createdProjectId;
    const testFileKey = 'apiTestKey123';

    it('POST /api/projects creates a new project', async () => {
      const res = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Mobile Banking App',
          figmaFileKey: testFileKey,
          figmaFileUrl: `https://www.figma.com/design/${testFileKey}/Mobile-Banking`,
          settings: { styling: 'tailwind', language: 'tsx' },
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 201);
      assert.equal(body.success, true);
      assert.equal(body.data.name, 'Mobile Banking App');
      assert.equal(body.data.figmaFileKey, testFileKey);
      assert.equal(body.data.settings.language, 'tsx');

      createdProjectId = body.data._id;
    });

    it('POST /api/projects rejects duplicate figmaFileKey with 409 Conflict', async () => {
      const res = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Duplicate Project',
          figmaFileKey: testFileKey,
          figmaFileUrl: `https://www.figma.com/design/${testFileKey}`,
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 409);
      assert.equal(body.code, 'PROJECT_ALREADY_EXISTS');
    });

    it('POST /api/projects validates required fields', async () => {
      const res = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Missing URL and Key' }),
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.code, 'MISSING_FILE_KEY');
    });

    it('GET /api/projects lists projects with pagination', async () => {
      const res = await fetch(`${baseUrl}/api/projects?page=1&limit=5`);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data));
      assert.ok(body.data.length >= 1);
      assert.ok(body.pagination);
      assert.equal(body.pagination.page, 1);
    });

    it('GET /api/projects/:id retrieves project by ID', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${createdProjectId}`);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data._id, createdProjectId);
    });

    it('GET /api/projects/:id returns 400 for invalid ObjectId', async () => {
      const res = await fetch(`${baseUrl}/api/projects/not-a-valid-id`);
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.equal(body.code, 'INVALID_OBJECT_ID');
    });

    it('GET /api/projects/:id returns 404 for non-existent project', async () => {
      const randomId = new mongoose.Types.ObjectId().toString();
      const res = await fetch(`${baseUrl}/api/projects/${randomId}`);
      const body = await res.json();

      assert.equal(res.status, 404);
      assert.equal(body.code, 'PROJECT_NOT_FOUND');
    });

    it('PATCH /api/projects/:id updates project details', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${createdProjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Banking App Title',
          status: 'completed',
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data.name, 'Updated Banking App Title');
      assert.equal(body.data.status, 'completed');
    });

    it('DELETE /api/projects/:id deletes project and cascades to DesignTree', async () => {
      // First attach a DesignTree and GeneratedCode to test cascade
      await DesignTree.create({
        projectId: createdProjectId,
        figmaFileKey: testFileKey,
        pages: [{ id: '0:1', name: 'Page 1', children: [] }],
      });
      await GeneratedCode.create({
        projectId: createdProjectId,
        artifactName: 'TestComponent',
        storageLocation: 'storage/test.jsx',
      });

      const res = await fetch(`${baseUrl}/api/projects/${createdProjectId}`, {
        method: 'DELETE',
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.deletedId, createdProjectId);

      // Verify cascade deletion
      const projectStillExists = await Project.exists({ _id: createdProjectId });
      const treeStillExists = await DesignTree.exists({ projectId: createdProjectId });
      const codeStillExists = await GeneratedCode.exists({ projectId: createdProjectId });

      assert.equal(projectStillExists, null);
      assert.equal(treeStillExists, null);
      assert.equal(codeStillExists, null);
    });
  });

  describe('Design and Component Retrieval Endpoints', () => {
    let projectId;
    const key = 'retrievalTestKey';

    before(async () => {
      const project = await Project.create({
        name: 'Component Test App',
        figmaFileKey: key,
        figmaFileUrl: `https://www.figma.com/file/${key}`,
        figmaVersion: '2.1.0',
      });
      projectId = project._id;

      const mockPages = [
        {
          id: '0:1',
          name: 'Design System Page',
          type: 'CANVAS',
          children: [
            {
              id: '1:1',
              name: 'App Navbar',
              type: 'FRAME',
              semanticType: 'Navbar',
              confidence: 0.9,
              children: [
                {
                  id: '1:2',
                  name: 'Primary Button',
                  type: 'COMPONENT',
                  semanticType: 'Button',
                  confidence: 0.95,
                  children: [
                    { id: '1:3', name: 'Label', type: 'TEXT', text: 'Click Me' },
                  ],
                },
              ],
            },
            {
              id: '2:1',
              name: 'Pricing Card',
              type: 'FRAME',
              semanticType: 'Card',
              confidence: 0.88,
              children: [],
            },
          ],
        },
      ];

      await DesignTree.create({
        projectId: project._id,
        figmaFileKey: key,
        totalNodeCount: 5,
        pages: mockPages,
        normalizedTree: mockPages[0],
      });
    });

    it('GET /api/projects/:id/design returns full project and design tree', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${projectId}/design`);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data.project._id, projectId.toString());
      assert.equal(body.data.designTree.totalNodeCount, 5);
      assert.equal(body.data.designTree.pages.length, 1);
    });

    it('GET /api/projects/:id/tree returns format compatible with frontend TreeStore', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${projectId}/tree`);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data.projectId, projectId.toString());
      assert.equal(body.data.fileName, 'Component Test App');
      assert.equal(body.data.fileVersion, '2.1.0');
      assert.equal(body.data.totalNodeCount, 5);
      assert.ok(body.data.tree); // primary page
      assert.equal(body.data.tree.name, 'Design System Page');
      assert.equal(body.data.pages.length, 1);
    });

    it('GET /api/projects/:id/components extracts classified and native components', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${projectId}/components`);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.ok(body.count >= 3); // App Navbar, Primary Button, Pricing Card

      const names = body.data.map((c) => c.name);
      assert.ok(names.includes('App Navbar'));
      assert.ok(names.includes('Primary Button'));
      assert.ok(names.includes('Pricing Card'));

      const button = body.data.find((c) => c.name === 'Primary Button');
      assert.equal(button.figmaType, 'COMPONENT');
      assert.equal(button.semanticType, 'Button');
    });
  });

  describe('Figma Import Caching Integration', () => {
    const cachedKey = 'cachedFigmaKey999';

    before(async () => {
      // Pre-seed a project and design tree in MongoDB
      const project = await Project.create({
        name: 'Cached Design File',
        figmaFileKey: cachedKey,
        figmaFileUrl: `https://www.figma.com/file/${cachedKey}`,
        figmaVersion: '3.0.0',
      });

      await DesignTree.create({
        projectId: project._id,
        figmaFileKey: cachedKey,
        totalNodeCount: 15,
        pages: [
          {
            id: '0:1',
            name: 'Cached Page 1',
            type: 'CANVAS',
            children: [{ id: '1:1', name: 'Cached Header', type: 'FRAME' }],
          },
        ],
      });
    });

    it('serves design from MongoDB cache without hitting Figma API when cached', async () => {
      const res = await fetch(`${baseUrl}/api/figma/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `https://www.figma.com/file/${cachedKey}/Design`,
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.cached, true); // Cached served!
      assert.equal(body.data.fileName, 'Cached Design File');
      assert.equal(body.data.totalNodeCount, 15);
      assert.ok(body.data.projectId);
      assert.equal(body.data.tree.name, 'Cached Page 1');
    });
  });
});


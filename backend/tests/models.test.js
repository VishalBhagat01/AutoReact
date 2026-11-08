import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB, disconnectDB, isDbConnected } from '../src/config/database.js';
import { Project } from '../src/models/Project.js';
import { DesignTree } from '../src/models/DesignTree.js';
import { GeneratedCode } from '../src/models/GeneratedCode.js';

const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/reagmat_test_models';

describe('MongoDB Models & Schema Validation', () => {
  before(async () => {
    await connectDB(TEST_DB_URI);
    // Ensure all model indexes are built before running uniqueness tests
    await Project.init();
    await DesignTree.init();
    await GeneratedCode.init();
    assert.equal(isDbConnected(), true);
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await disconnectDB();
    }
  });

  describe('Project Model', () => {
    it('creates a project with valid fields and defaults', async () => {
      const project = await Project.create({
        name: 'Dashboard UI',
        figmaFileKey: 'testFileKey1',
        figmaFileUrl: 'https://www.figma.com/file/testFileKey1/Dashboard',
      });

      assert.ok(project._id);
      assert.equal(project.name, 'Dashboard UI');
      assert.equal(project.figmaFileKey, 'testFileKey1');
      assert.equal(project.figmaVersion, '1.0');
      assert.equal(project.status, 'imported');
      assert.equal(project.settings.styling, 'tailwind');
      assert.equal(project.settings.language, 'jsx');
      assert.ok(project.createdAt instanceof Date);
    });

    it('fails validation when figmaFileKey is missing', async () => {
      await assert.rejects(
        async () => {
          await Project.create({
            name: 'No Key',
            figmaFileUrl: 'https://www.figma.com/file/xyz',
          });
        },
        { name: 'ValidationError' }
      );
    });

    it('enforces unique figmaFileKey constraint', async () => {
      await assert.rejects(
        async () => {
          await Project.create({
            name: 'Duplicate Key Project',
            figmaFileKey: 'testFileKey1',
            figmaFileUrl: 'https://www.figma.com/file/testFileKey1',
          });
        },
        (err) => err.code === 11000 // Duplicate key error
      );
    });
  });

  describe('DesignTree Model', () => {
    let testProject;

    before(async () => {
      testProject = await Project.create({
        name: 'Design Tree Test Project',
        figmaFileKey: 'treeFileKey1',
        figmaFileUrl: 'https://www.figma.com/file/treeFileKey1',
      });
    });

    it('creates a DesignTree referencing a valid project', async () => {
      const mockPages = [
        {
          id: '0:1',
          name: 'Page 1',
          type: 'CANVAS',
          children: [
            {
              id: '1:1',
              name: 'Card Container',
              type: 'FRAME',
              semanticType: 'Card',
              confidence: 0.85,
            },
          ],
        },
      ];

      const tree = await DesignTree.create({
        projectId: testProject._id,
        figmaFileKey: testProject.figmaFileKey,
        schemaVersion: '1.0.0',
        totalNodeCount: 2,
        pages: mockPages,
        normalizedTree: mockPages[0],
        semanticTree: { classified: true },
        metadata: { designSystem: 'v1' },
      });

      assert.ok(tree._id);
      assert.equal(tree.projectId.toString(), testProject._id.toString());
      assert.equal(tree.totalNodeCount, 2);
      assert.equal(tree.pages.length, 1);
      assert.equal(tree.pages[0].children[0].semanticType, 'Card');
    });

    it('requires a projectId', async () => {
      await assert.rejects(
        async () => {
          await DesignTree.create({
            figmaFileKey: 'treeFileKey2',
            pages: [],
          });
        },
        { name: 'ValidationError' }
      );
    });
  });

  describe('GeneratedCode Model', () => {
    let testProject;

    before(async () => {
      testProject = await Project.create({
        name: 'Code Gen Project',
        figmaFileKey: 'codeFileKey1',
        figmaFileUrl: 'https://www.figma.com/file/codeFileKey1',
      });
    });

    it('creates a GeneratedCode record with file manifest', async () => {
      const record = await GeneratedCode.create({
        projectId: testProject._id,
        generationMode: 'component',
        selectedNodeIds: ['1:10'],
        artifactName: 'SubmitButton',
        artifactType: 'react_component',
        fileManifest: [
          {
            path: 'components/SubmitButton.jsx',
            size: 512,
            language: 'javascript',
            contentSnippet: 'export function SubmitButton() { ... }',
          },
        ],
        storageLocation: 'storage/artifacts/SubmitButton.jsx',
        generationStatus: 'completed',
        validationStatus: 'passed',
      });

      assert.ok(record._id);
      assert.equal(record.artifactName, 'SubmitButton');
      assert.equal(record.fileManifest.length, 1);
      assert.equal(record.fileManifest[0].path, 'components/SubmitButton.jsx');
      assert.equal(record.storageLocation, 'storage/artifacts/SubmitButton.jsx');
    });
  });
});

import {
  fetchFigmaFile,
  parseDesignTree,
  parseFigmaUrl,
} from '../services/figmaService.js';
import { Project } from '../models/Project.js';
import { DesignTree } from '../models/DesignTree.js';
import { AppError } from '../middleware/errorHandler.js';
import { isDbConnected } from '../config/database.js';

/**
 * Handle Figma file import with MongoDB caching and persistence
 * POST /api/figma/import
 * Body: { url: "https://www.figma.com/file/...", refresh?: boolean }
 */
export const importFigmaFile = async (req, res, next) => {
  try {
    const { url, refresh = false } = req.body;

    // Use pre-validated metadata from middleware or parse directly
    const figmaMeta = req.figmaMeta || parseFigmaUrl(url);

    if (!figmaMeta.isValid || !figmaMeta.fileKey) {
      throw new AppError(
        'Invalid Figma URL. Please provide a valid Figma file or design URL.',
        400,
        'INVALID_FIGMA_URL'
      );
    }

    const fileKey = figmaMeta.fileKey;
    const shouldRefresh = refresh === true || req.query.refresh === 'true';

    // 1. Check cache in MongoDB if connected and refresh is not requested
    if (isDbConnected() && !shouldRefresh) {
      const cachedProject = await Project.findOne({ figmaFileKey: fileKey }).lean();
      if (cachedProject) {
        const cachedTree = await DesignTree.findOne({ projectId: cachedProject._id }).lean();
        if (cachedTree && cachedTree.pages && cachedTree.pages.length > 0) {
          console.log(`⚡ Serving Figma file from database cache: ${fileKey}`);

          // Update lastImportedAt asynchronously
          Project.findByIdAndUpdate(cachedProject._id, { $set: { lastImportedAt: new Date() } }).exec().catch(() => {});

          return res.status(200).json({
            success: true,
            cached: true,
            data: {
              projectId: cachedProject._id,
              fileName: cachedProject.name,
              fileVersion: cachedProject.figmaVersion,
              totalNodeCount: cachedTree.totalNodeCount,
              tree: cachedTree.pages[0] || null,
              pages: cachedTree.pages,
              targetNodeId: figmaMeta.nodeId || null,
            },
          });
        }
      }
    }

    // 2. Get Figma token from environment
    const figmaToken = process.env.FIGMA_TOKEN;
    if (!figmaToken) {
      throw new AppError(
        'Figma token not configured. Please set FIGMA_TOKEN in environment variables.',
        500,
        'MISSING_FIGMA_TOKEN'
      );
    }

    // 3. Fetch from Figma API
    console.log(`📥 Fetching Figma file from API: ${fileKey}${figmaMeta.nodeId ? ` (Target Node: ${figmaMeta.nodeId})` : ''}`);
    const figmaData = await fetchFigmaFile(fileKey, figmaToken);

    // 4. Parse and normalize tree with semantic classification
    console.log('🔄 Parsing design tree and applying semantic classification...');
    const tree = parseDesignTree(figmaData);

    // 5. Persist to MongoDB if database is connected
    let projectId = null;
    if (isDbConnected()) {
      try {
        const project = await Project.findOneAndUpdate(
          { figmaFileKey: fileKey },
          {
            $set: {
              name: tree.fileName,
              figmaFileKey: fileKey,
              figmaFileUrl: url,
              figmaVersion: tree.fileVersion || '1.0',
              status: 'completed',
              lastImportedAt: new Date(),
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        projectId = project._id;

        await DesignTree.findOneAndUpdate(
          { projectId: project._id },
          {
            $set: {
              projectId: project._id,
              figmaFileKey: fileKey,
              schemaVersion: '1.0.0',
              totalNodeCount: tree.totalNodeCount,
              pages: tree.pages,
              normalizedTree: tree.pages.length > 0 ? tree.pages[0] : null,
              semanticTree: {
                options: tree.processingOptions,
              },
              metadata: {
                fileName: tree.fileName,
                version: tree.fileVersion,
              },
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log(`💾 Persisted design tree for project: ${project._id}`);
      } catch (dbError) {
        console.error(`⚠️ Warning: Failed to persist to MongoDB: ${dbError.message}`);
        // Do not fail the client request if caching fails; continue with in-memory parsed result
      }
    }

    // 6. Return response matching existing frontend contract
    return res.status(200).json({
      success: true,
      cached: false,
      data: {
        projectId: projectId,
        fileName: tree.fileName,
        fileVersion: tree.fileVersion,
        totalNodeCount: tree.totalNodeCount,
        tree: tree.pages.length > 0 ? tree.pages[0] : null,
        pages: tree.pages,
        targetNodeId: figmaMeta.nodeId || null,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Health check endpoint
 * GET /api/figma/health
 */
export const healthCheck = (req, res) => {
  res.json({
    success: true,
    message: 'Figma API is operational',
    timestamp: new Date().toISOString(),
  });
};

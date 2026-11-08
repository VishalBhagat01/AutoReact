import { pythonServiceClient } from '../services/pythonServiceClient.js';
import { Project } from '../models/Project.js';
import { DesignTree } from '../models/DesignTree.js';
import { AppError } from '../middleware/errorHandler.js';
import { isDbConnected } from '../config/database.js';

/**
 * Resolve design AST payload from request body or MongoDB project ID
 * @private
 */
const resolveDesignPayload = async (req) => {
  const { projectId, tree, nodes, pages, fileKey, fileName, options = {} } = req.body;

  let payload = {
    requestId: req.body.requestId || `req_${Date.now()}`,
    fileKey,
    fileName,
    projectId,
    tree,
    nodes,
    pages,
    options,
  };

  // If projectId is provided and raw tree/nodes are omitted, load from MongoDB
  if (projectId && !tree && !nodes && !pages) {
    if (!isDbConnected()) {
      throw new AppError('Database connection required to load project design tree', 503, 'DB_UNAVAILABLE');
    }

    const project = await Project.findById(projectId).lean();
    if (!project) {
      throw new AppError(`Project not found with ID: ${projectId}`, 404, 'PROJECT_NOT_FOUND');
    }

    const designTree = await DesignTree.findOne({ projectId: project._id }).lean();
    if (!designTree) {
      throw new AppError(`Design tree not found for project: ${projectId}`, 404, 'DESIGN_TREE_NOT_FOUND');
    }

    payload.fileKey = project.figmaFileKey;
    payload.fileName = project.name;
    payload.tree = designTree.normalizedTree || (designTree.pages && designTree.pages[0]) || null;
    payload.pages = designTree.pages || [];
    payload.metadata = designTree.metadata || {};
  }

  if (!payload.tree && (!payload.nodes || payload.nodes.length === 0) && (!payload.pages || payload.pages.length === 0)) {
    throw new AppError(
      'Design payload required. Provide either "projectId", "tree", "nodes", or "pages".',
      400,
      'MISSING_DESIGN_PAYLOAD'
    );
  }

  return payload;
};

/**
 * Check Python AI microservice operational health
 * GET /api/ai/health
 */
export const getAiServiceHealth = async (req, res, next) => {
  try {
    const health = await pythonServiceClient.checkHealth(req.query.versioned === 'true');
    return res.status(200).json({
      success: true,
      service: 'Node.js Express Gateway',
      aiService: health,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve current AI microservice operational vs pending capabilities
 * GET /api/ai/capabilities
 */
export const getAiCapabilities = async (req, res, next) => {
  try {
    const capabilities = await pythonServiceClient.getCapabilities();
    return res.status(200).json({
      success: true,
      data: capabilities,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Analyze normalized design AST with geometry and relationship graph via Python AI microservice
 * POST /api/ai/analyze
 */
export const analyzeDesignController = async (req, res, next) => {
  try {
    const payload = await resolveDesignPayload(req);
    const analysisResult = await pythonServiceClient.analyzeDesign(payload);

    // Persist graph and component intelligence to MongoDB if connected and project is persisted
    if (isDbConnected() && payload.projectId && analysisResult.graph) {
      DesignTree.findOneAndUpdate(
        { projectId: payload.projectId },
        {
          $set: {
            'metadata.relationshipGraph': analysisResult.graph,
            'metadata.detectedComponents': analysisResult.detected_components || analysisResult.detectedComponents,
            'metadata.inferredLayouts': analysisResult.inferred_layouts || analysisResult.inferredLayouts,
            'metadata.lastAnalyzedAt': new Date(),
          },
        }
      ).exec().catch(() => {});
    }

    return res.status(200).json({
      success: true,
      data: analysisResult,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Perform deep geometric analysis (alignments, spacings, overlaps, grids)
 * POST /api/ai/geometry
 */
export const analyzeGeometryController = async (req, res, next) => {
  try {
    const payload = await resolveDesignPayload(req);
    const geometryResult = await pythonServiceClient.analyzeGeometry(payload);

    return res.status(200).json({
      success: true,
      data: geometryResult,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Infer deterministic layout patterns (flex row, flex col, grid, stack, overlay, card, nav)
 * POST /api/ai/layout
 */
export const inferLayoutController = async (req, res, next) => {
  try {
    const payload = await resolveDesignPayload(req);
    const layoutResult = await pythonServiceClient.inferLayout(payload);

    return res.status(200).json({
      success: true,
      data: layoutResult,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate complete NetworkX design relationship graph
 * POST /api/ai/graph
 */
export const generateGraphController = async (req, res, next) => {
  try {
    const payload = await resolveDesignPayload(req);
    const graphResult = await pythonServiceClient.generateGraph(payload);

    if (isDbConnected() && payload.projectId) {
      DesignTree.findOneAndUpdate(
        { projectId: payload.projectId },
        {
          $set: {
            'metadata.relationshipGraph': graphResult,
            'metadata.lastGraphGeneratedAt': new Date(),
          },
        }
      ).exec().catch(() => {});
    }

    return res.status(200).json({
      success: true,
      data: graphResult,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Detect repeated visual patterns and Figma component instances
 * POST /api/ai/components/detect
 */
export const detectComponentsController = async (req, res, next) => {
  try {
    const payload = await resolveDesignPayload(req);
    const componentsResult = await pythonServiceClient.detectComponents(payload);

    return res.status(200).json({
      success: true,
      data: componentsResult,
    });
  } catch (error) {
    next(error);
  }
};

import { pythonServiceClient } from '../services/pythonServiceClient.js';
import { Project } from '../models/Project.js';
import { DesignTree } from '../models/DesignTree.js';
import { AppError } from '../middleware/errorHandler.js';
import { isDbConnected } from '../config/database.js';

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
 * Analyze normalized design AST via Python AI microservice
 * POST /api/ai/analyze
 * Body: { projectId?: string, tree?: object, nodes?: array, fileKey?: string, fileName?: string }
 */
export const analyzeDesignController = async (req, res, next) => {
  try {
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

    // If projectId is provided and tree is not provided, fetch design tree from MongoDB
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

    const analysisResult = await pythonServiceClient.analyzeDesign(payload);

    return res.status(200).json({
      success: true,
      data: analysisResult,
    });
  } catch (error) {
    next(error);
  }
};

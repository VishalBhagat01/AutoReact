/**
 * Design IR Controller
 * REST API handlers for canonical Design IR retrieval, component inspection,
 * design tokens, and dependency closure calculations.
 */

import { Project } from '../models/Project.js';
import { DesignTree } from '../models/DesignTree.js';
import { Asset } from '../models/Asset.js';
import {
  saveDesignIR,
  getDesignIRByProjectId,
  getDesignIRPage,
  getDesignIRTokens,
  getDesignIRComponents,
  getDesignIRComponentWithDependencies,
} from '../services/designIRService.js';
import { buildDesignIR } from '../ir/builder.js';
import { pythonServiceClient } from '../services/pythonServiceClient.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Generate or re-generate canonical Design IR for a project
 * POST /api/projects/:id/ir/generate
 */
export const generateProjectIR = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { forceEnrich = true, forceChunk = false } = req.body || {};

    const project = await Project.findById(id).lean();
    if (!project) {
      throw new AppError(`Project not found with ID: '${id}'`, 404, 'PROJECT_NOT_FOUND');
    }

    const designTree = await DesignTree.findOne({ projectId: id }).lean();
    if (!designTree || !designTree.pages || designTree.pages.length === 0) {
      throw new AppError(
        `Cannot generate Design IR: No design tree found for project '${id}'. Import design first.`,
        400,
        'MISSING_DESIGN_TREE'
      );
    }

    // Fetch stored assets for this project or file key
    const assets = await Asset.find({
      $or: [{ projectId: id }, { figmaFileKey: project.figmaFileKey }],
    }).lean();

    // 1. Build canonical Design IR
    let ir = buildDesignIR(
      {
        pages: designTree.pages,
        fileName: project.name,
        fileVersion: project.figmaVersion,
        fileKey: project.figmaFileKey,
      },
      {
        projectId: project._id,
        fileKey: project.figmaFileKey,
        fileName: project.name,
        figmaVersion: project.figmaVersion,
        assets,
      }
    );

    // 2. Python service enrichment (spatial analysis, relationship graph)
    if (forceEnrich) {
      try {
        const isPythonUp = await pythonServiceClient.isServiceAvailable();
        if (isPythonUp) {
          const enrichResult = await pythonServiceClient.enrichDesignIR(ir);
          if (enrichResult?.data) {
            ir = enrichResult.data;
          }
        }
      } catch (pythonErr) {
        console.warn(`[generateProjectIR] Python enrichment skipped (non-blocking): ${pythonErr.message}`);
      }
    }

    // 3. Persist to MongoDB
    const savedDoc = await saveDesignIR(project._id, ir, { forceChunk });

    return res.status(200).json({
      success: true,
      message: 'Design IR generated and persisted successfully',
      data: ir,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Get full canonical Design IR for a project
 * GET /api/projects/:id/ir
 */
export const getProjectIR = async (req, res, next) => {
  try {
    const { id } = req.params;

    let ir;
    try {
      ir = await getDesignIRByProjectId(id);
    } catch (err) {
      // If IR document doesn't exist yet, auto-generate it on demand from DesignTree!
      if (err.code === 'DESIGN_IR_NOT_FOUND') {
        const project = await Project.findById(id).lean();
        const designTree = await DesignTree.findOne({ projectId: id }).lean();
        if (project && designTree && designTree.pages) {
          const assets = await Asset.find({
            $or: [{ projectId: id }, { figmaFileKey: project.figmaFileKey }],
          }).lean();

          ir = buildDesignIR(
            {
              pages: designTree.pages,
              fileName: project.name,
              fileVersion: project.figmaVersion,
              fileKey: project.figmaFileKey,
            },
            {
              projectId: project._id,
              fileKey: project.figmaFileKey,
              fileName: project.name,
              figmaVersion: project.figmaVersion,
              assets,
            }
          );
          await saveDesignIR(id, ir);
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }

    return res.status(200).json({
      success: true,
      data: ir,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Get individual page from Design IR
 * GET /api/projects/:id/ir/pages/:pageId
 */
export const getProjectIRPage = async (req, res, next) => {
  try {
    const { id, pageId } = req.params;
    const page = await getDesignIRPage(id, pageId);

    return res.status(200).json({
      success: true,
      data: page,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Get all components in Design IR
 * GET /api/projects/:id/ir/components
 */
export const getProjectIRComponents = async (req, res, next) => {
  try {
    const { id } = req.params;
    const components = await getDesignIRComponents(id);

    return res.status(200).json({
      success: true,
      count: components.length,
      data: components,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Get specific component from Design IR
 * GET /api/projects/:id/ir/components/:componentId
 */
export const getProjectIRComponentById = async (req, res, next) => {
  try {
    const { id, componentId } = req.params;
    const result = await getDesignIRComponentWithDependencies(id, componentId);

    if (!result.component) {
      throw new AppError(
        `Component not found with ID: '${componentId}'`,
        404,
        'COMPONENT_NOT_FOUND'
      );
    }

    return res.status(200).json({
      success: true,
      data: result.component,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Get complete transitive dependency closure for a component
 * GET /api/projects/:id/ir/components/:componentId/dependencies
 */
export const getProjectIRComponentDependencies = async (req, res, next) => {
  try {
    const { id, componentId } = req.params;
    const result = await getDesignIRComponentWithDependencies(id, componentId);

    return res.status(200).json({
      success: true,
      data: result.dependencies,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Get design tokens from Design IR
 * GET /api/projects/:id/ir/tokens
 */
export const getProjectIRTokens = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tokens = await getDesignIRTokens(id);

    return res.status(200).json({
      success: true,
      data: tokens,
    });
  } catch (error) {
    return next(error);
  }
};


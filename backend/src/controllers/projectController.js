import { Project } from '../models/Project.js';
import { DesignTree } from '../models/DesignTree.js';
import { GeneratedCode } from '../models/GeneratedCode.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Create a new Project
 * POST /api/projects
 */
export const createProject = async (req, res, next) => {
  try {
    const { name, figmaFileKey, figmaFileUrl, figmaVersion, thumbnailUrl, settings } = req.body;

    if (!figmaFileKey || typeof figmaFileKey !== 'string') {
      throw new AppError('Figma file key is required', 400, 'MISSING_FILE_KEY');
    }

    if (!figmaFileUrl || typeof figmaFileUrl !== 'string') {
      throw new AppError('Figma file URL is required', 400, 'MISSING_FILE_URL');
    }

    // Check if project already exists for this file key
    const existing = await Project.findOne({ figmaFileKey: figmaFileKey.trim() });
    if (existing) {
      throw new AppError(
        `Project already exists for Figma file key: '${figmaFileKey}'`,
        409,
        'PROJECT_ALREADY_EXISTS',
        { projectId: existing._id }
      );
    }

    const project = await Project.create({
      name: name?.trim() || 'Untitled Design',
      figmaFileKey: figmaFileKey.trim(),
      figmaFileUrl: figmaFileUrl.trim(),
      figmaVersion: figmaVersion || '1.0',
      thumbnailUrl: thumbnailUrl || null,
      settings: settings || {},
      status: 'imported',
    });

    return res.status(201).json({
      success: true,
      data: project,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * List projects with pagination and filtering
 * GET /api/projects?page=1&limit=10&status=completed&search=Dashboard
 */
export const getProjects = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const query = {};

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.search) {
      query.name = { $regex: req.query.search, $options: 'i' };
    }

    const [total, projects] = await Promise.all([
      Project.countDocuments(query),
      Project.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: projects,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Get project by ID
 * GET /api/projects/:id
 */
export const getProjectById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id).lean();

    if (!project) {
      throw new AppError(`Project not found with ID: '${id}'`, 404, 'PROJECT_NOT_FOUND');
    }

    return res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Update project details
 * PATCH /api/projects/:id
 */
export const updateProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, thumbnailUrl, settings, status } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (thumbnailUrl !== undefined) updates.thumbnailUrl = thumbnailUrl;
    if (status !== undefined) updates.status = status;
    if (settings && typeof settings === 'object') {
      updates.settings = settings;
    }

    const project = await Project.findByIdAndUpdate(id, { $set: updates }, {
      new: true,
      runValidators: true,
    }).lean();

    if (!project) {
      throw new AppError(`Project not found with ID: '${id}'`, 404, 'PROJECT_NOT_FOUND');
    }

    return res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Delete project and cascade-delete associated DesignTree and GeneratedCode
 * DELETE /api/projects/:id
 */
export const deleteProject = async (req, res, next) => {
  try {
    const { id } = req.params;

    const project = await Project.findById(id);
    if (!project) {
      throw new AppError(`Project not found with ID: '${id}'`, 404, 'PROJECT_NOT_FOUND');
    }

    // Cascade deletion
    await Promise.all([
      DesignTree.deleteMany({ projectId: id }),
      GeneratedCode.deleteMany({ projectId: id }),
      Project.findByIdAndDelete(id),
    ]);

    return res.status(200).json({
      success: true,
      message: `Project '${project.name}' and all associated design trees were deleted successfully.`,
      deletedId: id,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Get project with full DesignTree
 * GET /api/projects/:id/design
 */
export const getProjectDesign = async (req, res, next) => {
  try {
    const { id } = req.params;

    const project = await Project.findById(id).lean();
    if (!project) {
      throw new AppError(`Project not found with ID: '${id}'`, 404, 'PROJECT_NOT_FOUND');
    }

    const designTree = await DesignTree.findOne({ projectId: id }).lean();

    return res.status(200).json({
      success: true,
      data: {
        project,
        designTree: designTree || null,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Get project tree formatted for frontend TreeStore consumption
 * GET /api/projects/:id/tree
 */
export const getProjectTree = async (req, res, next) => {
  try {
    const { id } = req.params;

    const project = await Project.findById(id).lean();
    if (!project) {
      throw new AppError(`Project not found with ID: '${id}'`, 404, 'PROJECT_NOT_FOUND');
    }

    const designTree = await DesignTree.findOne({ projectId: id }).lean();

    const pages = designTree?.pages || [];
    const tree = pages.length > 0 ? pages[0] : null;

    return res.status(200).json({
      success: true,
      data: {
        projectId: project._id,
        fileName: project.name,
        fileVersion: project.figmaVersion,
        totalNodeCount: designTree?.totalNodeCount || 0,
        tree,
        pages,
        lastImportedAt: project.lastImportedAt,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Helper to recursively extract components from a node tree
 */
const extractComponentsFromNode = (node, result = []) => {
  if (!node) return result;

  const isFigmaComponent = node.type === 'COMPONENT' || node.type === 'COMPONENT_SET';
  const isSemanticComponent =
    node.semanticType &&
    node.semanticType !== 'Generic' &&
    node.semanticType !== 'Container';

  if (isFigmaComponent || isSemanticComponent) {
    result.push({
      id: node.id,
      name: node.name,
      figmaType: node.type,
      semanticType: node.semanticType || null,
      confidence: node.confidence || 0,
      reasoning: node.reasoning || [],
      layoutPattern: node.layoutPattern || null,
      suggestedComponent: node.suggestedComponent || null,
      bounds: node.bounds || null,
      childrenCount: node.children?.length || 0,
    });
  }

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      extractComponentsFromNode(child, result);
    }
  }

  return result;
};

/**
 * Get reusable components and semantic blocks extracted from project design
 * GET /api/projects/:id/components
 */
export const getProjectComponents = async (req, res, next) => {
  try {
    const { id } = req.params;

    const designTree = await DesignTree.findOne({ projectId: id }).lean();
    if (!designTree) {
      // Check if project exists
      const projectExists = await Project.exists({ _id: id });
      if (!projectExists) {
        throw new AppError(`Project not found with ID: '${id}'`, 404, 'PROJECT_NOT_FOUND');
      }
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    const components = [];
    for (const page of designTree.pages || []) {
      extractComponentsFromNode(page, components);
    }

    return res.status(200).json({
      success: true,
      count: components.length,
      data: components,
    });
  } catch (error) {
    return next(error);
  }
};


/**
 * Design IR Persistence & Document Service
 * Manages storage, retrieval, chunking, and partial page updates for canonical Design IR.
 */

import { DesignIR } from '../models/DesignIR.js';
import { DesignIRPage } from '../models/DesignIRPage.js';
import { Project } from '../models/Project.js';
import { calculateDependencyClosure } from '../ir/dependencyResolver.js';
import { validateDesignIR } from '../ir/validator.js';
import { AppError } from '../middleware/errorHandler.js';

// Chunking threshold: designs exceeding ~3MB or >3 pages are stored in separate page documents
const CHUNK_THRESHOLD_BYTES = 3 * 1024 * 1024;
const CHUNK_PAGE_COUNT_THRESHOLD = 3;

/**
 * Count recursive nodes in a page
 * @param {Object} page
 * @returns {number}
 */
const countPageNodes = (page) => {
  let count = 0;
  const walk = (node) => {
    count++;
    if (Array.isArray(node?.children)) {
      for (const child of node.children) walk(child);
    }
  };
  for (const child of page.children || []) walk(child);
  return count;
};

/**
 * Save canonical Design IR document with automatic document size protection & chunking
 * 
 * @param {string} projectId - MongoDB Project ID
 * @param {Object} ir - Canonical Design IR document
 * @param {Object} [options] - Options (e.g. forceChunk)
 * @returns {Promise<Object>} Persisted DesignIR record
 */
export const saveDesignIR = async (projectId, ir, options = {}) => {
  if (!projectId) {
    throw new AppError('Project ID is required to persist Design IR', 400, 'MISSING_PROJECT_ID');
  }

  // Validate Design IR structure
  const validation = validateDesignIR(ir);
  if (!validation.isValid) {
    console.warn(`[saveDesignIR] Warning: Persisting IR with validation errors: ${validation.errors.join('; ')}`);
  }

  const pages = Array.isArray(ir.pages) ? ir.pages : [];

  // Generate page summaries
  const pageSummaries = pages.map(p => ({
    id: String(p.id),
    name: p.name || 'Page',
    dimensions: p.dimensions || { width: 0, height: 0 },
    sectionCount: Array.isArray(p.sections) ? p.sections.length : 0,
    nodeCount: countPageNodes(p),
  }));

  // Estimate JSON size of pages to determine whether chunking is necessary
  const pagesJsonString = JSON.stringify(pages);
  const pagesByteSize = Buffer.byteLength(pagesJsonString, 'utf8');

  const shouldChunk =
    options.forceChunk === true ||
    pagesByteSize > CHUNK_THRESHOLD_BYTES ||
    pages.length > CHUNK_PAGE_COUNT_THRESHOLD;

  const docData = {
    projectId,
    fileKey: ir.fileKey,
    documentId: ir.documentId,
    fileName: ir.fileName,
    irVersion: ir.version || '1.0.0',
    metadata: {
      ...ir.metadata,
      savedAt: new Date().toISOString(),
      validationErrors: validation.errors,
      validationWarnings: validation.warnings,
      estimatedPagesByteSize: pagesByteSize,
    },
    tokens: ir.tokens || {},
    components: ir.components || [],
    assets: ir.assets || [],
    relationships: ir.relationships || {},
    pageCount: pages.length,
    totalNodeCount: ir.metadata?.totalNodeCount || validation.stats.totalNodes || 0,
    pageSummaries,
    isChunked: shouldChunk,
    pages: shouldChunk ? [] : pages, // Exclude embedded pages if chunked
  };

  const irDoc = await DesignIR.findOneAndUpdate(
    { projectId },
    { $set: docData },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  // If chunked, save each page into the DesignIRPage collection
  if (shouldChunk) {
    console.log(`📦 Design IR chunking enabled for project ${projectId} (${pagesByteSize} bytes across ${pages.length} pages)`);
    for (const page of pages) {
      await DesignIRPage.findOneAndUpdate(
        { projectId, pageId: String(page.id) },
        {
          $set: {
            irId: irDoc._id,
            projectId,
            pageId: String(page.id),
            name: page.name || 'Page',
            dimensions: page.dimensions || { width: 0, height: 0 },
            sections: page.sections || [],
            children: page.children || [],
            nodeCount: countPageNodes(page),
            metadata: page.metadata || {},
          },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
    }
  } else {
    // If not chunked, delete any obsolete separate page chunks from prior chunked imports
    await DesignIRPage.deleteMany({ projectId }).catch(() => {});
  }

  return irDoc;
};

/**
 * Retrieve complete canonical Design IR for a project
 * Automatically reassembles chunked pages if stored separately
 * 
 * @param {string} projectId - MongoDB Project ID
 * @returns {Promise<Object>} Complete Design IR Document
 */
export const getDesignIRByProjectId = async (projectId) => {
  const irDoc = await DesignIR.findOne({ projectId }).lean();
  if (!irDoc) {
    // Check if project exists to provide accurate error code
    const projectExists = await Project.exists({ _id: projectId });
    if (!projectExists) {
      throw new AppError(`Project not found with ID: '${projectId}'`, 404, 'PROJECT_NOT_FOUND');
    }
    throw new AppError(`Design IR not generated yet for project: '${projectId}'`, 404, 'DESIGN_IR_NOT_FOUND');
  }

  // Reassemble pages if chunked
  if (irDoc.isChunked) {
    const chunkedPages = await DesignIRPage.find({ projectId }).sort({ createdAt: 1 }).lean();
    irDoc.pages = chunkedPages.map(cp => ({
      id: cp.pageId,
      name: cp.name,
      dimensions: cp.dimensions,
      sections: cp.sections,
      children: cp.children,
      metadata: cp.metadata,
    }));
  }

  return irDoc;
};

/**
 * Retrieve an individual page from Design IR
 * Fast direct lookup from DesignIRPage if chunked
 * 
 * @param {string} projectId - MongoDB Project ID
 * @param {string} pageId - Target page ID
 * @returns {Promise<Object>} Page object
 */
export const getDesignIRPage = async (projectId, pageId) => {
  const irDoc = await DesignIR.findOne({ projectId }).lean();
  if (!irDoc) {
    throw new AppError(`Design IR not found for project: '${projectId}'`, 404, 'DESIGN_IR_NOT_FOUND');
  }

  if (irDoc.isChunked) {
    const chunkPage = await DesignIRPage.findOne({ projectId, pageId }).lean();
    if (!chunkPage) {
      throw new AppError(`Page '${pageId}' not found in project '${projectId}'`, 404, 'PAGE_NOT_FOUND');
    }
    return {
      id: chunkPage.pageId,
      name: chunkPage.name,
      dimensions: chunkPage.dimensions,
      sections: chunkPage.sections,
      children: chunkPage.children,
      metadata: chunkPage.metadata,
    };
  }

  const page = (irDoc.pages || []).find(p => String(p.id) === String(pageId));
  if (!page) {
    throw new AppError(`Page '${pageId}' not found in project '${projectId}'`, 404, 'PAGE_NOT_FOUND');
  }

  return page;
};

/**
 * Perform partial update on an individual page without re-writing the entire document
 * 
 * @param {string} projectId - MongoDB Project ID
 * @param {string} pageId - Page ID
 * @param {Object} updatedPage - Updated page fields
 * @returns {Promise<Object>} Updated page
 */
export const updateDesignIRPage = async (projectId, pageId, updatedPage) => {
  const irDoc = await DesignIR.findOne({ projectId });
  if (!irDoc) {
    throw new AppError(`Design IR not found for project: '${projectId}'`, 404, 'DESIGN_IR_NOT_FOUND');
  }

  if (irDoc.isChunked) {
    const chunkPage = await DesignIRPage.findOneAndUpdate(
      { projectId, pageId },
      {
        $set: {
          name: updatedPage.name,
          dimensions: updatedPage.dimensions,
          sections: updatedPage.sections,
          children: updatedPage.children,
          metadata: updatedPage.metadata,
        },
      },
      { returnDocument: 'after' }
    ).lean();

    if (!chunkPage) {
      throw new AppError(`Page '${pageId}' not found in project '${projectId}'`, 404, 'PAGE_NOT_FOUND');
    }
    return chunkPage;
  }

  const pageIndex = (irDoc.pages || []).findIndex(p => String(p.id) === String(pageId));
  if (pageIndex === -1) {
    throw new AppError(`Page '${pageId}' not found in project '${projectId}'`, 404, 'PAGE_NOT_FOUND');
  }

  irDoc.pages[pageIndex] = {
    ...irDoc.pages[pageIndex],
    ...updatedPage,
  };
  await irDoc.save();
  return irDoc.pages[pageIndex];
};

/**
 * Retrieve design tokens for a project
 * @param {string} projectId
 * @returns {Promise<Object>}
 */
export const getDesignIRTokens = async (projectId) => {
  const irDoc = await DesignIR.findOne({ projectId }, { tokens: 1, irVersion: 1 }).lean();
  if (!irDoc) {
    throw new AppError(`Design IR not found for project: '${projectId}'`, 404, 'DESIGN_IR_NOT_FOUND');
  }
  return irDoc.tokens || {};
};

/**
 * Retrieve components in Design IR
 * @param {string} projectId
 * @returns {Promise<Array>}
 */
export const getDesignIRComponents = async (projectId) => {
  const irDoc = await DesignIR.findOne({ projectId }, { components: 1, irVersion: 1 }).lean();
  if (!irDoc) {
    throw new AppError(`Design IR not found for project: '${projectId}'`, 404, 'DESIGN_IR_NOT_FOUND');
  }
  return irDoc.components || [];
};

/**
 * Retrieve a specific component and its full dependency closure
 * @param {string} projectId
 * @param {string} componentId
 * @returns {Promise<Object>}
 */
export const getDesignIRComponentWithDependencies = async (projectId, componentId) => {
  const ir = await getDesignIRByProjectId(projectId);
  const closure = calculateDependencyClosure(componentId, ir);

  // Lookup component definition
  const component = (ir.components || []).find(
    c => String(c.id) === String(componentId) || String(c.sourceNodeId) === String(componentId)
  );

  return {
    component,
    dependencies: closure,
  };
};


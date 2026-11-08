import axios from 'axios';
import { processNode } from '../utils/nodeProcessor.js';
import { analyzeSemanticTree } from './figma/semantic/semanticEngine.js';
import {
  extractFileKey,
  extractNodeId,
  normalizeNodeId,
  isValidFigmaUrl,
  parseFigmaUrl,
} from '../utility/url.js';
import { AppError } from '../middleware/errorHandler.js';

// Re-export URL utilities and AppError for backward compatibility and test convenience
export {
  extractFileKey,
  extractNodeId,
  normalizeNodeId,
  isValidFigmaUrl,
  parseFigmaUrl,
  AppError,
};

const FIGMA_API_URL = 'https://api.figma.com/v1';

/**
 * Handle Axios errors from Figma API and convert to AppError with actionable status and details
 * @param {Error} error - Error thrown by Axios
 * @param {string} context - Context string for error message
 */
export const handleFigmaApiError = (error, context = 'Figma API request failed') => {
  if (error instanceof AppError) {
    throw error;
  }

  // Network timeout
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    throw new AppError(
      `${context}: Request timed out. Figma servers took too long to respond.`,
      504,
      'GATEWAY_TIMEOUT'
    );
  }

  // No response received (Network / DNS error)
  if (error.request && !error.response) {
    throw new AppError(
      `${context}: Unable to reach Figma API. Please check network connectivity.`,
      503,
      'NETWORK_ERROR'
    );
  }

  if (error.response) {
    const status = error.response.status;
    const responseData = error.response.data || {};
    const apiMessage = responseData.err || responseData.message || error.message;

    if (status === 401) {
      throw new AppError(
        'Invalid or expired Figma access token. Please check your FIGMA_TOKEN environment variable.',
        401,
        'FIGMA_UNAUTHORIZED',
        { apiMessage }
      );
    }

    if (status === 403) {
      throw new AppError(
        'Access denied. You do not have permission to view this Figma file.',
        403,
        'FIGMA_FORBIDDEN',
        { apiMessage }
      );
    }

    if (status === 404) {
      throw new AppError(
        'Figma file or node not found. Please verify the URL and file access permissions.',
        404,
        'FIGMA_NOT_FOUND',
        { apiMessage }
      );
    }

    if (status === 429) {
      const retryAfter = error.response.headers?.['retry-after'] || '60';
      const appErr = new AppError(
        `Figma API rate limit exceeded. Please wait ${retryAfter} seconds before retrying.`,
        429,
        'FIGMA_RATE_LIMITED',
        { retryAfter }
      );
      appErr.retryAfter = retryAfter;
      throw appErr;
    }

    throw new AppError(
      `${context}: Figma returned error (${status}) - ${apiMessage}`,
      status,
      `FIGMA_ERROR_${status}`,
      responseData
    );
  }

  throw new AppError(`${context}: ${error.message}`, 500, 'INTERNAL_ERROR');
};

/**
 * Fetch full Figma file document from Figma API
 * @param {string} fileKey - Figma file key extracted from URL
 * @param {string} token - Figma API token
 * @param {Object} options - Request options (e.g. timeout)
 * @returns {Promise<Object>} Raw Figma file data
 */
export const fetchFigmaFile = async (fileKey, token, options = {}) => {
  if (!fileKey) {
    throw new AppError('File key is required to fetch Figma document', 400, 'MISSING_FILE_KEY');
  }

  if (!token) {
    throw new AppError(
      'Figma token not configured. Please set FIGMA_TOKEN in environment variables.',
      500,
      'MISSING_FIGMA_TOKEN'
    );
  }

  const { timeout = 30000 } = options;

  try {
    const response = await axios.get(`${FIGMA_API_URL}/files/${fileKey}`, {
      headers: {
        'X-Figma-Token': token,
      },
      timeout,
    });
    return response.data;
  } catch (error) {
    handleFigmaApiError(error, `Failed to fetch Figma file (${fileKey})`);
  }
};

/**
 * Fetch specific nodes from a Figma file for selective component extraction
 * @param {string} fileKey - Figma file key
 * @param {string|string[]} nodeIds - Single node ID or array of node IDs (e.g., '1:23')
 * @param {string} token - Figma API token
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Raw Figma nodes response
 */
export const fetchFigmaNodes = async (fileKey, nodeIds, token, options = {}) => {
  if (!fileKey) {
    throw new AppError('File key is required to fetch Figma nodes', 400, 'MISSING_FILE_KEY');
  }

  if (!nodeIds || (Array.isArray(nodeIds) && nodeIds.length === 0)) {
    throw new AppError('Node ID(s) required to fetch specific Figma nodes', 400, 'MISSING_NODE_IDS');
  }

  if (!token) {
    throw new AppError(
      'Figma token not configured. Please set FIGMA_TOKEN in environment variables.',
      500,
      'MISSING_FIGMA_TOKEN'
    );
  }

  const ids = Array.isArray(nodeIds) ? nodeIds.join(',') : nodeIds;
  const { timeout = 30000 } = options;

  try {
    const response = await axios.get(`${FIGMA_API_URL}/files/${fileKey}/nodes`, {
      params: { ids },
      headers: {
        'X-Figma-Token': token,
      },
      timeout,
    });
    return response.data;
  } catch (error) {
    handleFigmaApiError(error, `Failed to fetch Figma nodes [${ids}] for file (${fileKey})`);
  }
};

/**
 * Retrieve and normalize selective Figma nodes without downloading the entire file
 * Supports FRAME, COMPONENT, COMPONENT_SET, INSTANCE, and all container nodes
 * 
 * @param {string} fileKey - Figma file key
 * @param {string|string[]} nodeIds - Single node ID or array of node IDs
 * @param {string} [token] - Figma API token
 * @param {Object} [options] - Normalization & request options
 * @returns {Promise<Object>} Normalized nodes and retrieval metadata
 */
export const getSelectiveNodes = async (fileKey, nodeIds, token = process.env.FIGMA_TOKEN, options = {}) => {
  if (!fileKey) {
    throw new AppError('File key is required to fetch Figma nodes', 400, 'MISSING_FILE_KEY');
  }

  if (!nodeIds || (Array.isArray(nodeIds) && nodeIds.length === 0)) {
    throw new AppError('Node ID(s) required to fetch specific Figma nodes', 400, 'MISSING_NODE_IDS');
  }

  const rawIdList = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
  const normalizedIds = rawIdList
    .map(id => (typeof id === 'string' ? normalizeNodeId(id.trim()) : id))
    .filter(Boolean);

  if (normalizedIds.length === 0) {
    throw new AppError('No valid node IDs provided', 400, 'INVALID_NODE_IDS');
  }

  const rawData = await fetchFigmaNodes(fileKey, normalizedIds, token, options);

  const {
    includeDecorative = false,
    includeSeparators = false,
    includeSemantics = true,
  } = options;

  const nodesMap = rawData.nodes || {};
  const processedNodes = [];
  const processedNodesById = {};
  const missingNodeIds = [];

  for (const id of normalizedIds) {
    const nodeEntry = nodesMap[id];
    if (!nodeEntry || !nodeEntry.document) {
      missingNodeIds.push(id);
      continue;
    }

    const processed = processNode(nodeEntry.document, {
      includeDecorative,
      includeSeparators,
      includeSemantics,
      includeLayout: true,
      includeStyles: true,
    });

    if (processed) {
      const finalNode = includeSemantics ? analyzeSemanticTree(processed) : processed;

      // Preserve component metadata if available from Figma
      if (nodeEntry.components && Object.keys(nodeEntry.components).length > 0) {
        finalNode.componentMetadata = nodeEntry.components;
      }

      processedNodes.push(finalNode);
      processedNodesById[id] = finalNode;
    } else {
      missingNodeIds.push(id);
    }
  }

  return {
    fileKey,
    fileName: rawData.name || 'Figma Design',
    fileVersion: rawData.version || '1.0',
    nodes: processedNodes,
    nodesById: processedNodesById,
    missingNodeIds,
    totalFound: processedNodes.length,
    totalRequested: normalizedIds.length,
  };
};

/**
 * Export visual assets (PNG, SVG, JPG, PDF) for selected nodes via Figma images API
 * Includes automatic retry with exponential backoff on HTTP 429
 * 
 * @param {string} fileKey - Figma file key
 * @param {string|string[]} nodeIds - Single or array of node IDs
 * @param {Object} [options] - Export options (format, scale, svgIncludeId, etc.)
 * @param {string} [token] - Figma API token
 * @returns {Promise<Object>} Object mapping nodeId -> image download URL or null
 */
export const exportFigmaImages = async (fileKey, nodeIds, options = {}, token = process.env.FIGMA_TOKEN) => {
  if (!fileKey) {
    throw new AppError('File key is required to export Figma images', 400, 'MISSING_FILE_KEY');
  }

  if (!nodeIds || (Array.isArray(nodeIds) && nodeIds.length === 0)) {
    throw new AppError('Node ID(s) required to export Figma images', 400, 'MISSING_NODE_IDS');
  }

  if (!token) {
    throw new AppError(
      'Figma token not configured. Please set FIGMA_TOKEN in environment variables.',
      500,
      'MISSING_FIGMA_TOKEN'
    );
  }

  const rawIdList = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
  const normalizedIds = rawIdList
    .map(id => (typeof id === 'string' ? normalizeNodeId(id.trim()) : id))
    .filter(Boolean);

  const {
    format = 'png',
    scale = 1,
    svgIncludeId = true,
    svgSimplifyStroke = true,
    timeout = 30000,
    maxRetries = 3,
  } = options;

  const validFormats = ['png', 'svg', 'jpg', 'pdf'];
  if (!validFormats.includes(format.toLowerCase())) {
    throw new AppError(
      `Unsupported export format: ${format}. Supported formats: ${validFormats.join(', ')}`,
      400,
      'INVALID_EXPORT_FORMAT'
    );
  }

  const idsParam = normalizedIds.join(',');
  const params = {
    ids: idsParam,
    format: format.toLowerCase(),
    scale: Math.min(Math.max(scale, 0.01), 4),
  };

  if (format.toLowerCase() === 'svg') {
    if (svgIncludeId) params.svg_include_id = true;
    if (svgSimplifyStroke) params.svg_simplify_stroke = true;
  }

  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const response = await axios.get(`${FIGMA_API_URL}/images/${fileKey}`, {
        params,
        headers: {
          'X-Figma-Token': token,
        },
        timeout,
      });

      return {
        err: response.data.err || null,
        images: response.data.images || {},
      };
    } catch (error) {
      if (error.response && error.response.status === 429 && attempt < maxRetries) {
        attempt++;
        const retryAfterSec = parseInt(error.response.headers?.['retry-after'], 10) || Math.pow(2, attempt);
        const waitMs = retryAfterSec * 1000;
        console.warn(`[exportFigmaImages] 429 Rate limited. Retrying after ${retryAfterSec}s (attempt ${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }
      handleFigmaApiError(error, `Failed to export Figma images for file (${fileKey})`);
    }
  }
};

/**
 * Fetch image fill URLs for an entire Figma file (maps imageRef to temporary S3 URL)
 * GET /v1/files/:fileKey/images
 * 
 * @param {string} fileKey - Figma file key
 * @param {string} [token] - Figma API token
 * @param {Object} [options] - Request options
 * @returns {Promise<Object>} Map of imageRef -> URL
 */
export const fetchFigmaImageFills = async (fileKey, token = process.env.FIGMA_TOKEN, options = {}) => {
  if (!fileKey) {
    throw new AppError('File key is required to fetch Figma image fills', 400, 'MISSING_FILE_KEY');
  }

  if (!token) {
    throw new AppError(
      'Figma token not configured. Please set FIGMA_TOKEN in environment variables.',
      500,
      'MISSING_FIGMA_TOKEN'
    );
  }

  const { timeout = 30000 } = options;

  try {
    const response = await axios.get(`${FIGMA_API_URL}/files/${fileKey}/images`, {
      headers: {
        'X-Figma-Token': token,
      },
      timeout,
    });

    return {
      err: response.data.err || null,
      meta: response.data.meta || {},
      images: response.data.meta?.images || {},
    };
  } catch (error) {
    handleFigmaApiError(error, `Failed to fetch Figma image fills for file (${fileKey})`);
  }
};

/**
 * Parse Figma JSON and build enhanced tree with semantic classification
 * Pipeline: Raw Nodes -> Filtering -> Style Extraction -> Layout Extraction -> Semantic Classification
 * 
 * @param {Object} figmaData - Raw Figma file data
 * @param {Object} options - Processing options
 * @returns {Object} Enhanced tree with semantic information
 */
export const parseDesignTree = (figmaData, options = {}) => {
  if (!figmaData || !figmaData.document) {
    throw new AppError('Invalid Figma data structure: missing document root', 422, 'INVALID_FIGMA_DATA');
  }

  const {
    includeDecorative = false,
    includeSeparators = false,
    includeSemantics = true,
  } = options;

  const document = figmaData.document;
  
  // Process canvas pages through the full normalization and semantic pipeline
  const pages = (document.children || [])
    .filter(child => child.type === 'CANVAS')
    .map(canvas => {
      const processed = processNode(canvas, {
        includeDecorative,
        includeSeparators,
        includeSemantics,
        includeLayout: true,
        includeStyles: true,
      });
      
      // Run recursive semantic analysis pass
      if (includeSemantics && processed) {
        return analyzeSemanticTree(processed);
      }
      
      return processed;
    })
    .filter(page => page !== null);

  return {
    fileName: figmaData.name || 'Design',
    fileVersion: figmaData.version,
    pages: pages,
    totalNodeCount: countNodes(figmaData.document),
    processingOptions: {
      includeDecorative,
      includeSeparators,
      includeSemantics,
    },
  };
};

/**
 * Legacy parseDesignTree wrapper for backward compatibility
 * @param {Object} figmaData - Raw Figma file data
 * @returns {Object} Processed tree
 */
export const parseDesignTreeBasic = (figmaData) => {
  return parseDesignTree(figmaData, {
    includeDecorative: false,
    includeSeparators: false,
    includeSemantics: true,
  });
};

/**
 * Count total nodes recursively
 * @param {Object} node - Root node
 * @returns {number} Total node count
 */
export const countNodes = (node) => {
  if (!node) return 0;
  let count = 1;
  if (node.children && Array.isArray(node.children)) {
    count += node.children.reduce((sum, child) => sum + countNodes(child), 0);
  }
  return count;
};

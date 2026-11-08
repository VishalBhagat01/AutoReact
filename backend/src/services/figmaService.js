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

import axios from 'axios';
import { processNode } from '../utils/nodeProcessor.js';
import { isSupportedNodeType } from '../utils/nodeFilter.js';
import { analyzeSemanticTree } from './figma/semantic/semanticEngine.js';

const FIGMA_API_URL = 'https://api.figma.com/v1';

/**
 * Fetch Figma file data from API
 * @param {string} fileKey - Figma file key extracted from URL
 * @param {string} token - Figma API token
 * @returns {Promise<Object>} Raw Figma file data
 */
export const fetchFigmaFile = async (fileKey, token) => {
  try {
    const response = await axios.get(`${FIGMA_API_URL}/files/${fileKey}`, {
      headers: {
        'X-Figma-Token': token,
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch Figma file: ${error.message}`);
  }
};

/**
 * Extract Figma file key from URL
 * Supports formats:
 * - https://www.figma.com/file/KEY/name
 * - https://www.figma.com/design/KEY/name
 * @param {string} url - Figma URL
 * @returns {string|null} File key or null if invalid
 */
export const extractFileKey = (url) => {
  const patterns = [
    /figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/,
    /figma\.com\/proto\/([a-zA-Z0-9]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
};



/**
 * Parse Figma JSON and build enhanced tree with semantic classification
 * Uses the complete processing pipeline:
 * Raw Nodes -> Filtering -> Style Extraction -> Layout Extraction -> Semantic Classification
 * 
 * @param {Object} figmaData - Raw Figma file data
 * @param {Object} options - Processing options
 * @returns {Object} Enhanced tree with semantic information
 */
export const parseDesignTree = (figmaData, options = {}) => {
  if (!figmaData || !figmaData.document) {
    throw new Error('Invalid Figma data structure');
  }

  const {
    includeDecorative = false,
    includeSeparators = false,
    includeSemantics = true,
  } = options;

  const document = figmaData.document;
  
  // Process children of the root document through the full pipeline
  const pages = document.children
    .filter(child => child.type === 'CANVAS')
    .map(canvas => {
      const processed = processNode(canvas, {
        includeDecorative,
        includeSeparators,
        includeSemantics,
        includeLayout: true,
        includeStyles: true,
      });
      
      // Run semantic analysis pass
      if (includeSemantics && processed) {
        return analyzeSemanticTree(processed);
      }
      
      return processed;
    })
    .filter(page => page !== null); // Remove filtered pages

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
 * Falls back to basic filtering without decorative nodes
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
const countNodes = (node) => {
  let count = 1;
  if (node.children && Array.isArray(node.children)) {
    count += node.children.reduce((sum, child) => sum + countNodes(child), 0);
  }
  return count;
};

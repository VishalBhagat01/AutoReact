/**
 * Node Processor Utilities
 * Unified interface for processing Figma nodes through the complete pipeline
 */

import { shouldIncludeNode, filterChildren } from './nodeFilter.js';
import { extractStyles } from './styleExtractor.js';
import { extractLayout, extractResponsiveInfo } from './layoutExtractor.js';

/**
 * Comprehensive node processing function
 * Applies filtering, style extraction, layout extraction, and semantic classification
 * @param {Object} node - Raw Figma node
 * @param {Object} options - Processing options
 * @returns {Object|null} Processed node with all enhancements, or null if filtered out
 */
export const processNode = (node, options = {}) => {
  const {
    includeDecorative = false,
    includeSeparators = false,
    includeSemantics = true,
    includeLayout = true,
    includeStyles = true,
  } = options;

  // Step 1: Filter decorative nodes
  if (!shouldIncludeNode(node, { includeDecorative, includeSeparators })) {
    return null;
  }

  // Step 2: Build normalized node
  const processed = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  // Step 3: Extract layout information
  if (includeLayout) {
    const layout = extractLayout(node);
    if (layout) {
      processed.layout = layout;
      
      // Add responsive info
      const responsive = extractResponsiveInfo(node);
      if (responsive) {
        processed.responsive = responsive;
      }
    }
  }

  // Step 4: Extract styles
  if (includeStyles) {
    const styles = extractStyles(node);
    if (styles) {
      processed.styles = styles;
    }
  }

  // Step 5: Extract text content
  if (node.type === 'TEXT' && node.characters) {
    processed.text = node.characters;
  }

  // Step 6: Extract dimensions
  if (node.absoluteBoundingBox) {
    processed.bounds = {
      x: Math.round(node.absoluteBoundingBox.x),
      y: Math.round(node.absoluteBoundingBox.y),
      width: Math.round(node.absoluteBoundingBox.width),
      height: Math.round(node.absoluteBoundingBox.height),
    };
  }

  // Step 8: Recursively process children
  if (node.children && Array.isArray(node.children)) {
    const processedChildren = node.children
      .map(child => processNode(child, options))
      .filter(child => child !== null); // Remove filtered nodes

    if (processedChildren.length > 0) {
      processed.children = processedChildren;
    }
  }

  return processed;
};

/**
 * Get comprehensive node inspection data for UI display
 * @param {Object} node - Processed or raw node
 * @returns {Object} Inspection data for display
 */
export const getNodeInspection = (node) => {
  if (!node) return null;

  const inspection = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  // Basic info
  if (node.text) {
    inspection.text = node.text;
  }

  if (node.bounds) {
    inspection.bounds = node.bounds;
  }

  // Layout info
  if (node.layout) {
    inspection.layout = node.layout;
  }

  if (node.responsive) {
    inspection.responsive = node.responsive;
  }

  // Styling info
  if (node.styles) {
    inspection.styles = node.styles;
  }

  // Semantic classification
  if (node.semantic) {
    inspection.semantic = node.semantic;
  }

  // Children count
  if (node.children) {
    inspection.childrenCount = node.children.length;
  }

  return inspection;
};

/**
 * Export node data as JSON for external tools
 * @param {Object} node - Processed node
 * @returns {string} JSON string
 */
export const exportNodeAsJSON = (node) => {
  return JSON.stringify(node, null, 2);
};

/**
 * Export node data as code comment (for React generation)
 * @param {Object} node - Processed node
 * @returns {string} Comment string
 */
export const exportNodeAsComment = (node) => {
  const lines = [
    '/**',
    ` * Component: ${node.name}`,
    ` * Type: ${node.semantic?.type || node.type}`,
  ];

  if (node.semantic?.confidence) {
    lines.push(` * Confidence: ${node.semantic.confidence}%`);
  }

  if (node.semantic?.reasoning?.length) {
    lines.push(' * Reasoning:');
    node.semantic.reasoning.forEach(reason => {
      lines.push(` *   - ${reason}`);
    });
  }

  if (node.layout) {
    lines.push(` * Layout: ${JSON.stringify(node.layout)}`);
  }

  if (node.styles) {
    lines.push(` * Styles: ${JSON.stringify(node.styles)}`);
  }

  lines.push(' */');

  return lines.join('\n');
};

/**
 * Generate a tree map summary with statistics
 * @param {Object} tree - Root processed node
 * @returns {Object} Tree statistics
 */
export const generateTreeStatistics = (tree) => {
  const stats = {
    totalNodes: 0,
    byType: {},
    bySemanticType: {},
    withStyles: 0,
    withLayout: 0,
    withText: 0,
    depth: 0,
  };

  const traverse = (node, depth = 0) => {
    stats.totalNodes++;
    stats.depth = Math.max(stats.depth, depth);

    // Count by type
    stats.byType[node.type] = (stats.byType[node.type] || 0) + 1;

    // Count by semantic type
    if (node.semantic?.type) {
      stats.bySemanticType[node.semantic.type] = 
        (stats.bySemanticType[node.semantic.type] || 0) + 1;
    }

    // Count enriched nodes
    if (node.styles) stats.withStyles++;
    if (node.layout) stats.withLayout++;
    if (node.text) stats.withText++;

    // Traverse children
    if (node.children) {
      node.children.forEach(child => traverse(child, depth + 1));
    }
  };

  traverse(tree);

  return stats;
};

/**
 * Search nodes by predicate function
 * @param {Object} tree - Root node
 * @param {Function} predicate - Search function
 * @returns {Array<Object>} Matching nodes
 */
export const searchNodes = (tree, predicate) => {
  const results = [];

  const traverse = (node) => {
    if (predicate(node)) {
      results.push(node);
    }

    if (node.children) {
      node.children.forEach(child => traverse(child));
    }
  };

  traverse(tree);
  return results;
};

/**
 * Find nodes by semantic type
 * @param {Object} tree - Root node
 * @param {string} semanticType - Semantic type to search for
 * @returns {Array<Object>} Matching nodes
 */
export const findBySemanticType = (tree, semanticType) => {
  return searchNodes(tree, node => node.semantic?.type === semanticType);
};

/**
 * Find nodes by Figma type
 * @param {Object} tree - Root node
 * @param {string} figmaType - Figma type to search for
 * @returns {Array<Object>} Matching nodes
 */
export const findByFigmaType = (tree, figmaType) => {
  return searchNodes(tree, node => node.type === figmaType);
};

/**
 * Get all leaf nodes (nodes with no children)
 * @param {Object} tree - Root node
 * @returns {Array<Object>} Leaf nodes
 */
export const getLeafNodes = (tree) => {
  return searchNodes(tree, node => !node.children || node.children.length === 0);
};

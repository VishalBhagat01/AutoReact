/**
 * Semantic Classifier (Unified Adapter)
 * Delegates to the unified modular semantic engine at services/figma/semantic
 * Maintained for backward compatibility and to avoid competing classification systems.
 */

import {
  analyzeSemanticTree,
  classifyNode,
} from '../services/figma/semantic/semanticEngine.js';
import {
  SemanticTypes,
  semanticTypeToReactComponent,
} from '../services/figma/semantic/constants.js';

export {
  analyzeSemanticTree,
  classifyNode,
  SemanticTypes,
  semanticTypeToReactComponent,
};

/**
 * Classify a node semantically based on its properties
 * Backward-compatible wrapper around the unified semantic engine
 * @param {Object} node - Figma node
 * @returns {Object} Classification result with type, confidence (0-100), and reasoning
 */
export const classifyNodeSemantically = (node) => {
  const result = classifyNode(node);
  return {
    figmaType: node.type,
    semanticType: result.semanticType,
    confidence: Math.round(result.confidence * 100),
    reasoning: result.reasoning || [],
  };
};

/**
 * Get a semantic DSL summary for a node
 * @param {Object} node - Figma node
 * @returns {Object} DSL summary
 */
export const getSemanticDSLSummary = (node) => {
  const analyzed = analyzeSemanticTree(node);
  return {
    nodeId: node.id,
    nodeName: node.name,
    figmaType: node.type,
    semanticType: analyzed.semanticType,
    confidence: Math.round(analyzed.confidence * 100),
    reasoning: analyzed.reasoning,
    layoutPattern: analyzed.layoutPattern,
    suggestedComponent: analyzed.suggestedComponent,
    suggestedProps: analyzed.suggestedProps,
    tailwindClasses: analyzed.suggestedTailwind,
  };
};

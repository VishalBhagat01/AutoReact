/**
 * Design IR Validation Engine
 * Enforces structural, referential, geometric, and dependency integrity
 * across the canonical Design IR.
 */

import { IR_VERSION, NodeTypes } from './schema.js';
import { calculateDependencyClosure } from './dependencyResolver.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Validate a canonical Design IR document
 * 
 * @param {Object} ir - Canonical Design IR document
 * @param {Object} [options] - Validation options
 * @param {boolean} [options.throwOnError=false] - Whether to throw AppError if invalid
 * @returns {{ isValid: boolean, errors: string[], warnings: string[], stats: Object }}
 */
export const validateDesignIR = (ir, options = {}) => {
  const errors = [];
  const warnings = [];

  if (!ir || typeof ir !== 'object') {
    errors.push('Design IR must be a non-null object');
    if (options.throwOnError) {
      throw new AppError('Invalid Design IR: root must be an object', 422, 'INVALID_DESIGN_IR', { errors });
    }
    return { isValid: false, errors, warnings, stats: {} };
  }

  // 1. Schema Version Check
  if (!ir.version) {
    errors.push('Missing IR schema version');
  } else if (typeof ir.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(ir.version)) {
    errors.push(`Invalid IR schema version format: '${ir.version}'. Expected semver (e.g., '1.0.0')`);
  }

  // 2. Required Root IDs
  if (!ir.documentId) {
    errors.push('Missing required root documentId');
  }
  if (!ir.fileKey) {
    errors.push('Missing required root fileKey');
  }

  // Assets Index
  const assetMap = new Map();
  const assetsList = Array.isArray(ir.assets) ? ir.assets : Object.values(ir.assets || {});
  for (const asset of assetsList) {
    if (!asset.assetId) {
      errors.push('Asset definition missing required assetId');
    } else {
      assetMap.set(String(asset.assetId), asset);
    }
  }

  // Components Index
  const componentMap = new Map();
  const componentsList = Array.isArray(ir.components) ? ir.components : Object.values(ir.components || {});
  for (const comp of componentsList) {
    if (!comp.id) {
      errors.push('Component definition missing required id');
    } else {
      componentMap.set(String(comp.id), comp);
    }
    if (!comp.sourceNodeId) {
      errors.push(`Component '${comp.id}' missing required sourceNodeId`);
    }
  }

  // 3. Pages & Nodes Validation
  const seenNodeIds = new Set();
  const pagesList = Array.isArray(ir.pages) ? ir.pages : [];
  let totalNodeCount = 0;

  for (const page of pagesList) {
    if (!page.id) {
      errors.push('Page missing required id');
    }
    if (!page.name) {
      warnings.push(`Page '${page.id}' has empty name`);
    }

    const validateNode = (node, parentId = null, path = '') => {
      totalNodeCount++;
      const currentPath = path ? `${path} -> ${node.id || 'unnamed'}` : (node.id || 'root');

      // Required node attributes
      if (!node.id) {
        errors.push(`Node at path '${currentPath}' is missing required id`);
      } else {
        const strId = String(node.id);
        if (seenNodeIds.has(strId)) {
          errors.push(`Duplicate node ID detected: '${strId}' at path '${currentPath}'`);
        }
        seenNodeIds.add(strId);
      }

      if (!node.type) {
        errors.push(`Node '${node.id}' is missing required type`);
      } else if (!Object.values(NodeTypes).includes(node.type)) {
        warnings.push(`Node '${node.id}' has unlisted or custom type: '${node.type}'`);
      }

      // Geometry checks
      if (!node.bounds || typeof node.bounds.width !== 'number' || typeof node.bounds.height !== 'number') {
        warnings.push(`Node '${node.id}' (${node.name}) has missing or invalid bounds geometry`);
      } else {
        if (node.bounds.width < 0 || node.bounds.height < 0) {
          errors.push(`Node '${node.id}' has negative dimensions: ${node.bounds.width}x${node.bounds.height}`);
        }
      }

      // Asset reference validation
      const nodeAssets = Array.isArray(node.assets) ? node.assets : node.asset ? [node.asset] : [];
      for (const a of nodeAssets) {
        if (a?.assetId && !assetMap.has(String(a.assetId))) {
          warnings.push(`Node '${node.id}' references asset '${a.assetId}' which is not in document assets catalog`);
        }
      }

      // Component reference validation
      if (node.type === NodeTypes.INSTANCE) {
        const refCompId = node.componentId || node.metadata?.componentId;
        if (!refCompId) {
          warnings.push(`Instance node '${node.id}' has no componentId reference`);
        } else if (!componentMap.has(String(refCompId))) {
          warnings.push(`Instance node '${node.id}' references unknown component definition '${refCompId}'`);
        }
      }

      // Hierarchy cycle check: parent cannot be child of itself
      if (parentId && node.id && String(node.id) === String(parentId)) {
        errors.push(`Hierarchy self-reference loop detected: node '${node.id}' is its own parent`);
      }

      // Validate children recursively
      if (node.children) {
        if (!Array.isArray(node.children)) {
          errors.push(`Node '${node.id}' children property must be an array`);
        } else {
          for (const child of node.children) {
            if (!child || typeof child !== 'object') {
              errors.push(`Node '${node.id}' has null or non-object child`);
            } else {
              validateNode(child, node.id, currentPath);
            }
          }
        }
      }
    };

    if (Array.isArray(page.children)) {
      for (const child of page.children) {
        validateNode(child, null, `Page:${page.name || page.id}`);
      }
    }
  }

  // 4. Component Dependency Cycles Check
  for (const comp of componentsList) {
    try {
      const closure = calculateDependencyClosure(comp.id, ir);
      if (closure.isCircular) {
        warnings.push(`Circular component dependency: ${closure.cycleDetails}`);
      }
    } catch {
      // Handled by component lookup errors above
    }
  }

  const isValid = errors.length === 0;

  if (!isValid && options.throwOnError) {
    throw new AppError(
      `Design IR validation failed with ${errors.length} error(s): ${errors[0]}`,
      422,
      'DESIGN_IR_VALIDATION_FAILED',
      { errors, warnings }
    );
  }

  return {
    isValid,
    errors,
    warnings,
    stats: {
      totalNodes: totalNodeCount,
      pageCount: pagesList.length,
      componentCount: componentsList.length,
      assetCount: assetsList.length,
      tokenCount: ir.tokens?.colors?.raw?.length || 0,
    },
  };
};


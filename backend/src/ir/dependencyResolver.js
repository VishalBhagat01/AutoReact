/**
 * Component Dependency Resolution Engine
 * Computes complete transitive dependency closures (components, assets, design tokens)
 * for selected components and detects circular dependency chains.
 */

import { AppError } from '../middleware/errorHandler.js';

/**
 * Calculate the complete transitive dependency closure for a component in Design IR
 * 
 * @param {string} componentId - Target component ID or source node ID
 * @param {Object} ir - Canonical Design IR document
 * @returns {Object} Dependency closure result
 */
export const calculateDependencyClosure = (componentId, ir) => {
  if (!ir) {
    throw new AppError('Design IR document is required for dependency resolution', 400, 'MISSING_IR_DOC');
  }

  const componentsList = Array.isArray(ir.components)
    ? ir.components
    : Object.values(ir.components || {});

  // Build component index by ID and by sourceNodeId
  const componentMap = new Map();
  for (const c of componentsList) {
    if (c?.id) componentMap.set(String(c.id), c);
    if (c?.sourceNodeId) componentMap.set(String(c.sourceNodeId), c);
  }

  const rootComponent = componentMap.get(String(componentId));
  if (!rootComponent) {
    throw new AppError(
      `Component not found in Design IR with ID: '${componentId}'`,
      404,
      'COMPONENT_NOT_FOUND'
    );
  }

  // Transitive sets
  const transitiveComponentIds = new Set();
  const transitiveAssetIds = new Set();
  const transitiveTokenKeys = new Set();
  const allNodeIds = new Set();

  // Graph representation for visualization/inspection
  const graphNodes = [];
  const graphEdges = [];
  const seenGraphNodes = new Set();

  const addGraphNode = (id, name, type) => {
    if (!seenGraphNodes.has(id)) {
      seenGraphNodes.add(id);
      graphNodes.push({ id, name, type });
    }
  };

  addGraphNode(rootComponent.id, rootComponent.name, 'COMPONENT');

  // Cycle detection structures
  let isCircular = false;
  let cycleDetails = null;
  const recursionStack = new Set();
  const visited = new Set();

  const resolveComponent = (currentComp, currentChain = []) => {
    const currentId = String(currentComp.id);

    if (recursionStack.has(currentId)) {
      isCircular = true;
      cycleDetails = `Circular dependency detected: ${currentChain.join(' -> ')} -> ${currentId}`;
      return;
    }

    if (visited.has(currentId)) {
      return;
    }

    visited.add(currentId);
    recursionStack.add(currentId);
    currentChain.push(currentId);

    // Collect direct assets
    const directAssets = currentComp.dependencies?.assetIds || [];
    for (const aId of directAssets) {
      transitiveAssetIds.add(String(aId));
      addGraphNode(String(aId), `Asset_${aId}`, 'ASSET');
      graphEdges.push({ source: currentId, target: String(aId), type: 'ASSET' });
    }

    // Collect direct tokens
    const directTokens = currentComp.dependencies?.tokenKeys || [];
    for (const tKey of directTokens) {
      transitiveTokenKeys.add(String(tKey));
      addGraphNode(String(tKey), String(tKey), 'TOKEN');
      graphEdges.push({ source: currentId, target: String(tKey), type: 'TOKEN' });
    }

    // Collect all contained node IDs
    const compNodeIds = currentComp.dependencies?.allNodeIds || [];
    for (const nId of compNodeIds) {
      allNodeIds.add(String(nId));
    }

    // Recurse into nested components
    const nestedIds = currentComp.dependencies?.componentIds || [];
    for (const nestedId of nestedIds) {
      const childComp = componentMap.get(String(nestedId));
      if (childComp) {
        const childId = String(childComp.id);
        if (childId !== currentId) {
          transitiveComponentIds.add(childId);
          addGraphNode(childId, childComp.name, 'COMPONENT');
          graphEdges.push({ source: currentId, target: childId, type: 'NESTED_COMPONENT' });
          resolveComponent(childComp, [...currentChain]);
        }
      }
    }

    recursionStack.delete(currentId);
  };

  resolveComponent(rootComponent, []);

  return {
    componentId: String(rootComponent.id),
    componentName: rootComponent.name,
    sourceNodeId: String(rootComponent.sourceNodeId),
    componentType: rootComponent.componentType,
    directDependencies: {
      componentIds: rootComponent.dependencies?.componentIds || [],
      assetIds: rootComponent.dependencies?.assetIds || [],
      tokenKeys: rootComponent.dependencies?.tokenKeys || [],
    },
    transitiveDependencies: {
      componentIds: Array.from(transitiveComponentIds),
      assetIds: Array.from(transitiveAssetIds),
      tokenKeys: Array.from(transitiveTokenKeys),
    },
    allNodeIds: Array.from(allNodeIds),
    isCircular,
    cycleDetails,
    dependencyGraph: {
      nodes: graphNodes,
      edges: graphEdges,
    },
  };
};


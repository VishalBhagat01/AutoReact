/**
 * Tree utility functions
 */

/**
 * Flatten tree structure into array of nodes
 * @param {Object} node - Root node
 * @param {Array} result - Accumulator array
 * @returns {Array} Flattened array of all nodes
 */
export const flattenTree = (node, result = []) => {
  result.push(node);
  if (node.children && Array.isArray(node.children)) {
    node.children.forEach(child => flattenTree(child, result));
  }
  return result;
};

/**
 * Count total nodes in tree
 * @param {Object} node - Root node
 * @returns {number} Total node count
 */
export const countTreeNodes = (node) => {
  let count = 1;
  if (node.children && Array.isArray(node.children)) {
    count += node.children.reduce((sum, child) => sum + countTreeNodes(child), 0);
  }
  return count;
};

/**
 * Get tree depth
 * @param {Object} node - Root node
 * @returns {number} Maximum depth
 */
export const getTreeDepth = (node) => {
  if (!node.children || node.children.length === 0) return 1;
  return 1 + Math.max(...node.children.map(child => getTreeDepth(child)));
};

/**
 * Get statistics about the tree
 * @param {Object} node - Root node
 * @returns {Object} Tree statistics
 */
export const getTreeStats = (node) => {
  const allNodes = flattenTree(node);
  const nodesByType = {};
  
  allNodes.forEach(n => {
    nodesByType[n.type] = (nodesByType[n.type] || 0) + 1;
  });

  return {
    totalNodes: allNodes.length,
    depth: getTreeDepth(node),
    nodesByType,
  };
};

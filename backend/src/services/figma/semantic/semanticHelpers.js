/**
 * Helper utilities for semantic detection
 */

/**
 * Check if a node contains text with specific keywords
 * @param {Object} node 
 * @param {RegExp} pattern 
 * @returns {boolean}
 */
export const hasTextMatching = (node, pattern) => {
  if (node.type === 'TEXT' && node.characters) {
    return pattern.test(node.characters);
  }
  
  if (node.children) {
    return node.children.some(child => hasTextMatching(child, pattern));
  }
  
  return false;
};

/**
 * Get all text content from a node and its children
 * @param {Object} node 
 * @returns {string}
 */
export const getAllText = (node) => {
  let text = '';
  if (node.type === 'TEXT' && node.characters) {
    text += node.characters + ' ';
  }
  if (node.children) {
    text += node.children.map(getAllText).join(' ');
  }
  return text.trim();
};

/**
 * Calculate centering of text within a container
 * @param {Object} container 
 * @param {Object} textNode 
 * @returns {Object} { horizontal: 0-1, vertical: 0-1 }
 */
export const calculateAlignment = (container, textNode) => {
  if (!container.bounds || !textNode.bounds) return { horizontal: 0, vertical: 0 };
  
  const c = container.bounds;
  const t = textNode.bounds;
  
  const containerCenterX = c.x + c.width / 2;
  const containerCenterY = c.y + c.height / 2;
  
  const textCenterX = t.x + t.width / 2;
  const textCenterY = t.y + t.height / 2;
  
  // Normalized offset from center (0 = perfectly centered, 1 = at edge)
  const offsetX = Math.abs(containerCenterX - textCenterX) / (c.width / 2);
  const offsetY = Math.abs(containerCenterY - textCenterY) / (c.height / 2);
  
  return {
    horizontal: 1 - Math.min(1, offsetX),
    vertical: 1 - Math.min(1, offsetY),
  };
};

/**
 * Find first child of a certain type
 */
export const findChildByType = (node, type) => {
  if (!node.children) return null;
  return node.children.find(c => c.type === type);
};

/**
 * Find all children of a certain type
 */
export const findChildrenByType = (node, type) => {
  if (!node.children) return [];
  return node.children.filter(c => c.type === type);
};

/**
 * Check if node has a fill color
 */
export const hasBackground = (node) => {
  return node.styles?.colors && node.styles.colors.length > 0;
};

/**
 * Check if node has rounded corners
 */
export const hasRoundedCorners = (node) => {
  return node.styles?.borderRadius && (node.styles.borderRadius.all > 0 || Object.values(node.styles.borderRadius).some(v => v > 0));
};

/**
 * Node Filtering Utilities
 * Identifies and filters out decorative/noise nodes
 */

/**
 * Check if a node is decorative (background, separator, or visual wrapper)
 * @param {Object} node - Figma node
 * @returns {boolean} True if node should be filtered out
 */
export const isDecorativeNode = (node) => {
  // Nodes with visible image fills are visual assets, not decorative noise
  if (node.fills && Array.isArray(node.fills) && node.fills.some(f => f.type === 'IMAGE' && f.visible !== false)) {
    return false;
  }

  // Filter rectangles with no semantic value
  if (node.type === 'RECTANGLE') {
    const hasNoChildren = !node.children || node.children.length === 0;
    const hasNoText = !node.characters;
    const isVerySmall = isSmallDimension(node);
    const isInvisible = node.visible === false || (node.opacity !== undefined && node.opacity === 0);
    
    // Rectangle with no children, no text, very small, or invisible = decorative
    if (hasNoChildren && hasNoText) {
      return isVerySmall || isInvisible;
    }
  }

  // Filter empty groups/frames (no children, no meaningful content)
  if (['GROUP', 'FRAME', 'COMPONENT'].includes(node.type)) {
    const hasNoChildren = !node.children || node.children.length === 0;
    const hasNoText = !node.characters;
    
    // Empty container with no text content
    if (hasNoChildren && hasNoText) {
      return true;
    }
  }

  // Filter invisible nodes
  if (node.visible === false) {
    return true;
  }

  // Filter fully transparent nodes
  if (node.opacity !== undefined && node.opacity === 0) {
    return true;
  }

  return false;
};

/**
 * Check if node has very small dimensions
 * Considers nodes < 5px x 5px as decorative
 * @param {Object} node - Figma node
 * @returns {boolean}
 */
const isSmallDimension = (node) => {
  const MIN_SIZE = 5;
  
  if (node.absoluteBoundingBox) {
    const { width, height } = node.absoluteBoundingBox;
    return width < MIN_SIZE && height < MIN_SIZE;
  }
  
  return false;
};

/**
 * Check if node is a separator/divider
 * @param {Object} node - Figma node
 * @returns {boolean}
 */
export const isSeparator = (node) => {
  if (node.type === 'RECTANGLE') {
    const box = node.absoluteBoundingBox;
    if (!box) return false;

    const isHorizontalLine = box.height < 5 && box.width > 20;
    const isVerticalLine = box.width < 5 && box.height > 20;
    
    return isHorizontalLine || isVerticalLine;
  }
  
  return false;
};

/**
 * Check if node should be included in the tree
 * @param {Object} node - Figma node
 * @param {Object} options - Filtering options
 * @returns {boolean}
 */
export const shouldIncludeNode = (node, options = {}) => {
  const {
    includeSeparators = false,
    includeDecorative = false,
  } = options;

  // Always exclude if not a supported type
  if (!isSupportedNodeType(node.type)) {
    return false;
  }

  // Check decorative
  if (!includeDecorative && isDecorativeNode(node)) {
    return false;
  }

  // Check separators
  if (!includeSeparators && isSeparator(node)) {
    return false;
  }

  return true;
};

/**
 * Check if node type is supported
 * @param {string} type - Node type
 * @returns {boolean}
 */
export const isSupportedNodeType = (type) => {
  const supported = [
    'FRAME',
    'GROUP',
    'TEXT',
    'RECTANGLE',
    'ELLIPSE',
    'VECTOR',
    'STAR',
    'LINE',
    'POLYGON',
    'COMPONENT',
    'INSTANCE',
    'COMPONENT_SET',
    'BOOLEAN_OPERATION',
    'CANVAS',
  ];
  return supported.includes(type);
};

/**
 * Filter node's children recursively
 * @param {Object[]} children - Array of child nodes
 * @param {Object} options - Filtering options
 * @returns {Object[]} Filtered children
 */
export const filterChildren = (children, options = {}) => {
  if (!Array.isArray(children)) return [];
  
  return children
    .filter(child => shouldIncludeNode(child, options))
    .map(child => {
      // Recursively filter nested children
      if (child.children && child.children.length > 0) {
        child.children = filterChildren(child.children, options);
      }
      return child;
    });
};

/**
 * Layout Extraction Utilities
 * Extract and normalize Figma auto-layout properties
 */

/**
 * Extract comprehensive layout properties from a node
 * @param {Object} node - Figma node
 * @returns {Object|null} Normalized layout object
 */
export const extractLayout = (node) => {
  if (!node.layoutMode) return null;

  const layout = {};

  // Layout mode (flex direction)
  layout.mode = normalizeLayoutMode(node.layoutMode);

  // Primary axis alignment (justify-content equivalent)
  if (node.primaryAxisAlignItems) {
    layout.justifyContent = normalizeAlignItems(node.primaryAxisAlignItems);
  }

  // Counter axis alignment (align-items equivalent)
  if (node.counterAxisAlignItems) {
    layout.alignItems = normalizeAlignItems(node.counterAxisAlignItems);
  }

  // Item spacing (gap in flexbox)
  if (node.itemSpacing !== undefined) {
    layout.gap = node.itemSpacing;
  }

  // Padding
  const padding = extractLayoutPadding(node);
  if (padding) {
    layout.padding = padding;
  }

  // Wrap content
  if (node.layoutWrap) {
    layout.wrap = normalizeWrap(node.layoutWrap);
  }

  // Primary axis size mode
  if (node.primaryAxisSizingMode) {
    layout.primaryAxisSize = normalizeSizingMode(node.primaryAxisSizingMode);
  }

  // Counter axis size mode
  if (node.counterAxisSizingMode) {
    layout.counterAxisSize = normalizeSizingMode(node.counterAxisSizingMode);
  }

  return Object.keys(layout).length > 0 ? layout : null;
};

/**
 * Extract padding from layout node
 * @param {Object} node - Figma node
 * @returns {Object|null}
 */
const extractLayoutPadding = (node) => {
  const padding = {};

  if (node.paddingLeft !== undefined) padding.left = node.paddingLeft;
  if (node.paddingRight !== undefined) padding.right = node.paddingRight;
  if (node.paddingTop !== undefined) padding.top = node.paddingTop;
  if (node.paddingBottom !== undefined) padding.bottom = node.paddingBottom;

  // Simplify if all sides equal
  if (
    padding.left === padding.right &&
    padding.top === padding.bottom &&
    padding.left === padding.top &&
    padding.left !== undefined
  ) {
    return { all: padding.left };
  }

  return Object.keys(padding).length > 0 ? padding : null;
};

/**
 * Normalize layout mode to semantic names
 * @param {string} mode - Figma layout mode
 * @returns {string}
 */
const normalizeLayoutMode = (mode) => {
  const modeMap = {
    'HORIZONTAL': 'row',
    'VERTICAL': 'column',
  };
  return modeMap[mode] || mode.toLowerCase();
};

/**
 * Normalize alignment values
 * @param {string} align - Figma alignment
 * @returns {string}
 */
const normalizeAlignItems = (align) => {
  const alignMap = {
    'MIN': 'flex-start',
    'CENTER': 'center',
    'MAX': 'flex-end',
    'SPACE_BETWEEN': 'space-between',
    'SPACE_AROUND': 'space-around',
    'SPACE_EVENLY': 'space-evenly',
    'BASELINE': 'baseline',
    'STRETCH': 'stretch',
  };
  return alignMap[align] || align.toLowerCase();
};

/**
 * Normalize wrap mode
 * @param {string} wrap - Figma wrap mode
 * @returns {string}
 */
const normalizeWrap = (wrap) => {
  const wrapMap = {
    'NO_WRAP': 'nowrap',
    'WRAP': 'wrap',
  };
  return wrapMap[wrap] || wrap.toLowerCase();
};

/**
 * Normalize sizing mode
 * @param {string} mode - Figma sizing mode
 * @returns {string}
 */
const normalizeSizingMode = (mode) => {
  const modeMap = {
    'FIXED': 'fixed',
    'AUTO': 'auto',
    'FILL': 'fill',
  };
  return modeMap[mode] || mode.toLowerCase();
};

/**
 * Get responsive breakpoint info from layout
 * @param {Object} node - Figma node
 * @returns {Object|null}
 */
export const extractResponsiveInfo = (node) => {
  if (!node.layoutMode) return null;

  const responsive = {};

  // Check if node uses fill for sizing (responsive)
  if (node.primaryAxisSizingMode === 'FILL') {
    responsive.fillsWidth = true;
  }

  if (node.counterAxisSizingMode === 'FILL') {
    responsive.fillsHeight = true;
  }

  // Check if wrapped (mobile-like behavior)
  if (node.layoutWrap === 'WRAP') {
    responsive.canWrap = true;
  }

  return Object.keys(responsive).length > 0 ? responsive : null;
};

/**
 * Map layout to Tailwind classes
 * @param {Object} layout - Normalized layout object
 * @returns {Array<string>} Tailwind class names
 */
export const layoutToTailwind = (layout) => {
  if (!layout) return [];

  const classes = [];

  // Flex direction
  if (layout.mode === 'row') classes.push('flex-row');
  if (layout.mode === 'column') classes.push('flex-col');

  // Justify content
  if (layout.justifyContent) {
    const justifyMap = {
      'flex-start': 'justify-start',
      'center': 'justify-center',
      'flex-end': 'justify-end',
      'space-between': 'justify-between',
      'space-around': 'justify-around',
      'space-evenly': 'justify-evenly',
    };
    if (justifyMap[layout.justifyContent]) {
      classes.push(justifyMap[layout.justifyContent]);
    }
  }

  // Align items
  if (layout.alignItems) {
    const alignMap = {
      'flex-start': 'items-start',
      'center': 'items-center',
      'flex-end': 'items-end',
      'baseline': 'items-baseline',
      'stretch': 'items-stretch',
    };
    if (alignMap[layout.alignItems]) {
      classes.push(alignMap[layout.alignItems]);
    }
  }

  // Gap
  if (layout.gap) {
    const gapValue = Math.round(layout.gap / 4); // Approximate tailwind scale
    classes.push(`gap-${gapValue}`);
  }

  // Padding
  if (layout.padding) {
    if (layout.padding.all) {
      const padValue = Math.round(layout.padding.all / 4);
      classes.push(`p-${padValue}`);
    } else {
      if (layout.padding.left) {
        const val = Math.round(layout.padding.left / 4);
        classes.push(`pl-${val}`);
      }
      if (layout.padding.right) {
        const val = Math.round(layout.padding.right / 4);
        classes.push(`pr-${val}`);
      }
      if (layout.padding.top) {
        const val = Math.round(layout.padding.top / 4);
        classes.push(`pt-${val}`);
      }
      if (layout.padding.bottom) {
        const val = Math.round(layout.padding.bottom / 4);
        classes.push(`pb-${val}`);
      }
    }
  }

  // Wrap
  if (layout.wrap === 'wrap') classes.push('flex-wrap');

  return classes;
};

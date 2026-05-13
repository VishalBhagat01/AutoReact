/**
 * Style Extraction Utilities
 * Extracts and normalizes CSS/design styles from Figma nodes
 */

/**
 * Extract all style properties from a Figma node
 * @param {Object} node - Figma node
 * @returns {Object} Normalized styles object
 */
export const extractStyles = (node) => {
  const styles = {};

  // Colors/Background
  const colors = extractColors(node);
  if (colors.length > 0) {
    styles.colors = colors;
  }

  // Stroke/Border
  const stroke = extractStroke(node);
  if (stroke) {
    styles.stroke = stroke;
  }

  // Typography
  const typography = extractTypography(node);
  if (typography && Object.keys(typography).length > 0) {
    styles.typography = typography;
  }

  // Spacing (Padding + ItemSpacing)
  const spacing = extractSpacing(node);
  if (spacing && Object.keys(spacing).length > 0) {
    styles.spacing = spacing;
  }

  // Border Radius
  const borderRadius = extractBorderRadius(node);
  if (borderRadius) {
    styles.borderRadius = borderRadius;
  }

  // Shadow/Effects
  const effects = extractEffects(node);
  if (effects.length > 0) {
    styles.effects = effects;
  }

  // Opacity
  if (node.opacity !== undefined && node.opacity !== 1) {
    styles.opacity = Math.round(node.opacity * 100);
  }

  // Blend Mode
  if (node.blendMode) {
    styles.blendMode = normalizeBlendMode(node.blendMode);
  }

  return Object.keys(styles).length > 0 ? styles : null;
};

/**
 * Extract color fills from node
 * @param {Object} node - Figma node
 * @returns {Array} Array of color objects
 */
const extractColors = (node) => {
  if (!node.fills || node.fills.length === 0) return [];

  return node.fills
    .filter(fill => fill.type === 'SOLID' && fill.visible !== false)
    .map(fill => {
      const color = fill.color;
      return {
        type: 'SOLID',
        hex: rgbToHex(color.r, color.g, color.b),
        rgba: `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${color.a || 1})`,
        opacity: color.a || 1,
      };
    });
};

/**
 * Extract stroke/border properties
 * @param {Object} node - Figma node
 * @returns {Object|null}
 */
const extractStroke = (node) => {
  if (!node.strokes || node.strokes.length === 0) return null;

  const stroke = node.strokes[0];
  if (stroke.type !== 'SOLID') return null;

  return {
    color: rgbToHex(stroke.color.r, stroke.color.g, stroke.color.b),
    width: node.strokeWeight || 1,
    align: normalizeStrokeAlign(node.strokeAlign),
  };
};

/**
 * Extract typography/text styles
 * @param {Object} node - Figma node
 * @returns {Object}
 */
const extractTypography = (node) => {
  const styles = {};

  if (node.style) {
    if (node.style.fontSize) {
      styles.fontSize = node.style.fontSize;
    }
    if (node.style.fontFamily) {
      styles.fontFamily = node.style.fontFamily;
    }
    if (node.style.fontWeight) {
      styles.fontWeight = node.style.fontWeight;
    }
    if (node.style.lineHeightPx) {
      styles.lineHeight = node.style.lineHeightPx;
    }
    if (node.style.letterSpacing) {
      styles.letterSpacing = node.style.letterSpacing;
    }
    if (node.style.textCase) {
      styles.textCase = normalizeTextCase(node.style.textCase);
    }
    if (node.style.textDecoration) {
      styles.textDecoration = normalizeTextDecoration(node.style.textDecoration);
    }
  }

  // Text alignment
  if (node.textAlignHorizontal) {
    styles.textAlign = normalizeTextAlign(node.textAlignHorizontal);
  }

  return styles;
};

/**
 * Extract spacing (padding and item spacing)
 * @param {Object} node - Figma node
 * @returns {Object}
 */
const extractSpacing = (node) => {
  const spacing = {};

  // Padding
  if (node.paddingLeft !== undefined) spacing.paddingLeft = node.paddingLeft;
  if (node.paddingRight !== undefined) spacing.paddingRight = node.paddingRight;
  if (node.paddingTop !== undefined) spacing.paddingTop = node.paddingTop;
  if (node.paddingBottom !== undefined) spacing.paddingBottom = node.paddingBottom;

  // Simplify padding if all sides are equal
  if (
    spacing.paddingLeft === spacing.paddingRight &&
    spacing.paddingTop === spacing.paddingBottom &&
    spacing.paddingLeft === spacing.paddingTop
  ) {
    spacing.padding = spacing.paddingLeft;
    delete spacing.paddingLeft;
    delete spacing.paddingRight;
    delete spacing.paddingTop;
    delete spacing.paddingBottom;
  }

  // Item spacing (gap in flexbox)
  if (node.itemSpacing !== undefined) {
    spacing.gap = node.itemSpacing;
  }

  return spacing;
};

/**
 * Extract border radius
 * @param {Object} node - Figma node
 * @returns {Object|null}
 */
const extractBorderRadius = (node) => {
  if (node.cornerRadius) {
    return {
      all: node.cornerRadius,
    };
  }

  const radius = {};
  if (node.topLeftRadius) radius.topLeft = node.topLeftRadius;
  if (node.topRightRadius) radius.topRight = node.topRightRadius;
  if (node.bottomLeftRadius) radius.bottomLeft = node.bottomLeftRadius;
  if (node.bottomRightRadius) radius.bottomRight = node.bottomRightRadius;

  return Object.keys(radius).length > 0 ? radius : null;
};

/**
 * Extract effects (shadows, blur, etc)
 * @param {Object} node - Figma node
 * @returns {Array}
 */
const extractEffects = (node) => {
  const effects = [];

  if (!node.effects || node.effects.length === 0) return effects;

  node.effects.forEach(effect => {
    if (!effect.visible) return;

    if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
      effects.push({
        type: effect.type === 'DROP_SHADOW' ? 'shadow' : 'innerShadow',
        offsetX: effect.offset?.x || 0,
        offsetY: effect.offset?.y || 0,
        blur: effect.radius || 0,
        spread: effect.spread || 0,
        color: effect.color ? rgbToHex(effect.color.r, effect.color.g, effect.color.b) : '#000000',
        opacity: effect.color?.a || 1,
      });
    } else if (effect.type === 'BLUR') {
      effects.push({
        type: 'blur',
        radius: effect.radius || 0,
      });
    }
  });

  return effects;
};

/**
 * Convert RGB to HEX color
 * @param {number} r - Red (0-1)
 * @param {number} g - Green (0-1)
 * @param {number} b - Blue (0-1)
 * @returns {string} HEX color string
 */
const rgbToHex = (r, g, b) => {
  const toHex = (n) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

/**
 * Normalize stroke alignment
 * @param {string} align - Figma stroke align
 * @returns {string}
 */
const normalizeStrokeAlign = (align) => {
  const alignMap = {
    'INSIDE': 'inside',
    'OUTSIDE': 'outside',
    'CENTER': 'center',
  };
  return alignMap[align] || align;
};

/**
 * Normalize blend mode
 * @param {string} mode - Figma blend mode
 * @returns {string}
 */
const normalizeBlendMode = (mode) => {
  const modeMap = {
    'PASS_THROUGH': 'pass-through',
    'MULTIPLY': 'multiply',
    'SCREEN': 'screen',
    'OVERLAY': 'overlay',
    'DARKEN': 'darken',
    'LIGHTEN': 'lighten',
    'COLOR_DODGE': 'color-dodge',
    'COLOR_BURN': 'color-burn',
    'HARD_LIGHT': 'hard-light',
    'SOFT_LIGHT': 'soft-light',
    'DIFFERENCE': 'difference',
    'EXCLUSION': 'exclusion',
    'HUE': 'hue',
    'SATURATION': 'saturation',
    'COLOR': 'color',
    'LUMINOSITY': 'luminosity',
  };
  return modeMap[mode] || mode.toLowerCase();
};

/**
 * Normalize text alignment
 * @param {string} align - Figma text align
 * @returns {string}
 */
const normalizeTextAlign = (align) => {
  const alignMap = {
    'LEFT': 'left',
    'CENTER': 'center',
    'RIGHT': 'right',
    'JUSTIFIED': 'justify',
  };
  return alignMap[align] || align.toLowerCase();
};

/**
 * Normalize text case
 * @param {string} textCase - Figma text case
 * @returns {string}
 */
const normalizeTextCase = (textCase) => {
  const caseMap = {
    'UPPER': 'uppercase',
    'LOWER': 'lowercase',
    'TITLE': 'capitalize',
    'SMALL_CAPS': 'small-caps',
    'SMALL_CAPS_FORCED': 'all-small-caps',
  };
  return caseMap[textCase] || textCase.toLowerCase();
};

/**
 * Normalize text decoration
 * @param {string} decoration - Figma text decoration
 * @returns {string}
 */
const normalizeTextDecoration = (decoration) => {
  const decorationMap = {
    'UNDERLINE': 'underline',
    'STRIKETHROUGH': 'line-through',
  };
  return decorationMap[decoration] || decoration.toLowerCase();
};

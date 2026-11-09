/**
 * Design Token Extraction Engine
 * Extracts unified, reusable design tokens (Colors, Typography, Spacing, Radii, Shadows)
 * from Design IR nodes.
 */

/**
 * Check if a hex color is roughly neutral / grayscale (black, white, grays)
 * @param {string} hex - #RRGGBB
 * @returns {boolean}
 */
const isGrayscale = (hex) => {
  if (!hex || typeof hex !== 'string') return true;
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return true;

  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  // Near black (luminance < 45) or near white (min > 240)
  if (max < 45 || min > 240) return true;

  const diff = max - min;
  return diff < 28;
};

/**
 * Extract canonical design tokens from pages or nodes
 * @param {Array<Object>|Object} input - Array of pages or root node
 * @returns {Object} Unified Design Tokens
 */
export const extractDesignTokens = (input) => {
  const colorMap = new Map(); // hex -> { hex, rgba, count, roles: Set }
  const fontFamilies = new Set();
  const fontSizes = new Set();
  const fontWeights = new Set();
  const lineHeights = new Set();
  const typographyStyles = new Map();
  const spacingValues = new Set();
  const radiiValues = new Set();
  const shadowList = [];
  const seenShadowKeys = new Set();

  let pageBackground = null;

  const traverse = (node, isTopLevel = false) => {
    if (!node || typeof node !== 'object') return;

    // 1. Color extraction
    // From fills
    if (Array.isArray(node.fills)) {
      for (const fill of node.fills) {
        if (fill?.hex) {
          const hex = fill.hex.toUpperCase();
          const role = node.type === 'TEXT' ? 'text' : isTopLevel ? 'background' : 'fill';
          if (isTopLevel && !pageBackground) pageBackground = hex;

          if (!colorMap.has(hex)) {
            colorMap.set(hex, {
              hex,
              rgba: fill.rgba || hex,
              count: 0,
              roles: new Set(),
            });
          }
          const item = colorMap.get(hex);
          item.count++;
          item.roles.add(role);
        }
      }
    }

    // From styles.colors
    if (Array.isArray(node.styles?.colors)) {
      for (const c of node.styles.colors) {
        if (c?.hex) {
          const hex = c.hex.toUpperCase();
          const role = node.type === 'TEXT' ? 'text' : 'fill';
          if (!colorMap.has(hex)) {
            colorMap.set(hex, {
              hex,
              rgba: c.rgba || hex,
              count: 0,
              roles: new Set(),
            });
          }
          const item = colorMap.get(hex);
          item.count++;
          item.roles.add(role);
        }
      }
    }

    // From stroke
    if (node.strokes?.color || node.styles?.stroke?.color) {
      const strokeColor = (node.strokes?.color || node.styles?.stroke?.color).toUpperCase();
      if (!colorMap.has(strokeColor)) {
        colorMap.set(strokeColor, {
          hex: strokeColor,
          rgba: strokeColor,
          count: 0,
          roles: new Set(),
        });
      }
      const item = colorMap.get(strokeColor);
      item.count++;
      item.roles.add('border');
    }

    // 2. Typography extraction
    const typo = node.typography || node.styles?.typography;
    if (typo) {
      if (typo.fontFamily) fontFamilies.add(typo.fontFamily);
      if (typeof typo.fontSize === 'number' && typo.fontSize > 0) fontSizes.add(typo.fontSize);
      if (typo.fontWeight) fontWeights.add(Number(typo.fontWeight) || typo.fontWeight);
      if (typeof typo.lineHeight === 'number' && typo.lineHeight > 0) {
        lineHeights.add(Math.round(typo.lineHeight));
      }

      if (typo.fontSize && typo.fontFamily) {
        const key = `${typo.fontFamily}_${typo.fontSize}_${typo.fontWeight || 400}`;
        if (!typographyStyles.has(key)) {
          typographyStyles.set(key, {
            fontFamily: typo.fontFamily,
            fontSize: typo.fontSize,
            fontWeight: Number(typo.fontWeight) || 400,
            lineHeight: typo.lineHeight ? Math.round(typo.lineHeight) : null,
            letterSpacing: typo.letterSpacing || null,
            textCase: typo.textCase || 'none',
          });
        }
      }
    }

    // 3. Spacing extraction
    const layout = node.layout || {};
    if (typeof layout.gap === 'number' && layout.gap > 0) {
      spacingValues.add(Math.round(layout.gap));
    }
    const pad = layout.padding || node.styles?.spacing;
    if (pad) {
      if (typeof pad.top === 'number' && pad.top > 0) spacingValues.add(Math.round(pad.top));
      if (typeof pad.bottom === 'number' && pad.bottom > 0) spacingValues.add(Math.round(pad.bottom));
      if (typeof pad.left === 'number' && pad.left > 0) spacingValues.add(Math.round(pad.left));
      if (typeof pad.right === 'number' && pad.right > 0) spacingValues.add(Math.round(pad.right));
      if (typeof pad.padding === 'number' && pad.padding > 0) spacingValues.add(Math.round(pad.padding));
    }

    // 4. Radii extraction
    const radius = node.styles?.borderRadius || node.borderRadius || node.cornerRadius;
    if (typeof radius === 'number' && radius > 0) {
      radiiValues.add(radius);
    } else if (typeof radius === 'object' && radius !== null) {
      if (typeof radius.all === 'number' && radius.all > 0) radiiValues.add(radius.all);
      if (typeof radius.topLeft === 'number' && radius.topLeft > 0) radiiValues.add(radius.topLeft);
      if (typeof radius.topRight === 'number' && radius.topRight > 0) radiiValues.add(radius.topRight);
      if (typeof radius.bottomLeft === 'number' && radius.bottomLeft > 0) radiiValues.add(radius.bottomLeft);
      if (typeof radius.bottomRight === 'number' && radius.bottomRight > 0) radiiValues.add(radius.bottomRight);
    }

    // 5. Shadows / Effects
    const effects = Array.isArray(node.effects) ? node.effects : node.styles?.effects;
    if (Array.isArray(effects)) {
      for (const eff of effects) {
        if (eff.type === 'DROP_SHADOW' || eff.type === 'shadow' || eff.type === 'INNER_SHADOW') {
          const shadowKey = `${eff.type}_${eff.offsetX}_${eff.offsetY}_${eff.blur}_${eff.spread}_${eff.color}`;
          if (!seenShadowKeys.has(shadowKey)) {
            seenShadowKeys.add(shadowKey);
            shadowList.push({
              type: eff.type === 'INNER_SHADOW' ? 'innerShadow' : 'dropShadow',
              offsetX: eff.offsetX || 0,
              offsetY: eff.offsetY || 0,
              blur: eff.blur || 0,
              spread: eff.spread || 0,
              color: eff.color || '#000000',
              opacity: typeof eff.opacity === 'number' ? eff.opacity : 1,
            });
          }
        }
      }
    }

    // Children
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child, false);
      }
    }
  };

  if (Array.isArray(input)) {
    for (const item of input) {
      traverse(item, true);
    }
  } else {
    traverse(input, true);
  }

  // Format Colors
  const rawColors = Array.from(colorMap.values())
    .map(c => ({
      hex: c.hex,
      rgba: c.rgba,
      count: c.count,
      roles: Array.from(c.roles),
    }))
    .sort((a, b) => b.count - a.count);

  // Semantic color role mapping
  let primaryColor = null;
  let textColor = null;
  let borderColor = null;
  let surfaceColor = null;

  for (const c of rawColors) {
    if (!primaryColor && !isGrayscale(c.hex)) {
      primaryColor = c.hex;
    }
    if (!textColor && c.roles.includes('text')) {
      textColor = c.hex;
    }
    if (!borderColor && c.roles.includes('border')) {
      borderColor = c.hex;
    }
    if (!surfaceColor && c.roles.includes('fill') && isGrayscale(c.hex)) {
      surfaceColor = c.hex;
    }
  }

  const paletteMap = {};
  rawColors.forEach((c, idx) => {
    paletteMap[`color_${idx + 1}`] = c;
  });

  return {
    colors: {
      palette: paletteMap,
      semantic: {
        primary: primaryColor || (rawColors[0]?.hex || '#3B82F6'),
        background: pageBackground || '#FFFFFF',
        surface: surfaceColor || '#F9FAFB',
        text: textColor || '#111827',
        border: borderColor || '#E5E7EB',
      },
      raw: rawColors,
    },
    typography: {
      fontFamilies: Array.from(fontFamilies).sort(),
      fontSizes: Array.from(fontSizes).sort((a, b) => a - b),
      fontWeights: Array.from(fontWeights).sort((a, b) => a - b),
      lineHeights: Array.from(lineHeights).sort((a, b) => a - b),
      styles: Object.fromEntries(typographyStyles.entries()),
    },
    spacing: Array.from(spacingValues).sort((a, b) => a - b),
    radii: Array.from(radiiValues).sort((a, b) => a - b),
    shadows: shadowList,
    other: {},
  };
};

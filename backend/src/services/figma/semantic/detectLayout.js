import { LayoutTypes } from './constants.js';

/**
 * Layout Detector
 * Analyzes child positions to determine layout pattern
 */
export const detectLayout = (node) => {
  if (!node.children || node.children.length < 2) return null;

  // Use Figma's own layout mode if available
  if (node.layout?.mode) {
    return node.layout.mode === 'row' ? LayoutTypes.HORIZONTAL : LayoutTypes.VERTICAL;
  }

  // Fallback to geometry analysis
  const children = node.children.filter(c => c.bounds);
  if (children.length < 2) return null;

  // Check for horizontal alignment
  const yCoords = children.map(c => c.bounds.y);
  const yVariance = Math.max(...yCoords) - Math.min(...yCoords);
  const isHorizontal = yVariance < 20;

  // Check for vertical alignment
  const xCoords = children.map(c => c.bounds.x);
  const xVariance = Math.max(...xCoords) - Math.min(...xCoords);
  const isVertical = xVariance < 20;

  if (isHorizontal) return LayoutTypes.HORIZONTAL;
  if (isVertical) return LayoutTypes.VERTICAL;

  return LayoutTypes.STACK;
};

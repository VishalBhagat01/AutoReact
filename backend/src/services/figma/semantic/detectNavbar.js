import { SemanticTypes } from './constants.js';
import { calculateConfidence } from './confidenceScoring.js';

/**
 * Navbar Detector
 * Logic:
 * - Top of the page (y < 100)
 * - Wide aspect ratio (full width)
 * - Horizontal layout
 * - Repeated links or buttons
 */
export const detectNavbar = (node) => {
  if (!['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT'].includes(node.type)) {
    return null;
  }

  const rules = [];

  // Rule 1: Position
  const posScore = (node.bounds?.y < 100) ? 1 : 0.2;
  rules.push({ name: 'Top Positioning', score: posScore, weight: 2.0 });

  // Rule 2: Shape
  const widthScore = (node.bounds?.width > 800) ? 1 : 0.5;
  rules.push({ name: 'Full Width', score: widthScore, weight: 1.5 });

  // Rule 3: Layout
  const layoutScore = (node.layout?.mode === 'row') ? 1 : 0.6;
  rules.push({ name: 'Horizontal Layout', score: layoutScore, weight: 1.5 });

  // Rule 4: Naming
  const nameScore = /nav|menu|header|topbar|navigation/i.test(node.name) ? 1 : 0;
  rules.push({ name: 'Name Match', score: nameScore, weight: 1.5 });

  const confidence = calculateConfidence(rules);

  if (confidence > 0.7) {
    return {
      semanticType: SemanticTypes.NAVBAR,
      confidence,
      reasoning: rules.filter(r => r.score > 0.5).map(r => r.name),
    };
  }

  return null;
};

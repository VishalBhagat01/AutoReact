import { SemanticTypes } from './constants.js';
import { hasBackground, hasRoundedCorners } from './semanticHelpers.js';
import { calculateConfidence } from './confidenceScoring.js';

/**
 * Card Detector
 * Logic:
 * - FRAME or GROUP
 * - Background fill
 * - Rounded corners
 * - Shadow effects
 * - Multiple varied children
 */
export const detectCard = (node) => {
  if (!['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT'].includes(node.type)) {
    return null;
  }

  const rules = [];

  // Rule 1: Visual Container
  const bgScore = hasBackground(node) ? 1 : 0.5;
  rules.push({ name: 'Has Background', score: bgScore, weight: 1.5 });

  const radiusScore = hasRoundedCorners(node) ? 1 : 0.3;
  rules.push({ name: 'Rounded Corners', score: radiusScore, weight: 1.5 });

  const shadowScore = node.styles?.effects?.some(e => e.type === 'shadow') ? 1 : 0.4;
  rules.push({ name: 'Drop Shadow', score: shadowScore, weight: 1.0 });

  // Rule 2: Children Diversity
  const childTypes = new Set(node.children?.map(c => c.type) || []);
  const diversityScore = (childTypes.size >= 2) ? 1 : 0.4;
  rules.push({ name: 'Mixed Content', score: diversityScore, weight: 1.5 });

  // Rule 3: Naming
  const nameScore = /card|panel|tile|item|container|box/i.test(node.name) ? 1 : 0.4;
  rules.push({ name: 'Name Match', score: nameScore, weight: 1.2 });

  const confidence = calculateConfidence(rules);

  if (confidence > 0.65) {
    return {
      semanticType: SemanticTypes.CARD,
      confidence,
      reasoning: rules.filter(r => r.score > 0.5).map(r => r.name),
    };
  }

  return null;
};

import { SemanticTypes } from './constants.js';
import { calculateConfidence } from './confidenceScoring.js';

/**
 * Section Detector
 * Logic:
 * - Large Frame
 * - High up in hierarchy (child of Canvas or root Frame)
 * - Contains multiple complex components
 */
export const detectSection = (node) => {
  if (!['FRAME', 'GROUP'].includes(node.type)) {
    return null;
  }

  const rules = [];

  // Rule 1: Size
  const sizeScore = (node.bounds?.height > 200 && node.bounds?.width > 300) ? 1 : 0.3;
  rules.push({ name: 'Large Dimensions', score: sizeScore, weight: 2.0 });

  // Rule 2: Naming
  const nameScore = /section|hero|banner|footer|content|wrapper/i.test(node.name) ? 1 : 0.2;
  rules.push({ name: 'Name Match', score: nameScore, weight: 1.5 });

  // Rule 3: Child Count
  const childCount = node.children?.length || 0;
  const childScore = (childCount > 1) ? 0.8 : 0.2;
  rules.push({ name: 'Multiple Children', score: childScore, weight: 1.0 });

  const confidence = calculateConfidence(rules);

  if (confidence > 0.6) {
    return {
      semanticType: SemanticTypes.SECTION,
      confidence,
      reasoning: rules.filter(r => r.score > 0.5).map(r => r.name),
    };
  }

  return null;
};

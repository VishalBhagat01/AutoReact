import { SemanticTypes } from './constants.js';
import { calculateConfidence } from './confidenceScoring.js';

/**
 * Modal / Dialog Detector
 * Logic:
 * - Frame or Group
 * - Name matching modal/dialog/popup/overlay
 * - Prominent drop shadow effect
 * - Centered overlay dimensions
 */
export const detectModal = (node) => {
  if (!['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT'].includes(node.type)) {
    return null;
  }

  const rules = [];

  // Rule 1: Name match
  const nameScore = /modal|dialog|popup|alert|overlay|prompt/i.test(node.name) ? 1.0 : 0.0;
  rules.push({ name: 'Name Match', score: nameScore, weight: 2.0 });

  // Rule 2: Visual styling (shadows and rounded corners)
  const hasShadow = node.styles?.effects?.some(e => e.type === 'shadow' || e.type === 'DROP_SHADOW');
  const shadowScore = hasShadow ? 1.0 : 0.4;
  rules.push({ name: 'Drop Shadow', score: shadowScore, weight: 1.5 });

  // Rule 3: Dimensions (substantial box)
  if (node.bounds) {
    const { width, height } = node.bounds;
    const dimensionScore = (width >= 280 && width <= 900 && height >= 180 && height <= 800) ? 1.0 : 0.3;
    rules.push({ name: 'Modal Dimensions', score: dimensionScore, weight: 1.2 });
  }

  // Rule 4: Children composition (header/body/actions)
  const childCount = node.children?.length || 0;
  const childScore = (childCount >= 2 && childCount <= 10) ? 1.0 : 0.5;
  rules.push({ name: 'Composite Children', score: childScore, weight: 1.0 });

  const confidence = calculateConfidence(rules);

  if (confidence > 0.65) {
    return {
      semanticType: SemanticTypes.MODAL,
      confidence,
      reasoning: rules.filter(r => r.score > 0.5).map(r => r.name),
    };
  }

  return null;
};


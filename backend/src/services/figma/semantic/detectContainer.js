import { SemanticTypes } from './constants.js';
import { calculateConfidence } from './confidenceScoring.js';

/**
 * Container Detector
 * Logic:
 * - FRAME, GROUP, or RECTANGLE with children
 * - Used as a fallback or for generic layout wrappers
 */
export const detectContainer = (node) => {
  if (!['FRAME', 'GROUP', 'RECTANGLE', 'INSTANCE', 'COMPONENT'].includes(node.type)) {
    return null;
  }

  const rules = [];

  // Rule 1: Purpose
  const childScore = (node.children?.length > 0) ? 1 : 0.5;
  rules.push({ name: 'Contains Children', score: childScore, weight: 2.0 });

  // Rule 2: Naming
  const nameScore = /container|wrapper|group|frame|box|inner/i.test(node.name) ? 1 : 0.5;
  rules.push({ name: 'Name Match', score: nameScore, weight: 1.0 });

  const confidence = calculateConfidence(rules);

  return {
    semanticType: SemanticTypes.CONTAINER,
    confidence: Math.max(0.3, confidence),
    reasoning: rules.filter(r => r.score > 0.5).map(r => r.name),
  };
};

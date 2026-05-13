import { SemanticTypes } from './constants.js';
import { findChildByType, findChildrenByType } from './semanticHelpers.js';
import { calculateConfidence } from './confidenceScoring.js';

/**
 * Input Field Detector
 * Logic:
 * - Usually a RECTANGLE or FRAME with a stroke
 * - Contains optional placeholder text
 * - Wide aspect ratio
 */
export const detectInput = (node) => {
  if (!['RECTANGLE', 'FRAME', 'INSTANCE', 'COMPONENT'].includes(node.type)) {
    return null;
  }

  const rules = [];

  // Rule 1: Naming
  const nameScore = /input|field|text|search|email|password|value/i.test(node.name) ? 1 : 0;
  rules.push({ name: 'Name Match', score: nameScore, weight: 2.0 });

  // Rule 2: Visual (Stroke is common for inputs)
  const strokeScore = node.styles?.stroke ? 1 : 0.4;
  rules.push({ name: 'Has Border', score: strokeScore, weight: 1.5 });

  // Rule 3: Background (usually white or light)
  const bgScore = node.styles?.colors?.some(c => c.hex === '#FFFFFF') ? 1 : 0.5;
  rules.push({ name: 'Background Color', score: bgScore, weight: 0.8 });

  // Rule 4: Dimensions
  if (node.bounds) {
    const ratio = node.bounds.width / node.bounds.height;
    const ratioScore = (ratio > 3 && ratio < 15) ? 1 : 0.4;
    rules.push({ name: 'Aspect Ratio', score: ratioScore, weight: 1.2 });
    
    const heightScore = (node.bounds.height >= 30 && node.bounds.height <= 60) ? 1 : 0.3;
    rules.push({ name: 'Standard Height', score: heightScore, weight: 1.0 });
  }

  // Rule 5: Contains a single text node (placeholder/value)
  const textChildren = findChildrenByType(node, 'TEXT');
  const textScore = (textChildren.length === 1) ? 1 : (textChildren.length === 0 ? 0.5 : 0.2);
  rules.push({ name: 'Single Text Child', score: textScore, weight: 1.0 });

  const confidence = calculateConfidence(rules);

  if (confidence > 0.6) {
    return {
      semanticType: SemanticTypes.INPUT_FIELD,
      confidence,
      reasoning: rules.filter(r => r.score > 0.5).map(r => r.name),
    };
  }

  return null;
};

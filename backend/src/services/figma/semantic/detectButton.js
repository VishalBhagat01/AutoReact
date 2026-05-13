import { SemanticTypes } from './constants.js';
import { calculateAlignment, findChildByType, hasBackground } from './semanticHelpers.js';
import { calculateConfidence } from './confidenceScoring.js';

/**
 * Button Detector
 * Logic:
 * - Rectangular container (Frame/Group/Rectangle)
 * - Contains centered text
 * - Width > Height (usually)
 * - Clickable dimensions
 */
export const detectButton = (node) => {
  if (!['FRAME', 'GROUP', 'RECTANGLE', 'INSTANCE', 'COMPONENT'].includes(node.type)) {
    return null;
  }

  const textChild = findChildByType(node, 'TEXT');
  const rules = [];

  // Rule 1: Naming
  const nameScore = /button|submit|btn|action|cta/i.test(node.name) ? 1 : 0;
  rules.push({ name: 'Name Match', score: nameScore, weight: 2.0 });

  // Rule 2: Contains Text
  rules.push({ name: 'Contains Text', score: textChild ? 1 : 0, weight: 1.5 });

  if (textChild) {
    // Rule 3: Centering
    const alignment = calculateAlignment(node, textChild);
    const centerScore = (alignment.horizontal + alignment.vertical) / 2;
    rules.push({ name: 'Text Centering', score: centerScore, weight: 1.5 });

    // Rule 4: Button-like text
    const textContent = textChild.text || '';
    const textContentScore = /^[A-Z]|^[a-z]{1,15}$/.test(textContent) ? 0.8 : 0.5;
    rules.push({ name: 'Text Content', score: textContentScore, weight: 0.5 });
  }

  // Rule 5: Aspect Ratio
  if (node.bounds) {
    const ratio = node.bounds.width / node.bounds.height;
    const ratioScore = (ratio > 1.2 && ratio < 6) ? 1 : 0.3;
    rules.push({ name: 'Aspect Ratio', score: ratioScore, weight: 1.0 });
    
    // Rule 6: Absolute size
    const sizeScore = (node.bounds.height >= 24 && node.bounds.height <= 80) ? 1 : 0.2;
    rules.push({ name: 'Dimensions', score: sizeScore, weight: 1.0 });
  }

  // Rule 7: Has Background or Stroke
  const visualScore = (hasBackground(node) || node.styles?.stroke) ? 1 : 0;
  rules.push({ name: 'Visual Container', score: visualScore, weight: 1.2 });

  const confidence = calculateConfidence(rules);

  if (confidence > 0.6) {
    return {
      semanticType: SemanticTypes.BUTTON,
      confidence,
      reasoning: rules.filter(r => r.score > 0.5).map(r => r.name),
    };
  }

  return null;
};

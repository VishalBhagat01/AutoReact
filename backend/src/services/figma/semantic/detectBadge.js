import { SemanticTypes } from './constants.js';
import { calculateConfidence } from './confidenceScoring.js';
import { findChildByType, hasRoundedCorners } from './semanticHelpers.js';

/**
 * Badge / Chip Detector
 * Logic:
 * - Small container (height 16-36px)
 * - Contains short text child
 * - Rounded corners or pill shape
 * - Background fill or border
 */
export const detectBadge = (node) => {
  if (!['FRAME', 'GROUP', 'RECTANGLE', 'INSTANCE', 'COMPONENT'].includes(node.type)) {
    return null;
  }

  const rules = [];

  // Rule 1: Name Match
  const nameScore = /badge|chip|tag|pill|status|label/i.test(node.name) ? 1 : 0;
  rules.push({ name: 'Name Match', score: nameScore, weight: 1.8 });

  // Rule 2: Dimensions (compact height)
  if (node.bounds) {
    const { width, height } = node.bounds;
    const heightScore = (height >= 16 && height <= 36) ? 1 : (height <= 44 ? 0.5 : 0.1);
    rules.push({ name: 'Compact Height', score: heightScore, weight: 1.5 });

    const ratio = width / (height || 1);
    const ratioScore = (ratio >= 1.2 && ratio <= 6) ? 1 : 0.4;
    rules.push({ name: 'Badge Aspect Ratio', score: ratioScore, weight: 1.0 });
  }

  // Rule 3: Contains short text
  const textChild = findChildByType(node, 'TEXT');
  if (textChild) {
    const textLen = (textChild.text || textChild.characters || '').length;
    const textScore = (textLen > 0 && textLen <= 25) ? 1 : 0.4;
    rules.push({ name: 'Short Text Content', score: textScore, weight: 1.5 });
  } else {
    rules.push({ name: 'Contains Text', score: 0.2, weight: 1.0 });
  }

  // Rule 4: Rounded corners / pill styling
  const roundedScore = hasRoundedCorners(node) ? 1 : 0.3;
  rules.push({ name: 'Rounded Corners', score: roundedScore, weight: 1.2 });

  const confidence = calculateConfidence(rules);

  if (confidence > 0.6) {
    return {
      semanticType: SemanticTypes.BADGE,
      confidence,
      reasoning: rules.filter(r => r.score > 0.5).map(r => r.name),
    };
  }

  return null;
};


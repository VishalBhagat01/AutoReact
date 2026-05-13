import { SemanticTypes } from './constants.js';
import { calculateConfidence } from './confidenceScoring.js';

/**
 * Heading Detector
 * Logic:
 * - TEXT node
 * - Large font size
 * - Bold font weight
 */
export const detectHeading = (node) => {
  if (node.type !== 'TEXT') return null;

  const rules = [];
  const styles = node.styles?.typography || {};
  const fontSize = styles.fontSize || 0;
  const fontWeight = styles.fontWeight || 400;

  // Rule 1: Font Size
  let fontSizeScore = 0;
  if (fontSize >= 32) fontSizeScore = 1;
  else if (fontSize >= 24) fontSizeScore = 0.8;
  else if (fontSize >= 18) fontSizeScore = 0.6;
  rules.push({ name: 'Large Font Size', score: fontSizeScore, weight: 2.0 });

  // Rule 2: Font Weight
  let weightScore = 0;
  if (fontWeight >= 700) weightScore = 1; // Bold
  else if (fontWeight >= 600) weightScore = 0.8; // Semi-bold
  else if (fontWeight >= 500) weightScore = 0.5; // Medium
  rules.push({ name: 'Bold Weight', score: weightScore, weight: 1.5 });

  // Rule 3: Naming
  const nameScore = /h[1-6]|heading|title|header|caption/i.test(node.name) ? 1 : 0;
  rules.push({ name: 'Name Match', score: nameScore, weight: 1.0 });

  const confidence = calculateConfidence(rules);

  if (confidence > 0.6) {
    let semanticType = SemanticTypes.HEADING;
    if (fontSize >= 32) semanticType = SemanticTypes.HEADING_1;
    else if (fontSize >= 24) semanticType = SemanticTypes.HEADING_2;
    else if (fontSize >= 18) semanticType = SemanticTypes.HEADING_3;

    return {
      semanticType,
      confidence,
      reasoning: rules.filter(r => r.score > 0.5).map(r => r.name),
    };
  }

  return null;
};

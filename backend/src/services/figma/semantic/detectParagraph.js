import { SemanticTypes } from './constants.js';
import { calculateConfidence } from './confidenceScoring.js';

/**
 * Paragraph Detector
 * Logic:
 * - TEXT node
 * - Regular font size (12-16px)
 * - Multiple lines or long characters
 */
export const detectParagraph = (node) => {
  if (node.type !== 'TEXT') return null;

  const rules = [];
  const styles = node.styles?.typography || {};
  const fontSize = styles.fontSize || 0;
  const charCount = node.text?.length || 0;

  // Rule 1: Font Size (Normal range)
  const sizeScore = (fontSize >= 12 && fontSize <= 18) ? 1 : 0.4;
  rules.push({ name: 'Standard Body Font Size', score: sizeScore, weight: 1.5 });

  // Rule 2: Character length
  const lengthScore = (charCount > 50) ? 1 : (charCount > 20 ? 0.6 : 0.2);
  rules.push({ name: 'Text Length', score: lengthScore, weight: 2.0 });

  // Rule 3: Naming
  const nameScore = /paragraph|body|text|description|content/i.test(node.name) ? 0.8 : 0.4;
  rules.push({ name: 'Name Match', score: nameScore, weight: 1.0 });

  const confidence = calculateConfidence(rules);

  if (confidence > 0.5) {
    return {
      semanticType: SemanticTypes.PARAGRAPH,
      confidence,
      reasoning: rules.filter(r => r.score > 0.5).map(r => r.name),
    };
  }

  return null;
};

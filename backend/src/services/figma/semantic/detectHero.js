import { SemanticTypes } from './constants.js';
import { calculateConfidence } from './confidenceScoring.js';

/**
 * Hero Section Detector
 * Logic:
 * - Prominent top section
 * - Large dimensions (high width and height)
 * - Naming matching hero/banner/splash
 * - Contains heading text and CTA elements
 */
export const detectHero = (node) => {
  if (!['FRAME', 'GROUP', 'SECTION'].includes(node.type)) {
    return null;
  }

  const rules = [];

  // Rule 1: Name match
  const nameScore = /hero|banner|splash|landing|jumbotron/i.test(node.name) ? 1.0 : 0.0;
  rules.push({ name: 'Name Match', score: nameScore, weight: 2.0 });

  // Rule 2: Top positioning
  const posScore = (node.bounds?.y !== undefined && node.bounds.y <= 200) ? 1.0 : 0.4;
  rules.push({ name: 'Top Positioning', score: posScore, weight: 1.2 });

  // Rule 3: Large Dimensions
  if (node.bounds) {
    const { width, height } = node.bounds;
    const sizeScore = (width >= 600 && height >= 300) ? 1.0 : 0.3;
    rules.push({ name: 'Prominent Dimensions', score: sizeScore, weight: 1.5 });
  }

  // Rule 4: Children composition
  const hasText = node.children?.some(c => c.type === 'TEXT');
  const hasButtons = node.children?.some(c => /button|btn|cta/i.test(c.name) || c.semanticType === SemanticTypes.BUTTON);
  const compScore = (hasText && hasButtons) ? 1.0 : (hasText ? 0.7 : 0.3);
  rules.push({ name: 'Heading + CTA Content', score: compScore, weight: 1.5 });

  const confidence = calculateConfidence(rules);

  if (confidence > 0.65) {
    return {
      semanticType: SemanticTypes.HERO,
      confidence,
      reasoning: rules.filter(r => r.score > 0.5).map(r => r.name),
    };
  }

  return null;
};


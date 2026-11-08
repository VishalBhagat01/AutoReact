import { SemanticTypes } from './constants.js';
import { calculateConfidence } from './confidenceScoring.js';

/**
 * Avatar Detector
 * Logic:
 * - Square or circular shape (aspect ratio ~1:1)
 * - ELLIPSE or heavily rounded RECTANGLE/FRAME
 * - Size typically between 20px and 120px
 * - Often contains an image fill or user/profile naming
 */
export const detectAvatar = (node) => {
  if (!['ELLIPSE', 'RECTANGLE', 'FRAME', 'GROUP', 'INSTANCE', 'COMPONENT'].includes(node.type)) {
    return null;
  }

  const rules = [];

  // Rule 1: Name Match
  const nameScore = /avatar|profile|user.*pic|user.*img|user.*photo|author/i.test(node.name) ? 1 : 0;
  rules.push({ name: 'Name Match', score: nameScore, weight: 2.0 });

  // Rule 2: Shape (Circular / Ellipse or high corner radius)
  let shapeScore = 0.3;
  if (node.type === 'ELLIPSE') {
    shapeScore = 1.0;
  } else if (node.styles?.borderRadius?.all >= 16) {
    shapeScore = 0.9;
  }
  rules.push({ name: 'Circular/Pill Shape', score: shapeScore, weight: 1.5 });

  // Rule 3: Dimensions (Square aspect ratio, typical avatar size)
  if (node.bounds) {
    const { width, height } = node.bounds;
    const ratio = width / (height || 1);
    const aspectScore = (ratio >= 0.85 && ratio <= 1.15) ? 1.0 : 0.2;
    rules.push({ name: '1:1 Aspect Ratio', score: aspectScore, weight: 1.5 });

    const sizeScore = (width >= 20 && width <= 128 && height >= 20 && height <= 128) ? 1.0 : 0.4;
    rules.push({ name: 'Avatar Sizing', score: sizeScore, weight: 1.0 });
  }

  // Rule 4: Image fill
  const hasImageFill = node.styles?.colors?.some(c => c.type === 'IMAGE') ||
    node.children?.some(c => c.type === 'RECTANGLE' && c.styles?.colors?.some(fc => fc.type === 'IMAGE'));
  const imageScore = hasImageFill ? 1.0 : 0.4;
  rules.push({ name: 'Image Content', score: imageScore, weight: 1.2 });

  const confidence = calculateConfidence(rules);

  if (confidence > 0.6) {
    return {
      semanticType: SemanticTypes.AVATAR,
      confidence,
      reasoning: rules.filter(r => r.score > 0.5).map(r => r.name),
    };
  }

  return null;
};


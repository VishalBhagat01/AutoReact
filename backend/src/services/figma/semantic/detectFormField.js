import { SemanticTypes } from './constants.js';
import { calculateConfidence } from './confidenceScoring.js';

/**
 * Form Field Detector
 * Logic:
 * - A container (Frame/Group)
 * - Contains a Label (Text) and an Input (or node detected as input)
 * - Vertical or Horizontal arrangement
 */
export const detectFormField = (node, childSemantics = []) => {
  if (!['FRAME', 'GROUP'].includes(node.type)) {
    return null;
  }

  const rules = [];

  // Rule 1: Naming
  const nameScore = /form-field|field-group|input-container|form-item/i.test(node.name) ? 1 : 0;
  rules.push({ name: 'Name Match', score: nameScore, weight: 1.5 });

  // Rule 2: Children composition
  const hasInput = childSemantics.some(cs => cs.semanticType === SemanticTypes.INPUT_FIELD);
  const hasText = node.children?.some(c => c.type === 'TEXT');
  
  const compositionScore = (hasInput && hasText) ? 1 : 0.2;
  rules.push({ name: 'Label + Input Composition', score: compositionScore, weight: 2.5 });

  // Rule 3: Child count
  const childCountScore = (node.children?.length >= 2 && node.children?.length <= 4) ? 1 : 0.5;
  rules.push({ name: 'Optimal Child Count', score: childCountScore, weight: 1.0 });

  const confidence = calculateConfidence(rules);

  if (confidence > 0.7) {
    return {
      semanticType: SemanticTypes.FORM_FIELD,
      confidence,
      reasoning: rules.filter(r => r.score > 0.5).map(r => r.name),
    };
  }

  return null;
};

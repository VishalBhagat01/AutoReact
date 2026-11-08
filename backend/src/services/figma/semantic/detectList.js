import { SemanticTypes } from './constants.js';
import { calculateConfidence } from './confidenceScoring.js';

/**
 * List / Grid Detector
 * Logic:
 * - Container with >= 3 children
 * - Children have consistent node types or similar bounds
 * - Naming matching list/items/entries/table/grid
 */
export const detectList = (node) => {
  if (!['FRAME', 'GROUP'].includes(node.type) || !node.children || node.children.length < 3) {
    return null;
  }

  const rules = [];

  // Rule 1: Name match
  const nameScore = /list|items|entries|rows|table|grid|collection|cards/i.test(node.name) ? 1.0 : 0.3;
  rules.push({ name: 'Name Match', score: nameScore, weight: 1.5 });

  // Rule 2: Children Homogeneity
  const childTypes = node.children.map(c => c.type);
  const mostCommonTypeCount = Math.max(...Object.values(
    childTypes.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {})
  ));
  const homogeneityRatio = mostCommonTypeCount / node.children.length;
  const homogeneityScore = homogeneityRatio >= 0.7 ? 1.0 : (homogeneityRatio >= 0.5 ? 0.6 : 0.2);
  rules.push({ name: 'Homogeneous Children', score: homogeneityScore, weight: 2.0 });

  // Rule 3: Child Count
  const countScore = (node.children.length >= 3) ? 1.0 : 0.5;
  rules.push({ name: 'Multiple Repeat Items', score: countScore, weight: 1.0 });

  const confidence = calculateConfidence(rules);

  if (confidence > 0.6) {
    const isGrid = /grid|columns|gallery/i.test(node.name) || node.layoutPattern === 'grid';
    return {
      semanticType: isGrid ? SemanticTypes.GRID : SemanticTypes.LIST,
      confidence,
      reasoning: rules.filter(r => r.score > 0.5).map(r => r.name),
    };
  }

  return null;
};


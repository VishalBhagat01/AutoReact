/**
 * Confidence scoring utility
 * Aggregates multiple weighted rules into a single score
 */
export const calculateConfidence = (rules) => {
  const totalWeight = rules.reduce((sum, rule) => sum + rule.weight, 0);
  if (totalWeight === 0) return 0;
  
  const weightedSum = rules.reduce((sum, rule) => {
    return sum + (rule.score * rule.weight);
  }, 0);
  
  return parseFloat((weightedSum / totalWeight).toFixed(2));
};

/**
 * Common rules shared across detectors
 */
export const CommonRules = {
  NAME_MATCH: (name, pattern) => ({
    name: 'Name Pattern Match',
    score: pattern.test(name) ? 1 : 0,
    weight: 1.5,
  }),
  
  HAS_CHILDREN: (node, count = 1) => ({
    name: 'Has Required Children',
    score: (node.children && node.children.length >= count) ? 1 : 0,
    weight: 1.0,
  }),
  
  BOUNDS_RATIO: (bounds, minRatio, maxRatio) => {
    const ratio = bounds.width / bounds.height;
    const score = (ratio >= minRatio && ratio <= maxRatio) ? 1 : 0;
    return {
      name: 'Geometric Ratio',
      score,
      weight: 0.8,
    };
  }
};

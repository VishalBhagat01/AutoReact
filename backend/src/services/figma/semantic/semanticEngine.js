import { SemanticTypes } from './constants.js';
import { detectButton } from './detectButton.js';
import { detectInput } from './detectInput.js';
import { detectFormField } from './detectFormField.js';
import { detectHeading } from './detectHeading.js';
import { detectParagraph } from './detectParagraph.js';
import { detectCard } from './detectCard.js';
import { detectNavbar } from './detectNavbar.js';
import { detectSection } from './detectSection.js';
import { detectContainer } from './detectContainer.js';
import { detectLayout } from './detectLayout.js';

/**
 * Semantic Normalization Engine
 * Recursively analyzes a normalized node tree and applies semantic classification
 */
export const analyzeSemanticTree = (node) => {
  // 1. Process children first (bottom-up analysis for composite components like FormField)
  const processedChildren = (node.children || []).map(analyzeSemanticTree);

  // 2. Run detectors
  let semanticData = null;

  // Try specific detectors in order of specificity
  const detectors = [
    () => detectButton(node),
    () => detectInput(node),
    () => detectHeading(node),
    () => detectParagraph(node),
    () => detectNavbar(node),
    () => detectCard(node),
    () => detectSection(node),
    () => detectFormField(node, processedChildren),
  ];

  for (const detector of detectors) {
    const result = detector();
    if (result && (!semanticData || result.confidence > semanticData.confidence)) {
      semanticData = result;
    }
  }

  // 3. Fallback to generic container if no specific type found
  if (!semanticData && ['FRAME', 'GROUP', 'RECTANGLE', 'INSTANCE', 'COMPONENT'].includes(node.type)) {
    semanticData = detectContainer(node);
  }

  // 4. Default if still nothing
  if (!semanticData) {
    semanticData = {
      semanticType: SemanticTypes.GENERIC,
      confidence: 0.1,
      reasoning: ['Default fallback'],
    };
  }

  // 5. Detect layout pattern
  const layoutPattern = detectLayout(node);

  // 6. Construct enhanced node
  return {
    ...node,
    semanticType: semanticData.semanticType,
    confidence: semanticData.confidence,
    reasoning: semanticData.reasoning,
    layoutPattern: layoutPattern,
    children: processedChildren,
  };
};

import { SemanticTypes, semanticTypeToReactComponent } from './constants.js';
import { detectButton } from './detectButton.js';
import { detectInput } from './detectInput.js';
import { detectFormField } from './detectFormField.js';
import { detectHeading } from './detectHeading.js';
import { detectParagraph } from './detectParagraph.js';
import { detectCard } from './detectCard.js';
import { detectNavbar } from './detectNavbar.js';
import { detectHero } from './detectHero.js';
import { detectModal } from './detectModal.js';
import { detectBadge } from './detectBadge.js';
import { detectAvatar } from './detectAvatar.js';
import { detectList } from './detectList.js';
import { detectSection } from './detectSection.js';
import { detectContainer } from './detectContainer.js';
import { detectLayout } from './detectLayout.js';

/**
 * Semantic Normalization Engine
 * Recursively analyzes a normalized node tree and applies weighted semantic classification
 * @param {Object} node - Normalized node
 * @returns {Object} Semantically enhanced node
 */
export const analyzeSemanticTree = (node) => {
  if (!node) return null;

  // 1. Process children first (bottom-up analysis for composite components like FormField/List)
  const processedChildren = (node.children || []).map(analyzeSemanticTree).filter(Boolean);

  // 2. Run detectors in order of specificity
  let semanticData = null;

  const detectors = [
    // Highly specific interactive & text elements
    () => detectButton(node),
    () => detectInput(node),
    () => detectHeading(node),
    () => detectParagraph(node),
    () => detectBadge(node),
    () => detectAvatar(node),
    // Composite / section elements
    () => detectNavbar(node),
    () => detectModal(node),
    () => detectCard(node),
    () => detectHero(node),
    () => detectFormField(node, processedChildren),
    () => detectList(node),
    () => detectSection(node),
  ];

  for (const detector of detectors) {
    const result = detector();
    if (result && (!semanticData || result.confidence > semanticData.confidence)) {
      semanticData = result;
    }
  }

  // 3. Fallback to generic container if no specific type matched
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

  // 6. Map to suggested React component
  const reactComponent = semanticTypeToReactComponent(semanticData.semanticType);

  // 7. Construct enhanced node preserving all existing fields
  return {
    ...node,
    semanticType: semanticData.semanticType,
    confidence: semanticData.confidence,
    reasoning: semanticData.reasoning,
    layoutPattern: layoutPattern,
    suggestedComponent: reactComponent.component,
    suggestedProps: reactComponent.props,
    suggestedTailwind: reactComponent.tailwind,
    children: processedChildren,
  };
};

/**
 * Classify a single node semantically
 * @param {Object} node - Raw or processed node
 * @returns {Object} Classification result
 */
export const classifyNode = (node) => {
  const analyzed = analyzeSemanticTree(node);
  return {
    semanticType: analyzed.semanticType,
    confidence: analyzed.confidence,
    reasoning: analyzed.reasoning,
    layoutPattern: analyzed.layoutPattern,
    suggestedComponent: analyzed.suggestedComponent,
    suggestedProps: analyzed.suggestedProps,
    suggestedTailwind: analyzed.suggestedTailwind,
  };
};

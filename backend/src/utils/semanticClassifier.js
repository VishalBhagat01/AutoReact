/**
 * Semantic Classifier
 * Classifies Figma nodes into semantic UI component types
 * This is the Internal DSL (Domain Specific Language)
 */

/**
 * Classify a node semantically based on its properties
 * @param {Object} node - Figma node
 * @returns {Object} Classification result with type and confidence
 */
export const classifyNodeSemantically = (node) => {
  const classification = {
    figmaType: node.type,
    semanticType: null,
    confidence: 0, // 0-100
    reasoning: [],
  };

  // If already has a clear type name, use it
  if (node.type === 'TEXT') {
    classification.semanticType = classifyText(node);
    classification.confidence = 90;
    return classification;
  }


  // For generic containers, try to infer
  if (['FRAME', 'GROUP', 'RECTANGLE', 'COMPONENT', 'INSTANCE'].includes(node.type)) {
    const result = classifyContainer(node);
    classification.semanticType = result.type;
    classification.confidence = result.confidence;
    classification.reasoning = result.reasoning;
    return classification;
  }

  // Fallback
  classification.semanticType = `generic-${node.type.toLowerCase()}`;
  classification.confidence = 20;

  return classification;
};

/**
 * Classify text nodes into semantic types
 * @param {Object} node - Figma text node
 * @returns {string}
 */
const classifyText = (node) => {
  const text = node.characters || '';
  const fontSize = node.style?.fontSize || 0;

  // Heading detection
  if (fontSize > 24 || /^(h[1-6]|heading|title|header|main)/i.test(node.name)) {
    if (fontSize > 32) return 'heading-1';
    if (fontSize > 28) return 'heading-2';
    if (fontSize > 24) return 'heading-3';
    return 'heading';
  }

  // Button text detection
  if (/button|submit|cancel|ok|yes|no|close|save|delete|edit/i.test(text)) {
    return 'button-text';
  }

  // Label detection
  if (
    /label|description|hint|help|placeholder|error|success|warning/i.test(
      node.name
    ) ||
    fontSize < 12
  ) {
    return 'label';
  }

  // Body text
  return 'body-text';
};

/**
 * Classify container nodes into semantic types
 * @param {Object} node - Figma container node
 * @returns {Object} Classification with type, confidence, and reasoning
 */
const classifyContainer = (node) => {
  const result = {
    type: 'container',
    confidence: 30,
    reasoning: [],
  };

  if (!node.children || node.children.length === 0) {
    return result;
  }

  // Check node name for hints
  const nameLower = node.name.toLowerCase();
  const hasButton = node.children.some(
    (c) => c.type === 'BUTTON' || /button/i.test(c.name)
  );
  const hasInput = node.children.some(
    (c) => c.type === 'INPUT' || /input|field|textbox/i.test(c.name)
  );
  const hasText = node.children.some((c) => c.type === 'TEXT');
  // Enhanced image detection
  const hasImage = node.children.some((c) => {
    const isImageNode = c.type === 'RECTANGLE' && c.fills?.some(fill => fill.type === 'IMAGE');
    const isAvatarName = /avatar|profile|user.*pic|user.*image/i.test(c.name);
    const isIconName = /icon|svg|vector/i.test(c.name);
    return isImageNode || isAvatarName || isIconName || c.type === 'ELLIPSE';
  });

  // Card detection
  if (
    /card|panel|container|box|item|post|modal|dialog/i.test(nameLower) &&
    (hasText || hasButton)
  ) {
    result.type = 'card';
    result.confidence = 85;
    result.reasoning.push('Matches card naming pattern');
    result.reasoning.push('Contains text and/or buttons');
    return result;
  }

  // Form detection
  if (/form|login|signup|register|contact/i.test(nameLower) && (hasInput || hasButton)) {
    result.type = 'form';
    result.confidence = 80;
    result.reasoning.push('Matches form naming pattern');
    result.reasoning.push('Contains inputs and/or buttons');
    return result;
  }

  // Input field detection
  if (
    (/input|field|textbox|search|email|password/i.test(nameLower) &&
      hasText) ||
    hasInput
  ) {
    result.type = 'input-field';
    result.confidence = 75;
    result.reasoning.push('Matches input naming pattern');
    return result;
  }

  // Navigation/Menu detection
  if (/nav|menu|breadcrumb|tabs|tabbar|header/i.test(nameLower)) {
    result.type = 'navigation';
    result.confidence = 80;
    result.reasoning.push('Matches navigation naming pattern');
    return result;
  }

  // Hero section detection
  if (/hero|banner|splash|landing/i.test(nameLower) && node.children.length > 1) {
    result.type = 'hero-section';
    result.confidence = 70;
    result.reasoning.push('Matches hero section naming pattern');
    return result;
  }

  // Modal/Dialog detection
  if (/modal|dialog|popup|overlay/i.test(nameLower)) {
    result.type = 'modal';
    result.confidence = 80;
    result.reasoning.push('Matches modal naming pattern');
    return result;
  }

  // List detection
  if (
    (/list|items|entries|rows|table/i.test(nameLower) && node.children.length > 2) ||
    (node.children.length > 3 &&
      node.children.every((c) => c.type === 'GROUP' || c.type === 'FRAME'))
  ) {
    result.type = 'list';
    result.confidence = 70;
    result.reasoning.push('Multiple similar child items detected');
    return result;
  }

  // Grid detection
  if (
    /grid|gallery|showcase|columns/i.test(nameLower) &&
    node.children.length > 2
  ) {
    result.type = 'grid';
    result.confidence = 75;
    result.reasoning.push('Matches grid naming pattern');
    return result;
  }

  // Button group/toolbar detection
  if (
    /button.*group|toolbar|controls|actions/i.test(nameLower) &&
    node.children.some((c) => c.type === 'BUTTON')
  ) {
    result.type = 'button-group';
    result.confidence = 75;
    result.reasoning.push('Contains multiple buttons');
    return result;
  }

  // Avatar detection (image + optional name)
  if (/avatar|profile|user.*pic|user.*image/i.test(nameLower) && hasImage) {
    result.type = 'avatar';
    result.confidence = 75;
    result.reasoning.push('Matches avatar naming pattern');
    return result;
  }

  // Spacer/Divider detection
  if (/spacer|divider|separator|line/i.test(nameLower)) {
    result.type = 'spacer';
    result.confidence = 80;
    result.reasoning.push('Matches spacer naming pattern');
    return result;
  }

  // Badge/Chip detection
  if (/badge|chip|tag|label|pill/i.test(nameLower) && hasText) {
    result.type = 'badge';
    result.confidence = 75;
    result.reasoning.push('Matches badge naming pattern');
    return result;
  }

  // Generic container as fallback
  result.type = 'container';
  result.confidence = 40;
  result.reasoning.push('No specific pattern matched');

  return result;
};

/**
 * Map semantic type to React component suggestion
 * @param {string} semanticType - Semantic node type
 * @returns {Object} React component suggestion
 */
export const semanticTypeToReactComponent = (semanticType) => {
  const componentMap = {
    // Text components
    'heading-1': { component: 'Heading', props: { level: 1 }, tailwind: 'text-4xl font-bold' },
    'heading-2': { component: 'Heading', props: { level: 2 }, tailwind: 'text-3xl font-bold' },
    'heading-3': { component: 'Heading', props: { level: 3 }, tailwind: 'text-2xl font-bold' },
    'heading': { component: 'Heading', props: { level: 4 }, tailwind: 'text-xl font-bold' },
    'body-text': { component: 'Text', props: {}, tailwind: 'text-base' },
    'button-text': { component: 'Text', props: { role: 'button' }, tailwind: 'text-sm font-semibold' },
    'label': { component: 'Label', props: {}, tailwind: 'text-xs text-gray-600' },

    // Input components
    'input-field': { component: 'Input', props: {}, tailwind: 'border rounded px-3 py-2' },

    // Container components
    'button': { component: 'Button', props: {}, tailwind: 'px-4 py-2 rounded font-medium' },
    'card': { component: 'Card', props: {}, tailwind: 'border rounded-lg shadow p-4' },
    'form': { component: 'Form', props: {}, tailwind: 'flex flex-col gap-4' },
    'navigation': { component: 'Navigation', props: {}, tailwind: 'flex gap-4 items-center' },
    'hero-section': { component: 'HeroSection', props: {}, tailwind: 'w-full py-16' },
    'modal': { component: 'Modal', props: {}, tailwind: 'fixed inset-0 bg-black/50 flex items-center justify-center' },
    'list': { component: 'List', props: {}, tailwind: 'flex flex-col gap-2' },
    'grid': { component: 'Grid', props: {}, tailwind: 'grid grid-cols-3 gap-4' },
    'button-group': { component: 'ButtonGroup', props: {}, tailwind: 'flex gap-2' },
    'avatar': { component: 'Avatar', props: {}, tailwind: 'w-10 h-10 rounded-full' },
    'spacer': { component: 'div', props: {}, tailwind: 'h-4' },
    'badge': { component: 'Badge', props: {}, tailwind: 'inline-block px-3 py-1 rounded-full text-xs' },
    'container': { component: 'div', props: {}, tailwind: 'flex flex-col' },
  };

  return componentMap[semanticType] || {
    component: 'div',
    props: {},
    tailwind: 'block',
  };
};

/**
 * Get a semantic DSL summary for a node
 * @param {Object} node - Figma node
 * @returns {Object} DSL summary
 */
export const getSemanticDSLSummary = (node) => {
  const classification = classifyNodeSemantically(node);
  const reactComponent = semanticTypeToReactComponent(classification.semanticType);

  return {
    nodeId: node.id,
    nodeName: node.name,
    figmaType: classification.figmaType,
    semanticType: classification.semanticType,
    confidence: classification.confidence,
    reasoning: classification.reasoning,
    suggestedComponent: reactComponent.component,
    suggestedProps: reactComponent.props,
    tailwindClasses: reactComponent.tailwind,
  };
};

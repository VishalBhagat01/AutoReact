/**
 * Semantic Type Constants
 * Internal Domain-Specific Language (DSL) for classified UI components
 */
export const SemanticTypes = {
  BUTTON: 'Button',
  INPUT_FIELD: 'InputField',
  FORM_FIELD: 'FormField',
  HEADING: 'Heading',
  HEADING_1: 'Heading1',
  HEADING_2: 'Heading2',
  HEADING_3: 'Heading3',
  PARAGRAPH: 'Paragraph',
  CARD: 'Card',
  NAVBAR: 'Navbar',
  HERO: 'HeroSection',
  MODAL: 'Modal',
  LIST: 'List',
  GRID: 'Grid',
  AVATAR: 'Avatar',
  BADGE: 'Badge',
  SECTION: 'Section',
  CONTAINER: 'Container',
  GENERIC: 'Generic',
};

/**
 * Thresholds for confidence scoring
 */
export const Thresholds = {
  HIGH_CONFIDENCE: 0.8,
  MEDIUM_CONFIDENCE: 0.5,
  LOW_CONFIDENCE: 0.2,
};

/**
 * Layout Constants
 */
export const LayoutTypes = {
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical',
  STACK: 'stack',
  GRID: 'grid',
};

/**
 * Map semantic type to React component suggestion
 * @param {string} semanticType - Semantic node type
 * @returns {Object} React component definition with props and Tailwind styling
 */
export const semanticTypeToReactComponent = (semanticType) => {
  const componentMap = {
    // Text components
    [SemanticTypes.HEADING_1]: { component: 'Heading', props: { level: 1 }, tailwind: 'text-4xl font-bold tracking-tight' },
    [SemanticTypes.HEADING_2]: { component: 'Heading', props: { level: 2 }, tailwind: 'text-3xl font-bold tracking-tight' },
    [SemanticTypes.HEADING_3]: { component: 'Heading', props: { level: 3 }, tailwind: 'text-2xl font-bold' },
    [SemanticTypes.HEADING]: { component: 'Heading', props: { level: 4 }, tailwind: 'text-xl font-bold' },
    [SemanticTypes.PARAGRAPH]: { component: 'Text', props: { as: 'p' }, tailwind: 'text-base leading-relaxed text-gray-700' },

    // Interactive & Form components
    [SemanticTypes.BUTTON]: { component: 'Button', props: { type: 'button' }, tailwind: 'px-4 py-2 rounded-lg font-medium transition-colors' },
    [SemanticTypes.INPUT_FIELD]: { component: 'Input', props: { type: 'text' }, tailwind: 'w-full border rounded-md px-3 py-2 focus:ring-2 focus:outline-none' },
    [SemanticTypes.FORM_FIELD]: { component: 'FormField', props: {}, tailwind: 'flex flex-col gap-1.5 w-full' },

    // Structural & Container components
    [SemanticTypes.CARD]: { component: 'Card', props: {}, tailwind: 'border rounded-xl shadow-sm p-6 bg-white' },
    [SemanticTypes.NAVBAR]: { component: 'Navbar', props: { as: 'nav' }, tailwind: 'w-full flex items-center justify-between px-6 py-4' },
    [SemanticTypes.HERO]: { component: 'HeroSection', props: { as: 'section' }, tailwind: 'w-full py-20 px-8 flex flex-col items-center text-center' },
    [SemanticTypes.MODAL]: { component: 'Modal', props: { role: 'dialog' }, tailwind: 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center' },
    [SemanticTypes.LIST]: { component: 'List', props: { as: 'ul' }, tailwind: 'flex flex-col gap-3' },
    [SemanticTypes.GRID]: { component: 'Grid', props: {}, tailwind: 'grid grid-cols-1 md:grid-cols-3 gap-6' },
    [SemanticTypes.AVATAR]: { component: 'Avatar', props: {}, tailwind: 'w-10 h-10 rounded-full object-cover overflow-hidden' },
    [SemanticTypes.BADGE]: { component: 'Badge', props: {}, tailwind: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium' },
    [SemanticTypes.SECTION]: { component: 'Section', props: { as: 'section' }, tailwind: 'w-full py-12 px-6' },
    [SemanticTypes.CONTAINER]: { component: 'Container', props: {}, tailwind: 'flex flex-col' },
    [SemanticTypes.GENERIC]: { component: 'div', props: {}, tailwind: 'block' },
  };

  return componentMap[semanticType] || {
    component: 'div',
    props: {},
    tailwind: 'block',
  };
};

/**
 * Canonical Design Intermediate Representation (Design IR) Schema
 * Version 1.0.0
 * 
 * Single source of truth for both:
 * 1. Individual component generation
 * 2. Complete React project generation
 */

export const IR_VERSION = '1.0.0';

/**
 * Standard semantic classifications
 */
export const SemanticTypes = Object.freeze({
  BUTTON: 'Button',
  INPUT: 'Input',
  CARD: 'Card',
  NAVBAR: 'Navbar',
  SIDEBAR: 'Sidebar',
  MODAL: 'Modal',
  FORM: 'Form',
  TABLE: 'Table',
  LIST: 'List',
  HEADER: 'Header',
  FOOTER: 'Footer',
  SECTION: 'Section',
  CONTAINER: 'Container',
  IMAGE: 'Image',
  TEXT: 'Text',
  ICON: 'Icon',
  UNKNOWN: 'Unknown',
});

/**
 * Supported AST / Figma node types
 */
export const NodeTypes = Object.freeze({
  FRAME: 'FRAME',
  GROUP: 'GROUP',
  COMPONENT: 'COMPONENT',
  COMPONENT_SET: 'COMPONENT_SET',
  INSTANCE: 'INSTANCE',
  TEXT: 'TEXT',
  VECTOR: 'VECTOR',
  RECTANGLE: 'RECTANGLE',
  ELLIPSE: 'ELLIPSE',
  LINE: 'LINE',
  STAR: 'STAR',
  POLYGON: 'POLYGON',
  BOOLEAN_OPERATION: 'BOOLEAN_OPERATION',
  CANVAS: 'CANVAS',
  SECTION: 'SECTION',
});

/**
 * Inferred and explicit layout modes
 */
export const LayoutModes = Object.freeze({
  NONE: 'NONE',
  FLEX_ROW: 'FLEX_ROW',
  FLEX_COLUMN: 'FLEX_COLUMN',
  GRID: 'GRID',
  ABSOLUTE: 'ABSOLUTE',
  STACK: 'STACK',
  OVERLAY: 'OVERLAY',
});

/**
 * Component origin and archetype types
 */
export const ComponentTypes = Object.freeze({
  NATIVE_FIGMA: 'native_figma',
  COMPONENT_SET: 'component_set',
  INFERRED_PATTERN: 'inferred_pattern',
  SECTION: 'section',
});

/**
 * Visual asset types
 */
export const AssetTypes = Object.freeze({
  IMAGE: 'image',
  VECTOR_SVG: 'vector_svg',
  ICON: 'icon',
  RENDER: 'render',
});

/**
 * Relationship edge types
 */
export const RelationshipTypes = Object.freeze({
  PARENT_OF: 'PARENT_OF',
  DEPENDS_ON: 'DEPENDS_ON',
  ALIGNED_WITH: 'ALIGNED_WITH',
  NEXT_TO: 'NEXT_TO',
  CONTAINS: 'CONTAINS',
  INSTANCE_OF: 'INSTANCE_OF',
  SHARES_STYLE_WITH: 'SHARES_STYLE_WITH',
  GROUPED_WITH: 'GROUPED_WITH',
});

/**
 * Classification sources
 */
export const ClassificationSources = Object.freeze({
  FIGMA_NATIVE: 'figma_native',
  HEURISTIC: 'heuristic',
  INFERRED: 'inferred',
  AI_SERVICE: 'ai_service',
});

/**
 * Factory for creating a blank canonical Design IR Document
 * @param {Object} params
 * @returns {Object}
 */
export const createIRDocument = ({
  documentId,
  fileKey,
  fileName = 'Untitled Design',
  version = IR_VERSION,
  metadata = {},
  pages = [],
  assets = [],
  components = [],
  tokens = {},
  relationships = { nodes: [], edges: [], statistics: {} },
}) => ({
  documentId: documentId || `ir_${fileKey || 'doc'}_${Date.now()}`,
  fileKey: fileKey || '',
  fileName,
  version,
  metadata: {
    figmaVersion: '1.0',
    importedAt: new Date().toISOString(),
    irGeneratedAt: new Date().toISOString(),
    generator: `Reagmat Design IR Builder v${IR_VERSION}`,
    totalNodeCount: 0,
    pageCount: pages.length,
    componentCount: components.length,
    assetCount: assets.length,
    tokenCount: 0,
    ...metadata,
  },
  pages,
  assets,
  components,
  tokens,
  relationships,
});

/**
 * Factory for creating a canonical Page object
 * @param {Object} params
 * @returns {Object}
 */
export const createIRPage = ({
  id,
  name = 'Page',
  dimensions = { width: 0, height: 0 },
  sections = [],
  children = [],
  metadata = {},
}) => ({
  id: String(id || `page_${Date.now()}`),
  name,
  dimensions: {
    width: Math.round(dimensions?.width || 0),
    height: Math.round(dimensions?.height || 0),
  },
  sections: sections || [],
  children: children || [],
  metadata: metadata || {},
});

/**
 * Factory for creating a canonical Design IR Node
 * @param {Object} params
 * @returns {Object}
 */
export const createIRNode = ({
  id,
  figmaId,
  name = 'Node',
  type = NodeTypes.FRAME,
  semanticType = SemanticTypes.UNKNOWN,
  semantics = {},
  bounds = { x: 0, y: 0, width: 0, height: 0 },
  relativeBounds = null,
  layout = {},
  styles = {},
  typography = null,
  effects = [],
  fills = [],
  strokes = null,
  assets = [],
  text = null,
  children = [],
  relationships = {},
  metadata = {},
}) => ({
  id: String(id),
  figmaId: String(figmaId || id),
  name: String(name),
  type,
  semanticType,
  semantics: {
    type: semantics?.type || semanticType || SemanticTypes.UNKNOWN,
    confidence: typeof semantics?.confidence === 'number' ? semantics.confidence : 0.1,
    evidence: Array.isArray(semantics?.evidence) ? semantics.evidence : [],
    classificationSource: semantics?.classificationSource || ClassificationSources.HEURISTIC,
    isExplicit: Boolean(semantics?.isExplicit),
  },
  bounds: {
    x: Math.round(bounds?.x || 0),
    y: Math.round(bounds?.y || 0),
    width: Math.round(bounds?.width || 0),
    height: Math.round(bounds?.height || 0),
  },
  relativeBounds: relativeBounds
    ? {
        x: Math.round(relativeBounds.x || 0),
        y: Math.round(relativeBounds.y || 0),
        width: Math.round(relativeBounds.width || 0),
        height: Math.round(relativeBounds.height || 0),
      }
    : null,
  layout: {
    mode: layout?.mode || LayoutModes.NONE,
    direction: layout?.direction || 'none',
    gap: layout?.gap || 0,
    padding: {
      top: layout?.padding?.top || 0,
      right: layout?.padding?.right || 0,
      bottom: layout?.padding?.bottom || 0,
      left: layout?.padding?.left || 0,
    },
    justifyContent: layout?.justifyContent || 'flex-start',
    alignItems: layout?.alignItems || 'stretch',
    wrap: Boolean(layout?.wrap),
    sizing: layout?.sizing || { horizontal: 'FIXED', vertical: 'FIXED' },
  },
  styles: styles || {},
  typography: typography || null,
  effects: Array.isArray(effects) ? effects : [],
  fills: Array.isArray(fills) ? fills : [],
  strokes: strokes || null,
  assets: Array.isArray(assets) ? assets : [],
  text: text !== null && text !== undefined ? String(text) : null,
  children: children || [],
  relationships: {
    parentId: relationships?.parentId || null,
    childIds: Array.isArray(relationships?.childIds) ? relationships.childIds : [],
    siblingIndex: typeof relationships?.siblingIndex === 'number' ? relationships.siblingIndex : 0,
    inferredLayout: relationships?.inferredLayout || LayoutModes.NONE,
    alignments: Array.isArray(relationships?.alignments) ? relationships.alignments : [],
    dependencies: Array.isArray(relationships?.dependencies) ? relationships.dependencies : [],
  },
  metadata: {
    isComponent: Boolean(metadata?.isComponent),
    isInstance: Boolean(metadata?.isInstance),
    componentId: metadata?.componentId || null,
    componentProperties: metadata?.componentProperties || {},
    variantProperties: metadata?.variantProperties || {},
    visible: metadata?.visible !== false,
    opacity: typeof metadata?.opacity === 'number' ? metadata.opacity : 1,
    ...metadata,
  },
});

/**
 * Factory for creating a canonical Component object
 * @param {Object} params
 * @returns {Object}
 */
export const createIRComponent = ({
  id,
  name,
  sourceNodeId,
  componentType = ComponentTypes.NATIVE_FIGMA,
  variants = [],
  properties = {},
  dependencies = { componentIds: [], assetIds: [], tokenKeys: [], allNodeIds: [] },
  children = null,
}) => ({
  id: String(id),
  name: String(name),
  sourceNodeId: String(sourceNodeId),
  componentType,
  variants: Array.isArray(variants) ? variants : [],
  properties: properties || {},
  dependencies: {
    componentIds: Array.isArray(dependencies?.componentIds) ? dependencies.componentIds : [],
    assetIds: Array.isArray(dependencies?.assetIds) ? dependencies.assetIds : [],
    tokenKeys: Array.isArray(dependencies?.tokenKeys) ? dependencies.tokenKeys : [],
    allNodeIds: Array.isArray(dependencies?.allNodeIds) ? dependencies.allNodeIds : [],
  },
  children,
});

/**
 * Factory for creating a canonical Asset descriptor in IR
 * @param {Object} params
 * @returns {Object}
 */
export const createIRAsset = ({
  assetId,
  sourceNodeId,
  assetType = AssetTypes.IMAGE,
  format = 'png',
  storageReference = '',
  dimensions = { width: null, height: null },
  fileSize = 0,
  mimeType = 'application/octet-stream',
  checksum = null,
}) => ({
  assetId: String(assetId),
  sourceNodeId: String(sourceNodeId),
  assetType,
  format: String(format).toLowerCase(),
  storageReference: String(storageReference),
  dimensions: {
    width: dimensions?.width || null,
    height: dimensions?.height || null,
  },
  fileSize: Number(fileSize || 0),
  mimeType,
  checksum,
});


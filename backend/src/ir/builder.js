/**
 * Canonical Design IR Builder Engine
 * Converts Figma AST / DesignTree into the canonical unified Design IR.
 * Single source of truth consumed by both individual component generation
 * and complete React project generation.
 */

import {
  IR_VERSION,
  SemanticTypes,
  NodeTypes,
  LayoutModes,
  ClassificationSources,
  createIRDocument,
  createIRPage,
  createIRNode,
  createIRAsset,
} from './schema.js';
import { extractDesignTokens } from './tokens.js';
import { extractComponents } from './components.js';
import { processNode } from '../utils/nodeProcessor.js';
import { analyzeSemanticTree } from '../services/figma/semantic/semanticEngine.js';

/**
 * Map or normalize existing semantic classifications to canonical Design IR SemanticTypes
 * @param {Object} node
 * @param {Object} [parent]
 * @returns {{ semanticType: string, confidence: number, evidence: string[], source: string, isExplicit: boolean }}
 */
export const resolveCanonicalSemantics = (node, parent = null) => {
  const name = String(node.name || '');
  const lowerName = name.toLowerCase();
  const type = node.type;

  // 1. Explicit Figma Component naming check
  const isExplicitComponent = type === NodeTypes.COMPONENT || type === NodeTypes.COMPONENT_SET;

  // 2. Specialized Check: Image
  const hasImageFill = Array.isArray(node.fills) && node.fills.some(f => f?.type === 'IMAGE');
  const hasStyleImage = Array.isArray(node.styles?.images) && node.styles.images.length > 0;
  if (type === 'IMAGE' || hasImageFill || hasStyleImage || /^(image|img|banner|photo|picture|thumb|avatar-img)/i.test(name)) {
    return {
      semanticType: SemanticTypes.IMAGE,
      confidence: hasImageFill || hasStyleImage ? 0.95 : 0.8,
      evidence: hasImageFill ? ['Contains Figma IMAGE fill'] : ['Name or type indicates visual image'],
      source: hasImageFill ? ClassificationSources.FIGMA_NATIVE : ClassificationSources.HEURISTIC,
      isExplicit: isExplicitComponent,
    };
  }

  // 3. Specialized Check: Icon
  const isVectorType = ['VECTOR', 'STAR', 'LINE', 'POLYGON'].includes(type);
  const isIconName = /(?:^|[-_ ])icon(?:[-_ ]|$)|svg|logo|glyph/i.test(name);
  const isSmallSquare = node.bounds && node.bounds.width <= 48 && node.bounds.height <= 48 && Math.abs(node.bounds.width - node.bounds.height) <= 4;
  if ((isVectorType && isSmallSquare) || (isIconName && isSmallSquare) || (isVectorType && isIconName)) {
    return {
      semanticType: SemanticTypes.ICON,
      confidence: 0.9,
      evidence: ['Vector shape with icon-proportional dimensions or naming'],
      source: ClassificationSources.HEURISTIC,
      isExplicit: isExplicitComponent,
    };
  }

  // 4. Specialized Check: Sidebar
  if (/(?:^|[-_ ])(sidebar|side-nav|aside|drawer|left-nav)(?:[-_ ]|$)/i.test(name)) {
    return {
      semanticType: SemanticTypes.SIDEBAR,
      confidence: 0.88,
      evidence: ['Name matches navigation sidebar pattern'],
      source: ClassificationSources.HEURISTIC,
      isExplicit: isExplicitComponent,
    };
  }

  // 5. Specialized Check: Button
  if (/(?:^|[-_ ])(button|btn|cta)(?:[-_ ]|$)/i.test(name)) {
    return {
      semanticType: SemanticTypes.BUTTON,
      confidence: 0.92,
      evidence: ['Name matches button/cta pattern'],
      source: ClassificationSources.HEURISTIC,
      isExplicit: isExplicitComponent,
    };
  }

  // 6. Specialized Check: Card
  if (/(?:^|[-_ ])(card|tile)(?:[-_ ]|$)/i.test(name)) {
    return {
      semanticType: SemanticTypes.CARD,
      confidence: 0.88,
      evidence: ['Name matches card container pattern'],
      source: ClassificationSources.HEURISTIC,
      isExplicit: isExplicitComponent,
    };
  }

  // 7. Specialized Check: Modal
  if (/(?:^|[-_ ])(modal|dialog|popup|alert-dialog)(?:[-_ ]|$)/i.test(name)) {
    return {
      semanticType: SemanticTypes.MODAL,
      confidence: 0.9,
      evidence: ['Name matches modal dialog pattern'],
      source: ClassificationSources.HEURISTIC,
      isExplicit: isExplicitComponent,
    };
  }

  // 8. Specialized Check: Table
  if (/(?:^|[-_ ])(table|datatable|grid-table|data-grid)(?:[-_ ]|$)/i.test(name)) {
    return {
      semanticType: SemanticTypes.TABLE,
      confidence: 0.85,
      evidence: ['Name matches tabular data structure pattern'],
      source: ClassificationSources.HEURISTIC,
      isExplicit: isExplicitComponent,
    };
  }

  // 9. Specialized Check: Form
  if (/(?:^|[-_ ])(form|login-form|signup-form|auth-form|contact-form)(?:[-_ ]|$)/i.test(name)) {
    return {
      semanticType: SemanticTypes.FORM,
      confidence: 0.85,
      evidence: ['Name matches interactive form container pattern'],
      source: ClassificationSources.HEURISTIC,
      isExplicit: isExplicitComponent,
    };
  }

  // 10. Specialized Check: Navbar / Header / Footer
  if (/(?:^|[-_ ])(navbar|nav-bar|nav)(?:[-_ ]|$)/i.test(name)) {
    return {
      semanticType: SemanticTypes.NAVBAR,
      confidence: 0.92,
      evidence: ['Name indicates navigation bar'],
      source: ClassificationSources.HEURISTIC,
      isExplicit: isExplicitComponent,
    };
  }

  if (/(?:^|[-_ ])(header|app-header|top-bar|app-bar)(?:[-_ ]|$)/i.test(name) && !/(card-header|modal-header)/i.test(name)) {
    return {
      semanticType: SemanticTypes.HEADER,
      confidence: 0.85,
      evidence: ['Name and position indicate global top header'],
      source: ClassificationSources.HEURISTIC,
      isExplicit: isExplicitComponent,
    };
  }
  if (/(?:^|[-_ ])(footer|app-footer|bottom-bar)(?:[-_ ]|$)/i.test(name)) {
    return {
      semanticType: SemanticTypes.FOOTER,
      confidence: 0.88,
      evidence: ['Name and position indicate global bottom footer'],
      source: ClassificationSources.HEURISTIC,
      isExplicit: isExplicitComponent,
    };
  }

  // 8. Specialized Check: Text
  if (type === NodeTypes.TEXT) {
    const rawSemantic = node.semanticType;
    if (rawSemantic === 'Heading' || rawSemantic === 'Heading1' || rawSemantic === 'Heading2' || rawSemantic === 'Heading3') {
      return {
        semanticType: SemanticTypes.TEXT,
        confidence: node.confidence || 0.8,
        evidence: Array.isArray(node.reasoning) ? node.reasoning : ['Heading text node'],
        source: ClassificationSources.HEURISTIC,
        isExplicit: false,
      };
    }
    return {
      semanticType: SemanticTypes.TEXT,
      confidence: 0.95,
      evidence: ['Figma native TEXT node'],
      source: ClassificationSources.FIGMA_NATIVE,
      isExplicit: false,
    };
  }

  // 9. Existing Semantic Classifier mapping
  const existing = node.semanticType;
  if (existing) {
    const mapping = {
      'Button': SemanticTypes.BUTTON,
      'InputField': SemanticTypes.INPUT,
      'Input': SemanticTypes.INPUT,
      'FormField': SemanticTypes.INPUT,
      'Card': SemanticTypes.CARD,
      'Navbar': SemanticTypes.NAVBAR,
      'Modal': SemanticTypes.MODAL,
      'HeroSection': SemanticTypes.SECTION,
      'List': SemanticTypes.LIST,
      'Section': SemanticTypes.SECTION,
      'Container': SemanticTypes.CONTAINER,
    };

    if (mapping[existing]) {
      return {
        semanticType: mapping[existing],
        confidence: typeof node.confidence === 'number' ? node.confidence : 0.7,
        evidence: Array.isArray(node.reasoning) ? node.reasoning : [`Classified by semantic engine as ${existing}`],
        source: ClassificationSources.HEURISTIC,
        isExplicit: isExplicitComponent,
      };
    }
  }

  // 10. Fallback: Generic Container or Unknown
  if (['FRAME', 'GROUP', 'COMPONENT', 'INSTANCE'].includes(type)) {
    return {
      semanticType: SemanticTypes.CONTAINER,
      confidence: 0.4,
      evidence: ['Structural container node with general bounds'],
      source: ClassificationSources.HEURISTIC,
      isExplicit: false,
    };
  }

  return {
    semanticType: SemanticTypes.UNKNOWN,
    confidence: 0.1,
    evidence: ['Uncertain classification; low structural specificity'],
    source: ClassificationSources.HEURISTIC,
    isExplicit: false,
  };
};

/**
 * Normalize and convert an AST node into a canonical DesignIRNode
 * @param {Object} rawNode
 * @param {Object|null} parent
 * @param {number} siblingIndex
 * @param {Map<string, Object>} assetMap
 * @returns {Object} Canonical DesignIRNode
 */
export const buildIRNode = (rawNode, parent = null, siblingIndex = 0, assetMap = new Map()) => {
  if (!rawNode || typeof rawNode !== 'object') return null;

  // Resolve bounds
  const bounds = {
    x: Math.round(rawNode.bounds?.x || rawNode.absoluteBoundingBox?.x || 0),
    y: Math.round(rawNode.bounds?.y || rawNode.absoluteBoundingBox?.y || 0),
    width: Math.round(rawNode.bounds?.width || rawNode.absoluteBoundingBox?.width || 0),
    height: Math.round(rawNode.bounds?.height || rawNode.absoluteBoundingBox?.height || 0),
  };

  // Calculate relative bounds relative to parent container
  let relativeBounds = null;
  if (parent?.bounds) {
    relativeBounds = {
      x: bounds.x - parent.bounds.x,
      y: bounds.y - parent.bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
  } else {
    relativeBounds = { ...bounds };
  }

  // Resolve semantics
  const sem = resolveCanonicalSemantics(rawNode, parent);

  // Layout normalization
  const rawLayout = rawNode.layout || {};
  let layoutMode = LayoutModes.NONE;
  if (rawLayout.mode === 'FLEX_ROW' || rawLayout.direction === 'horizontal') {
    layoutMode = LayoutModes.FLEX_ROW;
  } else if (rawLayout.mode === 'FLEX_COLUMN' || rawLayout.direction === 'vertical') {
    layoutMode = LayoutModes.FLEX_COLUMN;
  } else if (rawLayout.mode === 'GRID') {
    layoutMode = LayoutModes.GRID;
  } else if (rawLayout.mode === 'ABSOLUTE') {
    layoutMode = LayoutModes.ABSOLUTE;
  }

  const paddingObj = rawLayout.padding || rawNode.styles?.spacing || {};
  const padding = {
    top: paddingObj.top !== undefined ? paddingObj.top : (paddingObj.padding || 0),
    right: paddingObj.right !== undefined ? paddingObj.right : (paddingObj.padding || 0),
    bottom: paddingObj.bottom !== undefined ? paddingObj.bottom : (paddingObj.padding || 0),
    left: paddingObj.left !== undefined ? paddingObj.left : (paddingObj.padding || 0),
  };

  // Typography
  const typo = rawNode.typography || rawNode.styles?.typography || null;

  // Fills & Strokes
  const fills = Array.isArray(rawNode.fills)
    ? rawNode.fills
    : rawNode.styles?.colors
    ? rawNode.styles.colors.map(c => ({ type: 'SOLID', hex: c.hex, rgba: c.rgba, opacity: c.opacity }))
    : [];

  const strokes = rawNode.strokes || rawNode.styles?.stroke || null;
  const effects = Array.isArray(rawNode.effects) ? rawNode.effects : rawNode.styles?.effects || [];

  // Attached Assets lookup
  const nodeAssets = [];
  if (assetMap.has(String(rawNode.id))) {
    nodeAssets.push(assetMap.get(String(rawNode.id)));
  } else if (rawNode.asset) {
    nodeAssets.push(rawNode.asset);
  }

  // Child IDs for relationship graph
  const rawChildren = Array.isArray(rawNode.children) ? rawNode.children : [];
  const childIds = rawChildren.map(c => String(c?.id)).filter(Boolean);

  const irNode = createIRNode({
    id: rawNode.id,
    figmaId: rawNode.figmaId || rawNode.id,
    name: rawNode.name || 'Node',
    type: rawNode.type || NodeTypes.FRAME,
    semanticType: sem.semanticType,
    semantics: {
      type: sem.semanticType,
      confidence: sem.confidence,
      evidence: sem.evidence,
      classificationSource: sem.source,
      isExplicit: sem.isExplicit,
    },
    bounds,
    relativeBounds,
    layout: {
      mode: layoutMode,
      direction: layoutMode === LayoutModes.FLEX_ROW ? 'horizontal' : layoutMode === LayoutModes.FLEX_COLUMN ? 'vertical' : 'none',
      gap: rawLayout.gap !== undefined ? rawLayout.gap : 0,
      padding,
      justifyContent: rawLayout.justifyContent || 'flex-start',
      alignItems: rawLayout.alignItems || 'stretch',
      wrap: Boolean(rawLayout.wrap),
      sizing: rawLayout.sizing || { horizontal: 'FIXED', vertical: 'FIXED' },
    },
    styles: rawNode.styles || {},
    typography: typo,
    effects,
    fills,
    strokes,
    assets: nodeAssets,
    text: rawNode.text !== undefined ? rawNode.text : rawNode.characters,
    relationships: {
      parentId: parent ? String(parent.id) : null,
      childIds,
      siblingIndex,
      inferredLayout: layoutMode,
      alignments: [],
      dependencies: [],
    },
    metadata: {
      isComponent: rawNode.type === NodeTypes.COMPONENT || rawNode.type === NodeTypes.COMPONENT_SET,
      isInstance: rawNode.type === NodeTypes.INSTANCE,
      componentId: rawNode.componentId || rawNode.metadata?.componentId || null,
      componentProperties: rawNode.componentProperties || rawNode.metadata?.componentProperties || {},
      variantProperties: rawNode.variantProperties || rawNode.metadata?.variantProperties || {},
      visible: rawNode.visible !== false,
      opacity: typeof rawNode.opacity === 'number' ? rawNode.opacity : 1,
    },
  });

  // Recursively build children
  irNode.children = rawChildren
    .map((child, idx) => buildIRNode(child, irNode, idx, assetMap))
    .filter(Boolean);

  return irNode;
};

/**
 * Calculate bounding box enclosing an array of nodes
 * @param {Array<Object>} nodes
 * @returns {{ width: number, height: number }}
 */
const calculatePageDimensions = (nodes) => {
  if (!nodes || nodes.length === 0) return { width: 1440, height: 900 };

  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    if (n?.bounds) {
      const right = (n.bounds.x || 0) + (n.bounds.width || 0);
      const bottom = (n.bounds.y || 0) + (n.bounds.height || 0);
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    }
  }

  return {
    width: Math.max(maxX, 1440),
    height: Math.max(maxY, 900),
  };
};

/**
 * Core Canonical Design IR Builder
 * Converts raw Figma data, normalized AST, and asset records into a unified Design IR Document.
 * 
 * @param {Object} sourceData - Figma file JSON or normalized tree object
 * @param {Object} [options] - Configuration & metadata options
 * @returns {Object} Canonical Design IR Document
 */
export const buildDesignIR = (sourceData, options = {}) => {
  const {
    projectId = null,
    fileKey = options.fileKey || sourceData?.fileKey || 'unknown_file',
    fileName = options.fileName || sourceData?.fileName || sourceData?.name || 'Untitled Design',
    figmaVersion = options.figmaVersion || sourceData?.fileVersion || sourceData?.version || '1.0',
    assets = [],
    relationships = null,
  } = options;

  // Build asset lookup map: nodeId -> Asset descriptor
  const assetMap = new Map();
  const assetCatalog = [];
  const assetsList = Array.isArray(assets) ? assets : [];

  for (const a of assetsList) {
    const irAsset = createIRAsset({
      assetId: a._id || a.assetId || `asset_${a.figmaNodeId}`,
      sourceNodeId: a.figmaNodeId || a.sourceNodeId,
      assetType: a.assetType || 'image',
      format: a.format || 'png',
      storageReference: a.publicUrl || a.storagePath || '',
      dimensions: a.dimensions,
      fileSize: a.fileSize || 0,
      mimeType: a.mimeType,
      checksum: a.checksum,
    });
    assetCatalog.push(irAsset);
    if (irAsset.sourceNodeId) {
      assetMap.set(String(irAsset.sourceNodeId), irAsset);
    }
  }

  // Extract raw pages / canvas nodes
  let rawPages = [];
  if (Array.isArray(sourceData?.pages)) {
    rawPages = sourceData.pages;
  } else if (sourceData?.document?.children) {
    rawPages = sourceData.document.children.filter(c => c.type === 'CANVAS');
  } else if (sourceData?.tree) {
    rawPages = [sourceData.tree];
  } else if (Array.isArray(sourceData?.nodes)) {
    rawPages = [{ id: 'selective_page', name: 'Selective Extraction', children: sourceData.nodes }];
  } else {
    rawPages = [{ id: 'default_page', name: 'Design Page', children: [sourceData] }];
  }

  // Build Canonical Pages & Nodes
  let totalNodeCount = 0;
  const canonicalPages = rawPages.map((rawPage, pIdx) => {
    const pageId = rawPage.id || `page_${pIdx + 1}`;
    const pageName = rawPage.name || `Page ${pIdx + 1}`;

    const rawChildren = Array.isArray(rawPage.children) ? rawPage.children : [];
    
    // Process and enrich through standard AST & semantic pipeline if needed
    const processedChildren = rawChildren.map(child => {
      // If node already processed with bounds/styles, use directly; otherwise process
      if (child.bounds || child.styles) {
        return child;
      }
      const p = processNode(child, { includeLayout: true, includeStyles: true, includeSemantics: true });
      return p ? analyzeSemanticTree(p) : child;
    }).filter(Boolean);

    // Build canonical DesignIRNode tree
    const irChildren = processedChildren
      .map((child, idx) => buildIRNode(child, null, idx, assetMap))
      .filter(Boolean);

    // Count nodes
    const countNodesRecursive = (n) => {
      let count = 1;
      if (Array.isArray(n.children)) {
        for (const c of n.children) count += countNodesRecursive(c);
      }
      return count;
    };
    for (const c of irChildren) {
      totalNodeCount += countNodesRecursive(c);
    }

    // Top-level sections / frames
    const sections = irChildren
      .filter(c => ['FRAME', 'SECTION', 'COMPONENT', 'COMPONENT_SET'].includes(c.type))
      .map(c => c.id);

    return createIRPage({
      id: pageId,
      name: pageName,
      dimensions: calculatePageDimensions(irChildren),
      sections,
      children: irChildren,
      metadata: {
        backgroundColor: rawPage.backgroundColor || null,
        prototypeStartNodeId: rawPage.prototypeStartNodeId || null,
      },
    });
  });

  // Extract Unified Design Tokens
  const tokens = extractDesignTokens(canonicalPages);

  // Extract Components & Dependencies
  const components = extractComponents(canonicalPages, { includeInferredComponents: true });

  // Relationships graph summary
  const graphData = relationships || {
    nodes: [],
    edges: [],
    statistics: {
      nodeCount: totalNodeCount,
      pageCount: canonicalPages.length,
      componentCount: components.length,
      assetCount: assetCatalog.length,
    },
  };

  const documentId = projectId ? `ir_${projectId}` : `ir_${fileKey}_${Date.now()}`;

  return createIRDocument({
    documentId,
    fileKey,
    fileName,
    version: IR_VERSION,
    metadata: {
      projectId: projectId || null,
      figmaVersion,
      totalNodeCount,
      pageCount: canonicalPages.length,
      componentCount: components.length,
      assetCount: assetCatalog.length,
      tokenCount: tokens.colors?.raw?.length || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    pages: canonicalPages,
    assets: assetCatalog,
    components,
    tokens,
    relationships: graphData,
  });
};

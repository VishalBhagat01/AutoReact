/**
 * Component Extraction & Definition Engine
 * Identifies native Figma components, component sets, variants, and inferred reusable patterns,
 * mapping their properties, variants, and direct dependencies.
 */

import { ComponentTypes, createIRComponent } from './schema.js';

/**
 * Extract component properties and variants from component set node
 * @param {Object} node - Figma COMPONENT_SET node
 * @returns {{ variants: Array, properties: Object }}
 */
const extractComponentSetVariants = (node) => {
  const variants = [];
  const propertyOptions = {}; // propName -> Set of values

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (child.type === 'COMPONENT') {
        const variantProps = {};
        // Figma variant names are typically "Property1=Value1, Property2=Value2"
        if (child.name && child.name.includes('=')) {
          const parts = child.name.split(',').map(s => s.trim());
          for (const part of parts) {
            const [key, val] = part.split('=').map(s => s.trim());
            if (key && val) {
              variantProps[key] = val;
              if (!propertyOptions[key]) propertyOptions[key] = new Set();
              propertyOptions[key].add(val);
            }
          }
        }

        variants.push({
          variantId: child.id,
          name: child.name,
          sourceNodeId: child.id,
          properties: variantProps,
        });
      }
    }
  }

  const propertiesSchema = {};
  for (const [key, optionsSet] of Object.entries(propertyOptions)) {
    const options = Array.from(optionsSet);
    propertiesSchema[key] = {
      type: 'variant',
      defaultValue: options[0] || null,
      options,
    };
  }

  return { variants, properties: propertiesSchema };
};

/**
 * Scan a subtree and collect all contained node IDs, nested instances, and referenced assets
 * @param {Object} rootNode
 * @returns {{ allNodeIds: string[], nestedComponentIds: string[], assetIds: string[] }}
 */
export const collectSubtreeReferences = (rootNode) => {
  const allNodeIds = [];
  const nestedComponentIds = [];
  const assetIds = [];

  const walk = (node) => {
    if (!node || typeof node !== 'object') return;

    if (node.id) {
      allNodeIds.push(String(node.id));
    }

    if (node.type === 'INSTANCE' && (node.componentId || node.metadata?.componentId)) {
      const targetId = node.componentId || node.metadata?.componentId;
      nestedComponentIds.push(String(targetId));
    }

    if (node.assets && Array.isArray(node.assets)) {
      for (const a of node.assets) {
        if (a?.assetId) assetIds.push(String(a.assetId));
      }
    } else if (node.asset?.assetId) {
      assetIds.push(String(node.asset.assetId));
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child);
      }
    }
  };

  walk(rootNode);

  return {
    allNodeIds: Array.from(new Set(allNodeIds)),
    nestedComponentIds: Array.from(new Set(nestedComponentIds)),
    assetIds: Array.from(new Set(assetIds)),
  };
};

/**
 * Extract component definitions from normalized tree or pages
 * @param {Array<Object>|Object} input - Pages or root tree
 * @param {Object} [options]
 * @returns {Array<Object>} List of DesignIRComponent objects
 */
export const extractComponents = (input, options = {}) => {
  const components = [];
  const seenComponentIds = new Set();

  const traverse = (node) => {
    if (!node || typeof node !== 'object') return;

    // 1. Native Figma Component Set (Container of Variants)
    if (node.type === 'COMPONENT_SET' && !seenComponentIds.has(node.id)) {
      seenComponentIds.add(node.id);
      const { variants, properties } = extractComponentSetVariants(node);
      const refs = collectSubtreeReferences(node);

      components.push(
        createIRComponent({
          id: node.id,
          name: node.name || 'ComponentSet',
          sourceNodeId: node.id,
          componentType: ComponentTypes.COMPONENT_SET,
          variants,
          properties,
          dependencies: {
            componentIds: refs.nestedComponentIds,
            assetIds: refs.assetIds,
            tokenKeys: [],
            allNodeIds: refs.allNodeIds,
          },
          children: node,
        })
      );
    }

    // 2. Native Figma Component (Standalone or variant)
    else if (node.type === 'COMPONENT' && !seenComponentIds.has(node.id)) {
      seenComponentIds.add(node.id);
      const refs = collectSubtreeReferences(node);

      // Infer basic text props from child text nodes
      const properties = {};
      const childTexts = [];
      const findTexts = (n) => {
        if (n?.type === 'TEXT' && n.text) childTexts.push(n);
        if (Array.isArray(n?.children)) n.children.forEach(findTexts);
      };
      findTexts(node);

      childTexts.forEach((t, idx) => {
        const propKey = idx === 0 ? 'label' : `text_${idx}`;
        properties[propKey] = {
          type: 'string',
          defaultValue: t.text,
          nodeId: t.id,
        };
      });

      components.push(
        createIRComponent({
          id: node.id,
          name: node.name || 'Component',
          sourceNodeId: node.id,
          componentType: ComponentTypes.NATIVE_FIGMA,
          variants: [],
          properties,
          dependencies: {
            componentIds: refs.nestedComponentIds,
            assetIds: refs.assetIds,
            tokenKeys: [],
            allNodeIds: refs.allNodeIds,
          },
          children: node,
        })
      );
    }

    // 3. Inferred Composite Patterns (e.g. Navbar, Modal, Card, Button if not already component)
    else if (
      ['Button', 'Card', 'Navbar', 'Modal'].includes(node.semanticType) &&
      !seenComponentIds.has(node.id) &&
      node.type !== 'INSTANCE'
    ) {
      if (options.includeInferredComponents) {
        seenComponentIds.add(node.id);
        const refs = collectSubtreeReferences(node);

        components.push(
          createIRComponent({
            id: `inferred_${node.id}`,
            name: node.name || `${node.semanticType}Pattern`,
            sourceNodeId: node.id,
            componentType: ComponentTypes.INFERRED_PATTERN,
            variants: [],
            properties: {},
            dependencies: {
              componentIds: refs.nestedComponentIds,
              assetIds: refs.assetIds,
              tokenKeys: [],
              allNodeIds: refs.allNodeIds,
            },
            children: node,
          })
        );
      }
    }

    // Recursively walk children
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  };

  if (Array.isArray(input)) {
    for (const item of input) {
      traverse(item);
    }
  } else {
    traverse(input);
  }

  return components;
};


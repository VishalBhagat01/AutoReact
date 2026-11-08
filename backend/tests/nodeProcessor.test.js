import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { processNode } from '../src/utils/nodeProcessor.js';

describe('Node Processor and Extraction', () => {
  it('processes and normalizes a standard FRAME node', () => {
    const rawNode = {
      id: '1:1',
      name: 'Main Container',
      type: 'FRAME',
      visible: true,
      layoutMode: 'HORIZONTAL',
      primaryAxisAlignItems: 'CENTER',
      counterAxisAlignItems: 'CENTER',
      itemSpacing: 16,
      paddingLeft: 24,
      paddingRight: 24,
      paddingTop: 12,
      paddingBottom: 12,
      absoluteBoundingBox: { x: 10.4, y: 20.8, width: 400.2, height: 60.1 },
      fills: [
        { type: 'SOLID', color: { r: 0.1, g: 0.2, b: 0.3, a: 1 } },
      ],
      children: [
        {
          id: '1:2',
          name: 'Label',
          type: 'TEXT',
          characters: 'Hello World',
          style: { fontSize: 16, fontFamily: 'Inter', fontWeight: 500 },
          absoluteBoundingBox: { x: 34, y: 32, width: 100, height: 24 },
        },
      ],
    };

    const processed = processNode(rawNode);

    assert.equal(processed.id, '1:1');
    assert.equal(processed.name, 'Main Container');
    assert.equal(processed.type, 'FRAME');

    // Layout check
    assert.equal(processed.layout.mode, 'row');
    assert.equal(processed.layout.justifyContent, 'center');
    assert.equal(processed.layout.alignItems, 'center');
    assert.equal(processed.layout.gap, 16);

    // Bounds check
    assert.equal(processed.bounds.x, 10);
    assert.equal(processed.bounds.y, 21);
    assert.equal(processed.bounds.width, 400);
    assert.equal(processed.bounds.height, 60);

    // Children check
    assert.equal(processed.children.length, 1);
    assert.equal(processed.children[0].text, 'Hello World');
  });

  it('filters out decorative tiny nodes', () => {
    const tinyNode = {
      id: '2:1',
      name: 'Tiny noise',
      type: 'RECTANGLE',
      absoluteBoundingBox: { x: 0, y: 0, width: 3, height: 3 },
    };

    const processed = processNode(tinyNode, { includeDecorative: false });
    assert.equal(processed, null);
  });

  it('filters out invisible layers', () => {
    const hiddenNode = {
      id: '3:1',
      name: 'Hidden Layer',
      type: 'FRAME',
      visible: false,
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
    };

    const processed = processNode(hiddenNode);
    assert.equal(processed, null);
  });
});


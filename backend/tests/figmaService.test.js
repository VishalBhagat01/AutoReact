import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDesignTree,
  parseDesignTreeBasic,
  countNodes,
} from '../src/services/figmaService.js';

describe('Figma Service Parsing Pipeline', () => {
  const mockFigmaDoc = {
    name: 'Sample App Design',
    version: '1.2.0',
    document: {
      id: '0:0',
      type: 'DOCUMENT',
      children: [
        {
          id: '0:1',
          name: 'Page 1',
          type: 'CANVAS',
          children: [
            {
              id: '1:1',
              name: 'App Header Navbar',
              type: 'FRAME',
              absoluteBoundingBox: { x: 0, y: 10, width: 1200, height: 70 },
              layoutMode: 'HORIZONTAL',
              children: [
                {
                  id: '1:2',
                  name: 'Logo Title',
                  type: 'TEXT',
                  characters: 'Reagmat',
                  style: { fontSize: 24, fontWeight: 700 },
                },
                {
                  id: '1:3',
                  name: 'Sign In Button',
                  type: 'FRAME',
                  absoluteBoundingBox: { x: 1000, y: 20, width: 100, height: 40 },
                  children: [
                    { id: '1:4', name: 'Text', type: 'TEXT', characters: 'Sign In' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };

  it('parses Figma JSON document into normalized tree with semantic classification', () => {
    const parsed = parseDesignTree(mockFigmaDoc);

    assert.equal(parsed.fileName, 'Sample App Design');
    assert.equal(parsed.fileVersion, '1.2.0');
    assert.equal(parsed.pages.length, 1);

    const page = parsed.pages[0];
    assert.equal(page.name, 'Page 1');
    assert.ok(page.children.length > 0);

    const navbar = page.children[0];
    assert.equal(navbar.name, 'App Header Navbar');
    assert.equal(navbar.semanticType, 'Navbar');
    assert.ok(navbar.confidence > 0.6);
  });

  it('parseDesignTreeBasic works equivalently with default options', () => {
    const parsed = parseDesignTreeBasic(mockFigmaDoc);
    assert.equal(parsed.fileName, 'Sample App Design');
    assert.equal(parsed.pages.length, 1);
  });

  it('countNodes calculates recursive node count accurately', () => {
    const total = countNodes(mockFigmaDoc.document);
    // 0:0, 0:1, 1:1, 1:2, 1:3, 1:4 = 6 nodes
    assert.equal(total, 6);
  });

  it('throws error for invalid Figma data', () => {
    assert.throws(() => parseDesignTree(null), {
      message: /Invalid Figma data structure/,
    });
    assert.throws(() => parseDesignTree({}), {
      message: /Invalid Figma data structure/,
    });
  });
});

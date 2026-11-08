import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Regression Test: Verify semanticEngine import does not throw ERR_MODULE_NOT_FOUND
import { analyzeSemanticTree, classifyNode } from '../src/services/figma/semantic/semanticEngine.js';
import { SemanticTypes, semanticTypeToReactComponent } from '../src/services/figma/semantic/constants.js';
import { classifyNodeSemantically, getSemanticDSLSummary } from '../src/utils/semanticClassifier.js';

describe('Semantic Engine and Detectors', () => {
  it('REGRESSION: imports analyzeSemanticTree without ERR_MODULE_NOT_FOUND', () => {
    assert.equal(typeof analyzeSemanticTree, 'function');
    assert.equal(typeof classifyNode, 'function');
  });

  describe('Individual Detectors via analyzeSemanticTree', () => {
    it('classifies a Button correctly with high confidence', () => {
      const buttonNode = {
        id: '1:10',
        name: 'Submit Button',
        type: 'FRAME',
        bounds: { x: 50, y: 100, width: 140, height: 44 },
        styles: {
          colors: [{ type: 'SOLID', hex: '#2563EB', opacity: 1 }],
          borderRadius: { all: 8 },
        },
        children: [
          {
            id: '1:11',
            name: 'Submit',
            type: 'TEXT',
            text: 'Submit',
            bounds: { x: 80, y: 112, width: 80, height: 20 },
            styles: { typography: { fontSize: 14, fontWeight: 600 } },
          },
        ],
      };

      const result = analyzeSemanticTree(buttonNode);
      assert.equal(result.semanticType, SemanticTypes.BUTTON);
      assert.ok(result.confidence > 0.6);
      assert.equal(result.suggestedComponent, 'Button');
      assert.ok(result.reasoning.length > 0);
    });

    it('classifies Heading nodes based on font size and weight', () => {
      const headingNode = {
        id: '2:1',
        name: 'Hero Title',
        type: 'TEXT',
        text: 'Welcome to Reagmat',
        styles: {
          typography: {
            fontSize: 36,
            fontWeight: 800,
          },
        },
      };

      const result = analyzeSemanticTree(headingNode);
      assert.equal(result.semanticType, SemanticTypes.HEADING_1);
      assert.ok(result.confidence > 0.6);
      assert.equal(result.suggestedComponent, 'Heading');
      assert.equal(result.suggestedProps.level, 1);
    });

    it('classifies Input fields by stroke and dimensions', () => {
      const inputNode = {
        id: '3:1',
        name: 'Email input field',
        type: 'FRAME',
        bounds: { x: 20, y: 50, width: 320, height: 44 },
        styles: {
          stroke: { color: '#D1D5DB', width: 1 },
          colors: [{ type: 'SOLID', hex: '#FFFFFF', opacity: 1 }],
        },
        children: [
          {
            id: '3:2',
            name: 'Placeholder',
            type: 'TEXT',
            text: 'name@example.com',
            styles: { typography: { fontSize: 14 } },
          },
        ],
      };

      const result = analyzeSemanticTree(inputNode);
      assert.equal(result.semanticType, SemanticTypes.INPUT_FIELD);
      assert.ok(result.confidence > 0.6);
      assert.equal(result.suggestedComponent, 'Input');
    });

    it('classifies a Card with visual styling and mixed children', () => {
      const cardNode = {
        id: '4:1',
        name: 'Feature Card',
        type: 'FRAME',
        bounds: { x: 0, y: 0, width: 350, height: 240 },
        styles: {
          colors: [{ type: 'SOLID', hex: '#FFFFFF', opacity: 1 }],
          borderRadius: { all: 16 },
          effects: [{ type: 'shadow', blur: 10, color: '#000000' }],
        },
        children: [
          {
            id: '4:2',
            name: 'Title',
            type: 'TEXT',
            styles: { typography: { fontSize: 20, fontWeight: 700 } },
          },
          {
            id: '4:3',
            name: 'Description',
            type: 'TEXT',
            styles: { typography: { fontSize: 14 } },
          },
          {
            id: '4:4',
            name: 'Learn More Button',
            type: 'FRAME',
            bounds: { x: 20, y: 180, width: 120, height: 36 },
            styles: { colors: [{ hex: '#000' }] },
          },
        ],
      };

      const result = analyzeSemanticTree(cardNode);
      assert.equal(result.semanticType, SemanticTypes.CARD);
      assert.ok(result.confidence > 0.6);
      assert.equal(result.suggestedComponent, 'Card');
    });

    it('classifies a Badge / Tag correctly', () => {
      const badgeNode = {
        id: '5:1',
        name: 'Status badge',
        type: 'FRAME',
        bounds: { x: 10, y: 10, width: 68, height: 24 },
        styles: {
          borderRadius: { all: 12 },
          colors: [{ type: 'SOLID', hex: '#DEF7EC' }],
        },
        children: [
          {
            id: '5:2',
            name: 'Active',
            type: 'TEXT',
            text: 'Active',
            styles: { typography: { fontSize: 12 } },
          },
        ],
      };

      const result = analyzeSemanticTree(badgeNode);
      assert.equal(result.semanticType, SemanticTypes.BADGE);
      assert.ok(result.confidence > 0.6);
      assert.equal(result.suggestedComponent, 'Badge');
    });

    it('classifies an Avatar with 1:1 aspect ratio', () => {
      const avatarNode = {
        id: '6:1',
        name: 'User avatar profile',
        type: 'ELLIPSE',
        bounds: { x: 10, y: 10, width: 48, height: 48 },
        styles: {
          colors: [{ type: 'IMAGE', hex: '#CCCCCC' }],
        },
      };

      const result = analyzeSemanticTree(avatarNode);
      assert.equal(result.semanticType, SemanticTypes.AVATAR);
      assert.ok(result.confidence > 0.6);
      assert.equal(result.suggestedComponent, 'Avatar');
    });

    it('classifies a FormField composite component', () => {
      const formFieldNode = {
        id: '7:1',
        name: 'Username form-field',
        type: 'FRAME',
        children: [
          {
            id: '7:2',
            name: 'Label',
            type: 'TEXT',
            text: 'Username',
            styles: { typography: { fontSize: 12 } },
          },
          {
            id: '7:3',
            name: 'Username input',
            type: 'FRAME',
            bounds: { x: 0, y: 20, width: 280, height: 40 },
            styles: { stroke: { width: 1, color: '#CCC' } },
            children: [{ id: '7:4', name: 'Placeholder', type: 'TEXT', text: 'Enter username' }],
          },
        ],
      };

      const result = analyzeSemanticTree(formFieldNode);
      assert.equal(result.semanticType, SemanticTypes.FORM_FIELD);
      assert.ok(result.confidence > 0.6);
      assert.equal(result.suggestedComponent, 'FormField');
    });
  });

  describe('Backward-compatible semanticClassifier Adapter', () => {
    it('provides classifyNodeSemantically with 0-100 confidence', () => {
      const node = {
        id: '8:1',
        name: 'Submit Button',
        type: 'FRAME',
        bounds: { x: 0, y: 0, width: 120, height: 40 },
        children: [{ id: '8:2', name: 'Submit', type: 'TEXT', text: 'Submit' }],
      };

      const result = classifyNodeSemantically(node);
      assert.equal(result.semanticType, SemanticTypes.BUTTON);
      assert.ok(result.confidence >= 60 && result.confidence <= 100);
    });

    it('provides getSemanticDSLSummary', () => {
      const node = {
        id: '8:3',
        name: 'Action Button',
        type: 'FRAME',
        bounds: { x: 0, y: 0, width: 100, height: 40 },
        children: [{ id: '8:4', name: 'Go', type: 'TEXT', text: 'Go' }],
      };

      const summary = getSemanticDSLSummary(node);
      assert.equal(summary.nodeId, '8:3');
      assert.equal(summary.suggestedComponent, 'Button');
      assert.ok(summary.tailwindClasses.includes('rounded'));
    });
  });
});


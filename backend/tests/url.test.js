import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractFileKey,
  extractNodeId,
  normalizeNodeId,
  isValidFigmaUrl,
  parseFigmaUrl,
} from '../src/utility/url.js';

describe('Figma URL Parsing Utilities', () => {
  const sampleKey = 'FSb84hF9gU12Abc';

  describe('extractFileKey', () => {
    it('extracts file key from standard /file/ URL', () => {
      const url = `https://www.figma.com/file/${sampleKey}/Design-System`;
      assert.equal(extractFileKey(url), sampleKey);
    });

    it('extracts file key from modern /design/ URL', () => {
      const url = `https://www.figma.com/design/${sampleKey}/Dashboard-App`;
      assert.equal(extractFileKey(url), sampleKey);
    });

    it('extracts file key from prototype /proto/ URL', () => {
      const url = `https://www.figma.com/proto/${sampleKey}/Interactive-Prototype`;
      assert.equal(extractFileKey(url), sampleKey);
    });

    it('extracts file key without trailing name slug', () => {
      const url = `https://www.figma.com/file/${sampleKey}`;
      assert.equal(extractFileKey(url), sampleKey);
    });

    it('returns null for non-Figma URLs', () => {
      assert.equal(extractFileKey('https://example.com/file/12345'), null);
      assert.equal(extractFileKey('https://github.com/design/12345'), null);
    });

    it('returns null for invalid inputs', () => {
      assert.equal(extractFileKey(''), null);
      assert.equal(extractFileKey(null), null);
      assert.equal(extractFileKey(undefined), null);
      assert.equal(extractFileKey(12345), null);
    });
  });

  describe('normalizeNodeId & extractNodeId', () => {
    it('normalizes standard colon node IDs', () => {
      assert.equal(normalizeNodeId('1:23'), '1:23');
      assert.equal(normalizeNodeId('104:567'), '104:567');
    });

    it('normalizes URL-encoded colon node IDs (%3A)', () => {
      assert.equal(normalizeNodeId('1%3A23'), '1:23');
      assert.equal(normalizeNodeId('50%3A120'), '50:120');
    });

    it('normalizes hyphenated node IDs from modern Figma URLs (1-23)', () => {
      assert.equal(normalizeNodeId('1-23'), '1:23');
      assert.equal(normalizeNodeId('402-881'), '402:881');
    });

    it('extracts node ID from URL query parameters', () => {
      const url = `https://www.figma.com/design/${sampleKey}/App?node-id=4-102&scaling=scale-down`;
      assert.equal(extractNodeId(url), '4:102');
    });

    it('extracts URL-encoded node ID from query parameters', () => {
      const url = `https://www.figma.com/file/${sampleKey}/App?t=abc1234&node-id=12%3A34`;
      assert.equal(extractNodeId(url), '12:34');
    });

    it('returns null when no node-id is present in URL', () => {
      const url = `https://www.figma.com/file/${sampleKey}/App`;
      assert.equal(extractNodeId(url), null);
    });
  });

  describe('isValidFigmaUrl & parseFigmaUrl', () => {
    it('validates legitimate Figma URLs', () => {
      assert.equal(isValidFigmaUrl(`https://www.figma.com/file/${sampleKey}/Test`), true);
      assert.equal(isValidFigmaUrl(`https://figma.com/design/${sampleKey}`), true);
    });

    it('rejects invalid or malformed URLs', () => {
      assert.equal(isValidFigmaUrl('https://figma.com/about'), false);
      assert.equal(isValidFigmaUrl('not-a-url'), false);
      assert.equal(isValidFigmaUrl(''), false);
    });

    it('parses complete URL metadata', () => {
      const url = `https://www.figma.com/design/${sampleKey}/ECommerce?node-id=2-45&t=xyz`;
      const meta = parseFigmaUrl(url);

      assert.equal(meta.isValid, true);
      assert.equal(meta.fileKey, sampleKey);
      assert.equal(meta.nodeId, '2:45');
      assert.equal(meta.type, 'design');
    });

    it('handles failure in parseFigmaUrl gracefully', () => {
      const meta = parseFigmaUrl('invalid');
      assert.equal(meta.isValid, false);
      assert.equal(meta.fileKey, null);
    });
  });
});


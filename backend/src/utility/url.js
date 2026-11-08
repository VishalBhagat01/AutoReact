/**
 * Figma URL Parsing and Validation Utilities
 * Fully migrated to ES Modules (ESM)
 */

/**
 * Normalize a raw Figma node ID into the standard Figma API colon format (e.g. '1:23')
 * Handles URL encoding (%3A) and modern dash format (1-23)
 * @param {string} rawNodeId - Raw node ID from URL query
 * @returns {string|null} Normalized node ID or null
 */
export const normalizeNodeId = (rawNodeId) => {
  if (!rawNodeId || typeof rawNodeId !== 'string') return null;

  // 1. Decode URI components (e.g., %3A -> :)
  let decoded = decodeURIComponent(rawNodeId.trim());

  // 2. If already contains colon (e.g. "1:23"), validate and return
  if (decoded.includes(':')) {
    return decoded;
  }

  // 3. Modern Figma URLs format node-id as "1-23" or "0-1"
  // Normalize hyphen to colon if it matches the digit-digit pattern
  if (/^\d+-\d+$/.test(decoded)) {
    return decoded.replace('-', ':');
  }

  return decoded;
};

/**
 * Extract Figma file key from URL
 * Supports:
 * - https://www.figma.com/file/KEY/...
 * - https://www.figma.com/design/KEY/...
 * - https://www.figma.com/proto/KEY/...
 * @param {string} url - Figma URL
 * @returns {string|null} File key or null if invalid
 */
export const extractFileKey = (url) => {
  if (!url || typeof url !== 'string') return null;

  const patterns = [
    /figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/,
    /figma\.com\/proto\/([a-zA-Z0-9]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
};

/**
 * Extract and normalize node ID from Figma URL if present
 * Supports ?node-id=1:23, ?node-id=1%3A23, ?node-id=1-23
 * @param {string} url - Figma URL
 * @returns {string|null} Normalized node ID or null
 */
export const extractNodeId = (url) => {
  if (!url || typeof url !== 'string') return null;

  try {
    // Attempt standard URL query parameter extraction
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const rawNodeId = urlObj.searchParams.get('node-id');
    if (rawNodeId) {
      return normalizeNodeId(rawNodeId);
    }
  } catch {
    // Fallback regex for non-standard or partial URL strings
    const match = url.match(/[?&]node-id=([^&#]+)/);
    if (match && match[1]) {
      return normalizeNodeId(match[1]);
    }
  }

  return null;
};

/**
 * Check if a URL is a valid Figma file or design URL
 * @param {string} url - URL string to validate
 * @returns {boolean} True if valid Figma URL with an extractable key
 */
export const isValidFigmaUrl = (url) => {
  return extractFileKey(url) !== null;
};

/**
 * Parse a Figma URL and extract comprehensive metadata
 * @param {string} url - Figma URL
 * @returns {Object} Parsed URL object
 */
export const parseFigmaUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return {
      isValid: false,
      error: 'URL is required and must be a string',
      fileKey: null,
      nodeId: null,
    };
  }

  const fileKey = extractFileKey(url);
  if (!fileKey) {
    return {
      isValid: false,
      error: 'Invalid Figma URL. Could not extract file key.',
      fileKey: null,
      nodeId: null,
    };
  }

  const nodeId = extractNodeId(url);
  const isDesign = url.includes('/design/');
  const isProto = url.includes('/proto/');

  return {
    isValid: true,
    fileKey,
    nodeId,
    type: isProto ? 'proto' : (isDesign ? 'design' : 'file'),
    originalUrl: url,
  };
};

export default {
  extractFileKey,
  extractNodeId,
  normalizeNodeId,
  isValidFigmaUrl,
  parseFigmaUrl,
};

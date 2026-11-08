import { parseFigmaUrl, isValidFigmaUrl, normalizeNodeId, extractFileKey } from '../utility/url.js';
import { AppError } from './errorHandler.js';

/**
 * Middleware to validate Figma URL import requests
 */
export const validateFigmaImportRequest = (req, res, next) => {
  const { url } = req.body || {};

  if (!url) {
    return next(new AppError('Figma URL is required in request body', 400, 'MISSING_URL'));
  }

  if (typeof url !== 'string') {
    return next(new AppError('Figma URL must be a string', 400, 'INVALID_URL_TYPE'));
  }

  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return next(new AppError('Figma URL cannot be empty', 400, 'EMPTY_URL'));
  }

  if (!isValidFigmaUrl(trimmed)) {
    return next(
      new AppError(
        'Invalid Figma URL format. Expected: https://www.figma.com/file/:key or https://www.figma.com/design/:key',
        400,
        'INVALID_FIGMA_URL'
      )
    );
  }

  // Attach pre-parsed metadata to request for controllers to consume
  req.figmaMeta = parseFigmaUrl(trimmed);
  return next();
};

/**
 * Middleware to validate selective node retrieval requests
 * Supports { url: string } with ?node-id=... OR { fileKey: string, nodeIds: string[] | string }
 */
export const validateSelectiveNodesRequest = (req, res, next) => {
  const { url, fileKey: rawFileKey, nodeIds: rawNodeIds } = req.body || {};

  let fileKey = rawFileKey ? String(rawFileKey).trim() : null;
  let nodeIds = [];

  if (url) {
    if (typeof url !== 'string' || !isValidFigmaUrl(url)) {
      return next(
        new AppError(
          'Invalid Figma URL format. Expected: https://www.figma.com/file/:key or https://www.figma.com/design/:key',
          400,
          'INVALID_FIGMA_URL'
        )
      );
    }

    const parsed = parseFigmaUrl(url);
    if (!fileKey) {
      fileKey = parsed.fileKey;
    }

    if (parsed.nodeId) {
      nodeIds.push(parsed.nodeId);
    }
  }

  if (!fileKey) {
    return next(
      new AppError(
        'Figma URL or fileKey is required in request body',
        400,
        'MISSING_FILE_IDENTIFIER'
      )
    );
  }

  // Append any explicitly provided nodeIds
  if (rawNodeIds) {
    if (Array.isArray(rawNodeIds)) {
      nodeIds.push(...rawNodeIds);
    } else if (typeof rawNodeIds === 'string') {
      const split = rawNodeIds.split(',').map(s => s.trim()).filter(Boolean);
      nodeIds.push(...split);
    }
  }

  // Normalize node IDs
  const normalizedIds = Array.from(
    new Set(
      nodeIds
        .map(id => (typeof id === 'string' ? normalizeNodeId(id.trim()) : null))
        .filter(Boolean)
    )
  );

  if (normalizedIds.length === 0) {
    return next(
      new AppError(
        'At least one node ID must be provided in nodeIds or via node-id in the Figma URL',
        400,
        'MISSING_NODE_IDS'
      )
    );
  }

  req.selectiveNodesMeta = {
    fileKey,
    nodeIds: normalizedIds,
  };

  return next();
};

/**
 * Middleware to validate asset export requests
 */
export const validateAssetExportRequest = (req, res, next) => {
  const {
    url,
    fileKey: rawFileKey,
    nodeIds: rawNodeIds,
    format = 'png',
    scale = 1,
    projectId,
  } = req.body || {};

  let fileKey = rawFileKey ? String(rawFileKey).trim() : null;
  let nodeIds = [];

  if (url) {
    if (typeof url !== 'string' || !isValidFigmaUrl(url)) {
      return next(
        new AppError(
          'Invalid Figma URL format for asset export',
          400,
          'INVALID_FIGMA_URL'
        )
      );
    }
    const parsed = parseFigmaUrl(url);
    if (!fileKey) fileKey = parsed.fileKey;
    if (parsed.nodeId) nodeIds.push(parsed.nodeId);
  }

  if (!fileKey) {
    return next(
      new AppError(
        'Figma URL or fileKey is required for asset export',
        400,
        'MISSING_FILE_IDENTIFIER'
      )
    );
  }

  // Append explicitly provided nodeIds
  if (rawNodeIds) {
    if (Array.isArray(rawNodeIds)) {
      nodeIds.push(...rawNodeIds);
    } else if (typeof rawNodeIds === 'string') {
      const split = rawNodeIds.split(',').map(s => s.trim()).filter(Boolean);
      nodeIds.push(...split);
    }
  }

  const normalizedIds = Array.from(
    new Set(
      nodeIds
        .map(id => (typeof id === 'string' ? normalizeNodeId(id.trim()) : null))
        .filter(Boolean)
    )
  );

  // Validate format
  const validFormats = ['png', 'svg', 'jpg', 'jpeg', 'pdf'];
  const cleanFormat = String(format).toLowerCase().trim();
  if (!validFormats.includes(cleanFormat)) {
    return next(
      new AppError(
        `Unsupported export format: ${format}. Supported formats: ${validFormats.join(', ')}`,
        400,
        'INVALID_EXPORT_FORMAT'
      )
    );
  }

  // Validate scale
  const numScale = Number(scale);
  if (isNaN(numScale) || numScale < 0.01 || numScale > 4) {
    return next(
      new AppError(
        'Export scale must be a number between 0.01 and 4',
        400,
        'INVALID_EXPORT_SCALE'
      )
    );
  }

  req.assetExportMeta = {
    fileKey,
    nodeIds: normalizedIds,
    format: cleanFormat,
    scale: numScale,
    projectId: projectId || null,
  };

  return next();
};


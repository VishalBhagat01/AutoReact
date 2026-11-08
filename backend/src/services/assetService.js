import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import axios from 'axios';
import { Asset } from '../models/Asset.js';
import { exportFigmaImages } from './figmaService.js';
import { AppError } from '../middleware/errorHandler.js';
import { isDbConnected } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backend root directory
const BACKEND_ROOT = path.resolve(__dirname, '../..');

/**
 * Get resolved absolute storage directory for visual assets
 * Configurable via ASSET_STORAGE_DIR environment variable
 * Defaults to backend/storage/assets
 * @returns {string} Absolute path to asset storage directory
 */
export const getStorageDir = () => {
  const dir = process.env.ASSET_STORAGE_DIR
    ? path.resolve(process.env.ASSET_STORAGE_DIR)
    : path.resolve(BACKEND_ROOT, 'storage/assets');

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

/**
 * Validate that a target path is strictly contained within base directory (prevents path traversal)
 * @param {string} baseDir - Trusted base directory
 * @param {string} targetPath - Path to validate
 * @returns {boolean} True if path is safe and inside baseDir
 */
export const isSafePath = (baseDir, targetPath) => {
  if (!baseDir || !targetPath) return false;
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);
  return (
    resolvedTarget.startsWith(resolvedBase + path.sep) ||
    resolvedTarget === resolvedBase
  );
};

/**
 * Sanitize Figma node ID for cross-platform safe filesystem naming
 * Replaces illegal characters like ':', ';', '/', '\' with hyphens or underscores
 * @param {string} nodeId - Figma node ID (e.g., '1:23' or 'I12:34;5:67')
 * @returns {string} Sanitized filesystem-safe string (e.g., '1-23' or 'I12-34_5-67')
 */
export const sanitizeNodeId = (nodeId) => {
  if (!nodeId || typeof nodeId !== 'string') return 'unknown_node';
  return nodeId
    .replace(/:/g, '-')
    .replace(/;/g, '_')
    .replace(/[\\/*?"<>|]/g, '_');
};

/**
 * Sanitize Figma file key (alphanumeric validation)
 * @param {string} fileKey - Figma file key
 * @returns {string} Sanitized file key
 */
export const sanitizeFileKey = (fileKey) => {
  if (!fileKey || typeof fileKey !== 'string') return '';
  return fileKey.replace(/[^a-zA-Z0-9_-]/g, '');
};

/**
 * Generate standard asset filename
 * @param {string} nodeId - Figma node ID
 * @param {number} scale - Export scale
 * @param {string} format - File format extension (png, svg, jpg)
 * @returns {string} Formatted filename (e.g., '1-23_1x.png')
 */
export const getAssetFilename = (nodeId, scale = 1, format = 'png') => {
  const safeId = sanitizeNodeId(nodeId);
  const cleanFormat = (format || 'png').toLowerCase().replace(/^\./, '');
  return `${safeId}_${scale}x.${cleanFormat}`;
};

/**
 * Identify all visual asset candidates in a normalized design tree
 * Scans for:
 * 1. Image fills (styles.images or fills of type IMAGE)
 * 2. Vector nodes (VECTOR, STAR, LINE, POLYGON, BOOLEAN_OPERATION)
 * 3. Icon nodes (semanticType === 'icon' or matching icon naming patterns)
 * 
 * @param {Object|Array} root - Normalized node or array of page nodes
 * @returns {Array<Object>} List of candidate asset descriptors
 */
export const identifyAssetCandidates = (root) => {
  const candidates = [];
  const seenNodeIds = new Set();

  const traverse = (node) => {
    if (!node || typeof node !== 'object') return;

    if (node.id && !seenNodeIds.has(node.id)) {
      let isCandidate = false;
      let assetType = 'image';
      let suggestedFormat = 'png';
      let imageRef = null;

      // 1. Check for image fills in styles.images or raw fills
      if (node.styles?.images?.length > 0) {
        isCandidate = true;
        assetType = 'image';
        suggestedFormat = 'png';
        imageRef = node.styles.images[0].imageRef || null;
      } else if (node.fills && Array.isArray(node.fills)) {
        const imageFill = node.fills.find(f => f.type === 'IMAGE' && f.visible !== false);
        if (imageFill) {
          isCandidate = true;
          assetType = 'image';
          suggestedFormat = 'png';
          imageRef = imageFill.imageRef || null;
        }
      }

      // 2. Check for vector shapes
      const vectorTypes = ['VECTOR', 'STAR', 'LINE', 'POLYGON', 'BOOLEAN_OPERATION'];
      if (!isCandidate && vectorTypes.includes(node.type)) {
        isCandidate = true;
        assetType = 'vector_svg';
        suggestedFormat = 'svg';
      }

      // 3. Check for icon semantics or naming
      const isIconSemantic = node.semanticType === 'icon' || node.semantics?.type === 'icon';
      const isIconName = typeof node.name === 'string' && /(?:^|[-_ ])icon(?:[-_ ]|$)|svg|logo/i.test(node.name);

      if (!isCandidate && (isIconSemantic || isIconName)) {
        isCandidate = true;
        assetType = 'icon';
        suggestedFormat = 'svg';
      }

      if (isCandidate) {
        seenNodeIds.add(node.id);
        candidates.push({
          nodeId: node.id,
          name: node.name,
          type: node.type,
          assetType,
          suggestedFormat,
          imageRef,
          dimensions: node.bounds
            ? { width: node.bounds.width, height: node.bounds.height }
            : null,
        });
      }
    }

    // Traverse children
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  };

  if (Array.isArray(root)) {
    for (const item of root) {
      traverse(item);
    }
  } else {
    traverse(root);
  }

  return candidates;
};

/**
 * Download asset binary data from remote URL with size limit, timeout, and checksum verification
 * @param {string} url - Remote image URL (e.g. Figma S3 URL)
 * @param {Object} [options] - Download options
 * @returns {Promise<{ buffer: Buffer, mimeType: string, checksum: string, fileSize: number }>}
 */
export const downloadAsset = async (url, options = {}) => {
  if (!url || typeof url !== 'string') {
    throw new AppError('Asset download URL is required', 400, 'MISSING_DOWNLOAD_URL');
  }

  const {
    timeout = 15000,
    maxBytes = 25 * 1024 * 1024, // 25 MB max
  } = options;

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout,
      maxContentLength: maxBytes,
      maxBodyLength: maxBytes,
      headers: {
        'User-Agent': 'Reagmat-AssetExtractor/1.0',
      },
    });

    const buffer = Buffer.from(response.data);
    const mimeType = response.headers['content-type'] || 'application/octet-stream';
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    return {
      buffer,
      mimeType,
      checksum,
      fileSize: buffer.length,
    };
  } catch (error) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      throw new AppError('Asset download timed out', 504, 'DOWNLOAD_TIMEOUT');
    }
    if (error.response?.status) {
      throw new AppError(
        `Failed to download asset from storage: HTTP ${error.response.status}`,
        error.response.status,
        'DOWNLOAD_FAILED'
      );
    }
    throw new AppError(`Asset download error: ${error.message}`, 500, 'DOWNLOAD_ERROR');
  }
};

/**
 * Save asset binary buffer to disk storage with path traversal protection
 * @param {string} fileKey - Figma file key
 * @param {string} filename - Target filename (e.g. '1-23_1x.png')
 * @param {Buffer} buffer - File data
 * @returns {Promise<{ storagePath: string, fullPath: string, publicUrl: string, fileSize: number }>}
 */
export const saveAssetToDisk = async (fileKey, filename, buffer) => {
  const safeFileKey = sanitizeFileKey(fileKey);
  if (!safeFileKey) {
    throw new AppError('Invalid Figma file key for storage', 400, 'INVALID_FILE_KEY');
  }

  const baseStorageDir = getStorageDir();
  const fileKeyDir = path.join(baseStorageDir, safeFileKey);

  // Validate directory path safety
  if (!isSafePath(baseStorageDir, fileKeyDir)) {
    throw new AppError('Illegal directory path detected', 400, 'PATH_TRAVERSAL_DETECTED');
  }

  if (!fs.existsSync(fileKeyDir)) {
    await fs.promises.mkdir(fileKeyDir, { recursive: true });
  }

  // Validate destination file path safety
  const fullPath = path.join(fileKeyDir, filename);
  if (!isSafePath(fileKeyDir, fullPath)) {
    throw new AppError('Illegal file path detected', 400, 'PATH_TRAVERSAL_DETECTED');
  }

  await fs.promises.writeFile(fullPath, buffer);

  const relativeStoragePath = path.relative(BACKEND_ROOT, fullPath).replace(/\\/g, '/');
  const publicUrl = `/api/assets/${safeFileKey}/${encodeURIComponent(filename)}`;

  return {
    storagePath: relativeStoragePath,
    fullPath,
    publicUrl,
    fileSize: buffer.length,
  };
};

/**
 * Export and download visual assets for selected node IDs or auto-detected candidates
 * Saves binaries to disk and persists metadata records in MongoDB
 * 
 * @param {Object} params
 * @param {string} params.fileKey - Figma file key
 * @param {string|string[]} [params.nodeIds] - Node IDs to export
 * @param {string} [params.format='png'] - Export format ('png', 'svg', 'jpg')
 * @param {number} [params.scale=1] - Export scale factor (0.01 to 4)
 * @param {string} [params.projectId] - MongoDB Project ID reference
 * @param {string} [params.token] - Figma API token
 * @param {Object} [params.nodeDimensionsMap] - Map of nodeId -> { width, height }
 * @param {Object} [params.nodeAssetTypeMap] - Map of nodeId -> assetType ('image', 'vector_svg', etc.)
 * @returns {Promise<{ fileKey: string, exportedCount: number, assets: Array, failedNodeIds: Array }>}
 */
export const exportAndDownloadAssets = async ({
  fileKey,
  nodeIds,
  format = 'png',
  scale = 1,
  projectId = null,
  token = process.env.FIGMA_TOKEN,
  nodeDimensionsMap = {},
  nodeAssetTypeMap = {},
}) => {
  const safeFileKey = sanitizeFileKey(fileKey);
  if (!safeFileKey) {
    throw new AppError('Figma file key is required to export assets', 400, 'MISSING_FILE_KEY');
  }

  const rawIds = Array.isArray(nodeIds) ? nodeIds : nodeIds ? [nodeIds] : [];
  if (rawIds.length === 0) {
    throw new AppError('At least one node ID is required for asset export', 400, 'MISSING_NODE_IDS');
  }

  // 1. Request image export URLs from Figma API
  const exportResult = await exportFigmaImages(safeFileKey, rawIds, { format, scale }, token);
  const imagesMap = exportResult.images || {};

  const savedAssets = [];
  const failedNodeIds = [];

  // 2. Download and store each exported asset
  for (const nodeId of rawIds) {
    const remoteUrl = imagesMap[nodeId];
    if (!remoteUrl) {
      failedNodeIds.push(nodeId);
      continue;
    }

    try {
      const filename = getAssetFilename(nodeId, scale, format);
      const downloadResult = await downloadAsset(remoteUrl);
      const diskResult = await saveAssetToDisk(safeFileKey, filename, downloadResult.buffer);

      const dimensions = nodeDimensionsMap[nodeId] || null;
      const assetType = nodeAssetTypeMap[nodeId] || (format.toLowerCase() === 'svg' ? 'vector_svg' : 'image');

      const assetData = {
        projectId: projectId || null,
        figmaFileKey: safeFileKey,
        figmaNodeId: nodeId,
        assetType,
        format: format.toLowerCase(),
        storagePath: diskResult.storagePath,
        publicUrl: diskResult.publicUrl,
        dimensions: dimensions ? { width: dimensions.width, height: dimensions.height } : undefined,
        exportScale: scale,
        fileSize: diskResult.fileSize,
        mimeType: downloadResult.mimeType,
        checksum: downloadResult.checksum,
      };

      // Persist to MongoDB if connected
      let persistedAsset = assetData;
      if (isDbConnected()) {
        persistedAsset = await Asset.findOneAndUpdate(
          {
            figmaFileKey: safeFileKey,
            figmaNodeId: nodeId,
            format: format.toLowerCase(),
            exportScale: scale,
          },
          { $set: assetData },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        ).lean();
      }

      savedAssets.push(persistedAsset);
    } catch (err) {
      console.error(`⚠️ Failed to download/save asset for node ${nodeId}: ${err.message}`);
      failedNodeIds.push(nodeId);
    }
  }

  return {
    fileKey: safeFileKey,
    exportedCount: savedAssets.length,
    assets: savedAssets,
    failedNodeIds,
  };
};

/**
 * Connect stored asset metadata back to the normalized design tree
 * Modifies tree nodes in-place or returns updated copy
 * Attaches: node.asset = { assetId, assetType, format, publicUrl, scale, dimensions }
 * 
 * @param {Object|Array} rootNode - Normalized node or page list
 * @param {Array<Object>|Object} assets - Array of asset records or map of nodeId -> asset
 * @returns {Object|Array} Updated tree with attached asset references
 */
export const attachAssetsToTree = (rootNode, assets) => {
  if (!rootNode) return rootNode;

  // Build map of nodeId -> asset
  const assetMap = {};
  if (Array.isArray(assets)) {
    for (const a of assets) {
      if (a && a.figmaNodeId) {
        assetMap[a.figmaNodeId] = a;
      }
    }
  } else if (assets && typeof assets === 'object') {
    Object.assign(assetMap, assets);
  }

  const attach = (node) => {
    if (!node || typeof node !== 'object') return;

    if (node.id && assetMap[node.id]) {
      const match = assetMap[node.id];
      node.asset = {
        assetId: match._id || null,
        assetType: match.assetType || 'image',
        format: match.format || 'png',
        publicUrl: match.publicUrl,
        scale: match.exportScale || 1,
        dimensions: match.dimensions || null,
        fileSize: match.fileSize || 0,
      };
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        attach(child);
      }
    }
  };

  if (Array.isArray(rootNode)) {
    for (const item of rootNode) {
      attach(item);
    }
  } else {
    attach(rootNode);
  }

  return rootNode;
};

/**
 * Serve static asset file with path traversal verification
 * @param {string} fileKey - Figma file key
 * @param {string} filename - Stored asset filename
 * @returns {Promise<{ filePath: string, mimeType: string, fileSize: number }>}
 */
export const getAssetFilePath = async (fileKey, filename) => {
  const safeFileKey = sanitizeFileKey(fileKey);
  if (!safeFileKey) {
    throw new AppError('Invalid file key', 400, 'INVALID_FILE_KEY');
  }

  if (!filename || typeof filename !== 'string') {
    throw new AppError('Invalid filename', 400, 'INVALID_FILENAME');
  }

  const baseStorageDir = getStorageDir();
  const fileKeyDir = path.join(baseStorageDir, safeFileKey);
  const targetPath = path.join(fileKeyDir, filename);

  if (!isSafePath(fileKeyDir, targetPath)) {
    throw new AppError('Illegal file path detected', 400, 'PATH_TRAVERSAL_DETECTED');
  }

  try {
    const stat = await fs.promises.stat(targetPath);
    if (!stat.isFile()) {
      throw new AppError('Asset not found', 404, 'ASSET_NOT_FOUND');
    }

    const ext = path.extname(filename).toLowerCase();
    const mimeMap = {
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.pdf': 'application/pdf',
      '.webp': 'image/webp',
    };
    const mimeType = mimeMap[ext] || 'application/octet-stream';

    return {
      filePath: targetPath,
      mimeType,
      fileSize: stat.size,
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new AppError('Asset file not found on disk', 404, 'ASSET_NOT_FOUND');
    }
    throw error;
  }
};

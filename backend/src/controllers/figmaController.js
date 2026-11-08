import {
  fetchFigmaFile,
  parseDesignTree,
  parseFigmaUrl,
} from '../services/figmaService.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Handle Figma file import
 * POST /api/figma/import
 * Body: { url: "https://www.figma.com/file/..." }
 */
export const importFigmaFile = async (req, res, next) => {
  try {
    const { url } = req.body;

    // Use pre-validated metadata from middleware or parse directly
    const figmaMeta = req.figmaMeta || parseFigmaUrl(url);

    if (!figmaMeta.isValid || !figmaMeta.fileKey) {
      throw new AppError(
        'Invalid Figma URL. Please provide a valid Figma file or design URL.',
        400,
        'INVALID_FIGMA_URL'
      );
    }

    const fileKey = figmaMeta.fileKey;

    // Get Figma token from environment
    const figmaToken = process.env.FIGMA_TOKEN;
    if (!figmaToken) {
      throw new AppError(
        'Figma token not configured. Please set FIGMA_TOKEN in environment variables.',
        500,
        'MISSING_FIGMA_TOKEN'
      );
    }

    // Fetch Figma file
    console.log(`📥 Fetching Figma file: ${fileKey}${figmaMeta.nodeId ? ` (Target Node: ${figmaMeta.nodeId})` : ''}`);
    const figmaData = await fetchFigmaFile(fileKey, figmaToken);

    // Parse and normalize the tree
    console.log('🔄 Parsing design tree and applying semantic classification...');
    const tree = parseDesignTree(figmaData);

    // Return success response with preserved structure and optional target nodeId
    return res.status(200).json({
      success: true,
      data: {
        fileName: tree.fileName,
        fileVersion: tree.fileVersion,
        totalNodeCount: tree.totalNodeCount,
        tree: tree.pages.length > 0 ? tree.pages[0] : null,
        pages: tree.pages,
        targetNodeId: figmaMeta.nodeId || null,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Health check endpoint
 * GET /api/figma/health
 */
export const healthCheck = (req, res) => {
  res.json({
    success: true,
    message: 'Figma API is operational',
    timestamp: new Date().toISOString(),
  });
};

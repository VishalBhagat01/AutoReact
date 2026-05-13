import { fetchFigmaFile, extractFileKey, parseDesignTree } from '../services/figmaService.js';

/**
 * Handle Figma file import
 * POST /api/figma/import
 * Body: { url: "https://www.figma.com/file/..." }
 */
export const importFigmaFile = async (req, res, next) => {
  try {
    const { url } = req.body;

    // Validate URL
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request. URL is required and must be a string.',
      });
    }

    // Extract file key from URL
    const fileKey = extractFileKey(url);
    if (!fileKey) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Figma URL. Please provide a valid Figma file URL.',
      });
    }

    // Get Figma token from environment
    const figmaToken = process.env.FIGMA_TOKEN;
    if (!figmaToken) {
      return res.status(500).json({
        success: false,
        error: 'Figma token not configured. Please set FIGMA_TOKEN in environment variables.',
      });
    }

    // Fetch Figma file
    console.log(`📥 Fetching Figma file: ${fileKey}`);
    const figmaData = await fetchFigmaFile(fileKey, figmaToken);

    // Parse and normalize the tree
    console.log('🔄 Parsing design tree...');
    const tree = parseDesignTree(figmaData);

    // Return success response
    return res.status(200).json({
      success: true,
      data: {
        fileName: tree.fileName,
        fileVersion: tree.fileVersion,
        totalNodeCount: tree.totalNodeCount,
        tree: tree.pages.length > 0 ? tree.pages[0] : null,
        pages: tree.pages,
      },
    });
  } catch (error) {
    console.error('❌ Error importing Figma file:', error.message);
    
    // Handle specific Figma API errors
    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Figma token. Please check your FIGMA_TOKEN.',
      });
    }

    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'Figma file not found. Please check the file URL.',
      });
    }

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
  });
};

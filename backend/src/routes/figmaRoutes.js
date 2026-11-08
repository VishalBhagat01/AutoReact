import express from 'express';
import {
  importFigmaFile,
  healthCheck,
  getSelectiveNodesController,
  exportAssetsController,
} from '../controllers/figmaController.js';
import {
  validateFigmaImportRequest,
  validateSelectiveNodesRequest,
  validateAssetExportRequest,
} from '../middleware/validator.js';

const router = express.Router();

// POST /api/figma/import - Import and parse Figma file with request validation
router.post('/import', validateFigmaImportRequest, importFigmaFile);

// POST /api/figma/nodes - Fetch and normalize selective Figma nodes
router.post('/nodes', validateSelectiveNodesRequest, getSelectiveNodesController);

// POST /api/figma/assets/export - Export and persist visual assets (PNG, SVG, etc.)
router.post('/assets/export', validateAssetExportRequest, exportAssetsController);

// GET /api/figma/health - Health check
router.get('/health', healthCheck);

export default router;

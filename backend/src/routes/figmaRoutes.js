import express from 'express';
import { importFigmaFile, healthCheck } from '../controllers/figmaController.js';
import { validateFigmaImportRequest } from '../middleware/validator.js';

const router = express.Router();

// POST /api/figma/import - Import and parse Figma file with request validation
router.post('/import', validateFigmaImportRequest, importFigmaFile);

// GET /api/figma/health - Health check
router.get('/health', healthCheck);

export default router;

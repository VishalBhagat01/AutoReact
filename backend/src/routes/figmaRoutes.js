import express from 'express';
import { importFigmaFile, healthCheck } from '../controllers/figmaController.js';

const router = express.Router();

// POST /api/figma/import - Import and parse Figma file
router.post('/import', importFigmaFile);

// GET /api/figma/health - Health check
router.get('/health', healthCheck);

export default router;

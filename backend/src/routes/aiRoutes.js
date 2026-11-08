import express from 'express';
import {
  getAiServiceHealth,
  getAiCapabilities,
  analyzeDesignController,
  analyzeGeometryController,
  inferLayoutController,
  generateGraphController,
  detectComponentsController,
} from '../controllers/aiController.js';

const router = express.Router();

// GET /api/ai/health - Check Python microservice operational health
router.get('/health', getAiServiceHealth);

// GET /api/ai/capabilities - Get implemented vs pending processing capabilities
router.get('/capabilities', getAiCapabilities);

// POST /api/ai/analyze - Comprehensive design analysis with geometry & relationship graph
router.post('/analyze', analyzeDesignController);

// POST /api/ai/geometry - Deterministic geometry analysis (alignments, spacings, overlaps, grids)
router.post('/geometry', analyzeGeometryController);

// POST /api/ai/layout - Deterministic layout pattern inference (flex row, flex col, grid, etc.)
router.post('/layout', inferLayoutController);

// POST /api/ai/graph - Generate complete NetworkX design relationship graph
router.post('/graph', generateGraphController);

// POST /api/ai/components/detect - Identify repeated components and visual patterns
router.post('/components/detect', detectComponentsController);

export default router;

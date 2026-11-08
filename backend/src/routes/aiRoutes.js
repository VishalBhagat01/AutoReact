import express from 'express';
import {
  getAiServiceHealth,
  getAiCapabilities,
  analyzeDesignController,
} from '../controllers/aiController.js';

const router = express.Router();

// GET /api/ai/health - Check Python microservice health
router.get('/health', getAiServiceHealth);

// GET /api/ai/capabilities - Get implemented vs pending capabilities
router.get('/capabilities', getAiCapabilities);

// POST /api/ai/analyze - Analyze design AST through Python microservice
router.post('/analyze', analyzeDesignController);

export default router;

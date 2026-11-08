import express from 'express';
import { serveAssetController } from '../controllers/figmaController.js';

const router = express.Router();

// GET /api/assets/:fileKey/:filename - Serve static visual asset with path traversal protection
router.get('/:fileKey/:filename', serveAssetController);

export default router;


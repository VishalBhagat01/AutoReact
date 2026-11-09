import express from 'express';
import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectDesign,
  getProjectTree,
  getProjectComponents,
  getProjectAssets,
} from '../controllers/projectController.js';
import {
  generateProjectIR,
  getProjectIR,
  getProjectIRPage,
  getProjectIRComponents,
  getProjectIRComponentById,
  getProjectIRComponentDependencies,
  getProjectIRTokens,
} from '../controllers/designIRController.js';
import { validateObjectId } from '../middleware/validateObjectId.js';

const router = express.Router();

// Project CRUD
router.post('/', createProject);
router.get('/', getProjects);
router.get('/:id', validateObjectId('id'), getProjectById);
router.patch('/:id', validateObjectId('id'), updateProject);
router.delete('/:id', validateObjectId('id'), deleteProject);

// Project Design & Components & Assets (Backward Compatible)
router.get('/:id/design', validateObjectId('id'), getProjectDesign);
router.get('/:id/tree', validateObjectId('id'), getProjectTree);
router.get('/:id/components', validateObjectId('id'), getProjectComponents);
router.get('/:id/assets', validateObjectId('id'), getProjectAssets);

// Canonical Design IR Endpoints
router.post('/:id/ir/generate', validateObjectId('id'), generateProjectIR);
router.get('/:id/ir', validateObjectId('id'), getProjectIR);
router.get('/:id/ir/pages/:pageId', validateObjectId('id'), getProjectIRPage);
router.get('/:id/ir/components', validateObjectId('id'), getProjectIRComponents);
router.get('/:id/ir/components/:componentId', validateObjectId('id'), getProjectIRComponentById);
router.get('/:id/ir/components/:componentId/dependencies', validateObjectId('id'), getProjectIRComponentDependencies);
router.get('/:id/ir/tokens', validateObjectId('id'), getProjectIRTokens);

export default router;


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
} from '../controllers/projectController.js';
import { validateObjectId } from '../middleware/validateObjectId.js';

const router = express.Router();

// Project CRUD
router.post('/', createProject);
router.get('/', getProjects);
router.get('/:id', validateObjectId('id'), getProjectById);
router.patch('/:id', validateObjectId('id'), updateProject);
router.delete('/:id', validateObjectId('id'), deleteProject);

// Project Design & Components
router.get('/:id/design', validateObjectId('id'), getProjectDesign);
router.get('/:id/tree', validateObjectId('id'), getProjectTree);
router.get('/:id/components', validateObjectId('id'), getProjectComponents);

export default router;


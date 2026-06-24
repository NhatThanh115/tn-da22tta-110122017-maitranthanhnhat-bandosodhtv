// routes/landmarkRoutes.js
// Định nghĩa tất cả routes liên quan đến Landmarks

import { Router } from 'express';
import LandmarkController from '../controllers/LandmarkController.js';

const router = Router();

// GET /api/landmarks/categories  — phải khai báo TRƯỚC /:id để tránh bị hiểu nhầm là ID
router.get('/categories', LandmarkController.getCategories);

// CRUD
router.get('/',     LandmarkController.getAll);    // ?category, ?search, ?near=lng,lat&limit
router.get('/:id',  LandmarkController.getById);
router.post('/',    LandmarkController.create);
router.put('/:id',  LandmarkController.update);
router.delete('/:id', LandmarkController.delete);

export default router;

// routes/landmarkRoutes.js
// Định nghĩa tất cả routes liên quan đến Landmarks

import { Router } from 'express';
import LandmarkController from '../controllers/LandmarkController.js';
import { createUploader } from '../middleware/upload.js';

const router = Router();
const upload = createUploader('landmark');

// GET /api/landmarks/categories  — phải khai báo TRƯỚC /:id để tránh bị hiểu nhầm là ID
router.get('/categories', LandmarkController.getCategories);

// CRUD
router.get('/',     LandmarkController.getAll);    // ?category, ?search, ?near=lng,lat&limit
router.get('/:id',  LandmarkController.getById);
router.post('/',    upload.single('image'), LandmarkController.create);   // multipart hoặc JSON
router.put('/:id',  upload.single('image'), LandmarkController.update);   // multipart hoặc JSON
router.delete('/:id', LandmarkController.delete);

export default router;

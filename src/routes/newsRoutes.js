// routes/newsRoutes.js
// Định nghĩa routes liên quan đến News (Tin tức)

import { Router } from 'express';
import NewsController from '../controllers/NewsController.js';
import upload from '../middleware/upload.js';

const router = Router();

router.get('/',       NewsController.getAll);    // ?page, ?limit, ?landmark_id, ?search
router.get('/:id',    NewsController.getById);
router.post('/',      upload.single('image'), NewsController.create);
router.put('/:id',    upload.single('image'), NewsController.update);
router.delete('/:id', NewsController.delete);

export default router;

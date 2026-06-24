// routes/roomRoutes.js
// Định nghĩa tất cả routes liên quan đến Rooms

import { Router } from 'express';
import RoomController from '../controllers/RoomController.js';

const router = Router();

// CRUD
// GET /api/rooms             – Lấy tất cả (có thể lọc ?landmark_id=&search=)
// GET /api/rooms/:id         – Lấy 1 phòng
// POST /api/rooms            – Tạo mới
// PUT /api/rooms/:id         – Cập nhật
// DELETE /api/rooms/:id      – Xóa
router.get('/',       RoomController.getAll);
router.get('/:id',    RoomController.getById);
router.post('/',      RoomController.create);
router.put('/:id',    RoomController.update);
router.delete('/:id', RoomController.delete);

export default router;

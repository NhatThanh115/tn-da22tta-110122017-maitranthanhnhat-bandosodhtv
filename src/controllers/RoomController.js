// controllers/RoomController.js
// Tầng Controller: Xử lý logic HTTP cho Rooms

import RoomModel from '../models/RoomModel.js';

const RoomController = {

    /**
     * GET /api/rooms
     * Query: ?landmark_id=xxx  hoặc  ?search=xxx
     */
    async getAll(req, res) {
        try {
            const { landmark_id, search } = req.query;

            if (search) {
                const data = await RoomModel.search(search);
                return res.json({ success: true, count: data.length, data });
            }

            const data = await RoomModel.getAll({
                landmark_id: landmark_id ? parseInt(landmark_id) : undefined
            });
            return res.json({ success: true, count: data.length, data });

        } catch (err) {
            console.error('[RoomController.getAll]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    },

    /**
     * GET /api/rooms/:id
     */
    async getById(req, res) {
        try {
            const { id } = req.params;
            const data = await RoomModel.getById(parseInt(id));
            if (!data) {
                return res.status(404).json({ success: false, message: `Không tìm thấy phòng ID: ${id}` });
            }
            res.json({ success: true, data });
        } catch (err) {
            console.error('[RoomController.getById]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    },

    /**
     * POST /api/rooms
     * Body: { landmark_id, room_name, floor?, description? }
     */
    async create(req, res) {
        try {
            const { landmark_id, room_name } = req.body;

            if (!landmark_id || !room_name) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu dữ liệu bắt buộc: landmark_id, room_name'
                });
            }

            const data = await RoomModel.create(req.body);
            res.status(201).json({ success: true, message: 'Tạo phòng thành công', data });
        } catch (err) {
            console.error('[RoomController.create]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    },

    /**
     * PUT /api/rooms/:id
     * Body: { landmark_id?, room_name?, floor?, description? }
     */
    async update(req, res) {
        try {
            const { id } = req.params;
            const data = await RoomModel.update(parseInt(id), req.body);
            if (!data) {
                return res.status(404).json({ success: false, message: `Không tìm thấy phòng ID: ${id}` });
            }
            res.json({ success: true, message: 'Cập nhật phòng thành công', data });
        } catch (err) {
            console.error('[RoomController.update]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    },

    /**
     * DELETE /api/rooms/:id
     */
    async delete(req, res) {
        try {
            const { id } = req.params;
            const data = await RoomModel.delete(parseInt(id));
            if (!data) {
                return res.status(404).json({ success: false, message: `Không tìm thấy phòng ID: ${id}` });
            }
            res.json({ success: true, message: `Đã xóa phòng "${data.room_name}"`, data });
        } catch (err) {
            console.error('[RoomController.delete]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    }
};

export default RoomController;

// controllers/LandmarkController.js
// Tầng Controller: Xử lý logic HTTP cho Landmarks

import LandmarkModel from '../models/LandmarkModel.js';

const LandmarkController = {

    /**
     * GET /api/landmarks
     * Query: ?category=xxx  hoặc  ?search=xxx  hoặc  ?near=lng,lat&limit=5
     */
    async getAll(req, res) {
        try {
            const { category, search, near, limit } = req.query;

            if (search) {
                const data = await LandmarkModel.search(search);
                return res.json({ success: true, count: data.length, data });
            }

            if (near) {
                const [lng, lat] = near.split(',').map(Number);
                if (isNaN(lng) || isNaN(lat)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Tham số "near" phải có định dạng: lng,lat'
                    });
                }
                const data = await LandmarkModel.findNearest(lng, lat, parseInt(limit) || 5);
                return res.json({ success: true, count: data.length, data });
            }

            const data = await LandmarkModel.getAll({ category });
            return res.json({ success: true, count: data.length, data });

        } catch (err) {
            console.error('[LandmarkController.getAll]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    },

    /**
     * GET /api/landmarks/categories
     * Lấy danh sách category duy nhất
     */
    async getCategories(req, res) {
        try {
            const data = await LandmarkModel.getCategories();
            const categories = data.map(r => r.category);
            res.json({ success: true, count: categories.length, data: categories });
        } catch (err) {
            console.error('[LandmarkController.getCategories]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    },

    /**
     * GET /api/landmarks/:id
     */
    async getById(req, res) {
        try {
            const { id } = req.params;
            const data = await LandmarkModel.getById(parseInt(id));
            if (!data) {
                return res.status(404).json({ success: false, message: `Không tìm thấy landmark ID: ${id}` });
            }
            res.json({ success: true, data });
        } catch (err) {
            console.error('[LandmarkController.getById]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    },

    /**
     * POST /api/landmarks
     * Body: { name, category, description, image_url, metadata, connected_node_id, lng, lat }
     */
    async create(req, res) {
        try {
            const { name, lng, lat } = req.body;

            // Validate dữ liệu bắt buộc
            if (!name || lng === undefined || lat === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu dữ liệu bắt buộc: name, lng, lat'
                });
            }

            const data = await LandmarkModel.create(req.body);
            res.status(201).json({ success: true, message: 'Tạo landmark thành công', data });
        } catch (err) {
            console.error('[LandmarkController.create]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    },

    /**
     * PUT /api/landmarks/:id
     * Body: { name?, category?, description?, image_url?, metadata?, connected_node_id?, lng?, lat? }
     */
    async update(req, res) {
        try {
            const { id } = req.params;
            const data = await LandmarkModel.update(parseInt(id), req.body);
            if (!data) {
                return res.status(404).json({ success: false, message: `Không tìm thấy landmark ID: ${id}` });
            }
            res.json({ success: true, message: 'Cập nhật landmark thành công', data });
        } catch (err) {
            console.error('[LandmarkController.update]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    },

    /**
     * DELETE /api/landmarks/:id
     */
    async delete(req, res) {
        try {
            const { id } = req.params;
            const data = await LandmarkModel.delete(parseInt(id));
            if (!data) {
                return res.status(404).json({ success: false, message: `Không tìm thấy landmark ID: ${id}` });
            }
            res.json({ success: true, message: `Đã xóa landmark "${data.name}"`, data });
        } catch (err) {
            console.error('[LandmarkController.delete]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    }
};

export default LandmarkController;

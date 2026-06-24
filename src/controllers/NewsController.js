// controllers/NewsController.js
// Tầng Controller: Xử lý logic HTTP cho News (Tin tức)

import NewsModel from '../models/NewsModel.js';

const NewsController = {

    /**
     * GET /api/news
     * Query: ?page=1&limit=10&landmark_id=5&search=xxx
     */
    async getAll(req, res) {
        try {
            const { search, landmark_id, page = 1, limit = 10 } = req.query;

            if (search) {
                const data = await NewsModel.search(search);
                return res.json({ success: true, count: data.length, data });
            }

            const pageNum  = Math.max(1, parseInt(page));
            const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
            const offset   = (pageNum - 1) * limitNum;

            const filter = landmark_id ? { landmark_id: parseInt(landmark_id) } : {};
            const [data, total] = await Promise.all([
                NewsModel.getAll({ limit: limitNum, offset, ...filter }),
                NewsModel.count(filter)
            ]);

            res.json({
                success: true,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    total_pages: Math.ceil(total / limitNum)
                },
                data
            });
        } catch (err) {
            console.error('[NewsController.getAll]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    },

    /**
     * GET /api/news/:id
     */
    async getById(req, res) {
        try {
            const data = await NewsModel.getById(parseInt(req.params.id));
            if (!data) {
                return res.status(404).json({ success: false, message: `Không tìm thấy tin tức ID: ${req.params.id}` });
            }
            res.json({ success: true, data });
        } catch (err) {
            console.error('[NewsController.getById]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    },

    /**
     * POST /api/news
     * Body (multipart): title, summary?, content?, type?, is_published?, landmark_id?, image (file)
     */
    async create(req, res) {
        try {
            const { title, summary, content, type, is_published, landmark_id } = req.body;
            if (!title) {
                return res.status(400).json({ success: false, message: 'Thiếu dữ liệu bắt buộc: title' });
            }

            // Nếu có file upload → tạo image_url
            const image_url = req.file ? `/uploads/${req.file.filename}` : null;

            const data = await NewsModel.create({
                title, summary, content, type, image_url,
                is_published: is_published === 'false' ? false : true,
                landmark_id: landmark_id ? parseInt(landmark_id) : null,
            });
            res.status(201).json({ success: true, message: 'Tạo tin tức thành công', data });
        } catch (err) {
            console.error('[NewsController.create]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    },

    /**
     * PUT /api/news/:id
     * Body (multipart): title?, summary?, content?, type?, is_published?, landmark_id?, image (file)
     */
    async update(req, res) {
        try {
            const { title, summary, content, type, is_published, landmark_id } = req.body;

            // Nếu có file upload mới → cập nhật image_url
            const image_url = req.file ? `/uploads/${req.file.filename}` : undefined;

            const updateData = {
                title, summary, content, type, image_url,
                is_published: is_published !== undefined ? (is_published === 'false' ? false : true) : undefined,
                landmark_id: landmark_id ? parseInt(landmark_id) : undefined,
            };

            const data = await NewsModel.update(parseInt(req.params.id), updateData);
            if (!data) {
                return res.status(404).json({ success: false, message: `Không tìm thấy tin tức ID: ${req.params.id}` });
            }
            res.json({ success: true, message: 'Cập nhật tin tức thành công', data });
        } catch (err) {
            console.error('[NewsController.update]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    },

    /**
     * DELETE /api/news/:id
     */
    async delete(req, res) {
        try {
            const data = await NewsModel.delete(parseInt(req.params.id));
            if (!data) {
                return res.status(404).json({ success: false, message: `Không tìm thấy tin tức ID: ${req.params.id}` });
            }
            res.json({ success: true, message: `Đã xóa tin tức "${data.title}"`, data });
        } catch (err) {
            console.error('[NewsController.delete]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    }
};

export default NewsController;

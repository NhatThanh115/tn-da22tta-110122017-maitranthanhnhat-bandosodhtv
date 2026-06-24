// controllers/RoadController.js
// Tầng Controller: Xử lý logic HTTP cho Roads & Road Nodes

import RoadModel from '../models/RoadModel.js';
import RoadNodeModel from '../models/RoadNodeModel.js';

// ── Road Nodes ────────────────────────────────────────────────────────────────

export const RoadNodeController = {

    /**
     * GET /api/road-nodes
     * Query: ?near=lng,lat  → tìm node gần nhất
     */
    async getAll(req, res) {
        try {
            const { near } = req.query;
            if (near) {
                const [lng, lat] = near.split(',').map(Number);
                if (isNaN(lng) || isNaN(lat)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Tham số "near" phải có định dạng: lng,lat'
                    });
                }
                const data = await RoadNodeModel.findNearest(lng, lat);
                return res.json({ success: true, data });
            }
            const data = await RoadNodeModel.getAll();
            res.json({ success: true, count: data.length, data });
        } catch (err) {
            console.error('[RoadNodeController.getAll]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    },

    /**
     * GET /api/road-nodes/:id
     */
    async getById(req, res) {
        try {
            const data = await RoadNodeModel.getById(parseInt(req.params.id));
            if (!data) return res.status(404).json({ success: false, message: 'Không tìm thấy node' });
            res.json({ success: true, data });
        } catch (err) {
            console.error('[RoadNodeController.getById]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    },

    /**
     * POST /api/road-nodes
     * Body: { name?, lng, lat }
     */
    async create(req, res) {
        try {
            const { lng, lat } = req.body;
            if (lng === undefined || lat === undefined) {
                return res.status(400).json({ success: false, message: 'Thiếu dữ liệu bắt buộc: lng, lat' });
            }
            const data = await RoadNodeModel.create(req.body);
            res.status(201).json({ success: true, message: 'Tạo node thành công', data });
        } catch (err) {
            console.error('[RoadNodeController.create]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    },

    /**
     * PUT /api/road-nodes/:id
     */
    async update(req, res) {
        try {
            const data = await RoadNodeModel.update(parseInt(req.params.id), req.body);
            if (!data) return res.status(404).json({ success: false, message: 'Không tìm thấy node' });
            res.json({ success: true, message: 'Cập nhật node thành công', data });
        } catch (err) {
            console.error('[RoadNodeController.update]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    },

    /**
     * DELETE /api/road-nodes/:id
     */
    async delete(req, res) {
        try {
            const data = await RoadNodeModel.delete(parseInt(req.params.id));
            if (!data) return res.status(404).json({ success: false, message: 'Không tìm thấy node' });
            res.json({ success: true, message: `Đã xóa node ID: ${data.id}`, data });
        } catch (err) {
            console.error('[RoadNodeController.delete]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    }
};


// ── Roads ─────────────────────────────────────────────────────────────────────

export const RoadController = {

    /**
     * GET /api/roads
     * Query: ?geojson=true → trả về GeoJSON FeatureCollection
     */
    async getAll(req, res) {
        try {
            if (req.query.geojson === 'true') {
                const data = await RoadModel.getGeoJSON();
                return res.json({ success: true, data });
            }
            const data = await RoadModel.getAll();
            res.json({ success: true, count: data.length, data });
        } catch (err) {
            console.error('[RoadController.getAll]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    },

    /**
     * GET /api/roads/:id
     */
    async getById(req, res) {
        try {
            const data = await RoadModel.getById(parseInt(req.params.id));
            if (!data) return res.status(404).json({ success: false, message: 'Không tìm thấy đường' });
            res.json({ success: true, data });
        } catch (err) {
            console.error('[RoadController.getById]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    },

    /**
     * POST /api/roads
     * Body: { name?, source, target, reverse_cost?, coordinates: [[lng,lat],...] }
     */
    async create(req, res) {
        try {
            const { source, target, coordinates } = req.body;
            if (!source || !target || !coordinates || coordinates.length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu dữ liệu bắt buộc: source, target, coordinates (ít nhất 2 điểm)'
                });
            }
            const data = await RoadModel.create(req.body);
            res.status(201).json({ success: true, message: 'Tạo đường thành công', data });
        } catch (err) {
            console.error('[RoadController.create]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    },

    /**
     * PUT /api/roads/:id
     */
    async update(req, res) {
        try {
            const data = await RoadModel.update(parseInt(req.params.id), req.body);
            if (!data) return res.status(404).json({ success: false, message: 'Không tìm thấy đường' });
            res.json({ success: true, message: 'Cập nhật đường thành công', data });
        } catch (err) {
            console.error('[RoadController.update]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    },

    /**
     * DELETE /api/roads/:id
     */
    async delete(req, res) {
        try {
            const data = await RoadModel.delete(parseInt(req.params.id));
            if (!data) return res.status(404).json({ success: false, message: 'Không tìm thấy đường' });
            res.json({ success: true, message: `Đã xóa đường ID: ${data.id}`, data });
        } catch (err) {
            console.error('[RoadController.delete]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    },

    /**
     * GET /api/roads/path?from=1&to=5
     * Tìm đường ngắn nhất A* giữa 2 nodes
     */
    async findPath(req, res) {
        try {
            const { from, to } = req.query;
            if (!from || !to) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu tham số: from (node nguồn), to (node đích)'
                });
            }
            const startNode = parseInt(from);
            const endNode   = parseInt(to);
            if (isNaN(startNode) || isNaN(endNode)) {
                return res.status(400).json({ success: false, message: 'from và to phải là số nguyên' });
            }

            const steps = await RoadModel.findPathAStar(startNode, endNode);
            if (!steps || steps.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: `Không tìm được đường từ node ${startNode} đến node ${endNode}`
                });
            }

            // Tổng khoảng cách
            const totalCost = steps.reduce((sum, s) => sum + (s.cost || 0), 0);

            res.json({
                success: true,
                from: startNode,
                to: endNode,
                total_cost_meters: Math.round(totalCost * 100) / 100,
                steps_count: steps.length,
                data: steps
            });
        } catch (err) {
            console.error('[RoadController.findPath]', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
        }
    }
};

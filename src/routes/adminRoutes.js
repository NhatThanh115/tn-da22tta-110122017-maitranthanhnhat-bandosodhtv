// routes/adminRoutes.js
// Quản lý cấu hình hệ thống (bảng admin_config)
// + Endpoint xác thực mật khẩu quản trị viên cho Validate.vue

import { Router } from 'express';
import sql from '../config/database.js';

const router = Router();

/**
 * GET /api/admin/config
 * Lấy toàn bộ cấu hình
 */
router.get('/', async (_req, res) => {
    try {
        const rows = await sql`SELECT * FROM admin_config ORDER BY config_key ASC`;
        // Che giá trị của các key nhạy cảm (is_secret = true)
        const data = rows.map(r => ({
            ...r,
            config_value: r.is_secret ? '••••••••' : r.config_value
        }));
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        console.error('[adminRoutes.getAll]', err);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
    }
});

/**
 * GET /api/admin/config/:key
 * Lấy giá trị theo key
 */
router.get('/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const rows = await sql`SELECT * FROM admin_config WHERE config_key = ${key}`;
        if (!rows[0]) {
            return res.status(404).json({ success: false, message: `Không tìm thấy key: ${key}` });
        }
        const row = rows[0];
        // Che giá trị nếu là key nhạy cảm
        if (row.is_secret) row.config_value = '••••••••';
        res.json({ success: true, data: row });
    } catch (err) {
        console.error('[adminRoutes.getByKey]', err);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
    }
});

/**
 * POST /api/admin/config/verify
 * Xác thực mật khẩu quản trị viên (dùng bởi Validate.vue).
 * Body: { password: string }
 * Trả về: { success, authenticated } — KHÔNG bao giờ trả về config_value thực tế.
 */
router.post('/verify', async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ success: false, message: 'Thiếu trường password' });
        }

        const rows = await sql`
            SELECT config_value FROM admin_config
            WHERE config_key = 'admin_password'
            LIMIT 1
        `;

        if (!rows[0]) {
            // Chưa có cấu hình mật khẩu trong DB
            return res.status(503).json({ success: false, message: 'Chưa cấu hình mật khẩu quản trị' });
        }

        const isMatch = password === rows[0].config_value;
        if (isMatch) {
            return res.json({ success: true, authenticated: true });
        } else {
            return res.status(401).json({ success: false, authenticated: false, message: 'Mật khẩu không chính xác' });
        }
    } catch (err) {
        console.error('[adminRoutes.verify]', err);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
    }
});

/**
 * POST /api/admin/config
 * Tạo mới hoặc cập nhật cấu hình (upsert)
 * Body: { config_key, config_value }
 */
router.post('/', async (req, res) => {
    try {
        const { config_key, config_value, description, is_secret } = req.body;
        if (!config_key || config_value === undefined) {
            return res.status(400).json({ success: false, message: 'Thiếu config_key hoặc config_value' });
        }
        const rows = await sql`
            INSERT INTO admin_config (config_key, config_value, description, is_secret)
            VALUES (
                ${config_key},
                ${config_value},
                ${description ?? null},
                ${is_secret ?? false}
            )
            ON CONFLICT (config_key) DO UPDATE
                SET config_value = EXCLUDED.config_value,
                    description  = COALESCE(EXCLUDED.description, admin_config.description),
                    is_secret    = COALESCE(EXCLUDED.is_secret,   admin_config.is_secret),
                    updated_at   = NOW()
            RETURNING *
        `;
        const row = rows[0];
        if (row.is_secret) row.config_value = '••••••••';
        res.status(201).json({ success: true, message: 'Lưu cấu hình thành công', data: row });
    } catch (err) {
        console.error('[adminRoutes.upsert]', err);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
    }
});

/**
 * DELETE /api/admin/config/:key
 * Xóa một cấu hình theo key
 */
router.delete('/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const rows = await sql`DELETE FROM admin_config WHERE config_key = ${key} RETURNING *`;
        if (!rows[0]) {
            return res.status(404).json({ success: false, message: `Không tìm thấy key: ${key}` });
        }
        res.json({ success: true, message: `Đã xóa cấu hình "${key}"`, data: rows[0] });
    } catch (err) {
        console.error('[adminRoutes.delete]', err);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err.message });
    }
});

export default router;

// models/NewsModel.js
// Tầng Model: Truy vấn SQL liên quan đến bảng news

import sql from '../config/database.js';

const NewsModel = {

    /**
     * Lấy tất cả tin tức (có phân trang)
     */
    async getAll({ limit = 10, offset = 0, landmark_id } = {}) {
        if (landmark_id) {
            return await sql`
                SELECT
                    n.id, n.title, n.summary, n.content, n.type,
                    n.image_url, n.is_published,
                    n.published_at, n.landmark_id,
                    l.name  AS landmark_name,
                    ST_Y(l.geom::geometry) AS lat,
                    ST_X(l.geom::geometry) AS lng
                FROM news n
                LEFT JOIN landmarks l ON n.landmark_id = l.id
                WHERE n.landmark_id = ${landmark_id}
                ORDER BY n.published_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
        }
        return await sql`
            SELECT
                n.id, n.title, n.summary, n.content, n.type,
                n.image_url, n.is_published,
                n.published_at, n.landmark_id,
                l.name  AS landmark_name,
                ST_Y(l.geom::geometry) AS lat,
                ST_X(l.geom::geometry) AS lng
            FROM news n
            LEFT JOIN landmarks l ON n.landmark_id = l.id
            ORDER BY n.published_at DESC
            LIMIT ${limit} OFFSET ${offset}
        `;
    },

    /**
     * Đếm tổng số tin tức (dùng cho phân trang)
     */
    async count({ landmark_id } = {}) {
        if (landmark_id) {
            const rows = await sql`
                SELECT COUNT(*) AS total FROM news WHERE landmark_id = ${landmark_id}
            `;
            return parseInt(rows[0].total);
        }
        const rows = await sql`SELECT COUNT(*) AS total FROM news`;
        return parseInt(rows[0].total);
    },

    /**
     * Lấy 1 tin tức theo ID
     */
    async getById(id) {
        const rows = await sql`
            SELECT
                n.id, n.title, n.summary, n.content, n.type,
                n.image_url, n.is_published,
                n.published_at, n.landmark_id,
                l.name  AS landmark_name,
                ST_Y(l.geom::geometry) AS lat,
                ST_X(l.geom::geometry) AS lng
            FROM news n
            LEFT JOIN landmarks l ON n.landmark_id = l.id
            WHERE n.id = ${id}
        `;
        return rows[0] || null;
    },

    /**
     * Tìm kiếm tin tức theo tiêu đề
     */
    async search(keyword) {
        return await sql`
            SELECT
                n.id, n.title, n.summary, n.content, n.type,
                n.image_url, n.is_published,
                n.published_at, n.landmark_id,
                l.name  AS landmark_name,
                ST_Y(l.geom::geometry) AS lat,
                ST_X(l.geom::geometry) AS lng
            FROM news n
            LEFT JOIN landmarks l ON n.landmark_id = l.id
            WHERE n.title ILIKE ${'%' + keyword + '%'}
               OR n.content ILIKE ${'%' + keyword + '%'}
            ORDER BY n.published_at DESC
        `;
    },

    /**
     * Tạo mới tin tức
     */
    async create({ title, summary, content, type, image_url, is_published, landmark_id }) {
        const rows = await sql`
            INSERT INTO news (title, summary, content, type, image_url, is_published, landmark_id)
            VALUES (
                ${title},
                ${summary || null},
                ${content || null},
                ${type || 'tin-tuc'},
                ${image_url || null},
                ${is_published !== undefined ? is_published : true},
                ${landmark_id || null}
            )
            RETURNING id, title, summary, content, type, image_url, is_published, published_at, landmark_id
        `;
        return rows[0];
    },

    /**
     * Cập nhật tin tức
     */
    async update(id, { title, summary, content, type, image_url, is_published, landmark_id }) {
        const rows = await sql`
            UPDATE news SET
                title        = COALESCE(${title || null}, title),
                summary      = COALESCE(${summary || null}, summary),
                content      = COALESCE(${content || null}, content),
                type         = COALESCE(${type || null}, type),
                image_url    = COALESCE(${image_url || null}, image_url),
                is_published = COALESCE(${is_published !== undefined ? is_published : null}, is_published),
                landmark_id  = COALESCE(${landmark_id || null}, landmark_id),
                updated_at   = NOW()
            WHERE id = ${id}
            RETURNING id, title, summary, content, type, image_url, is_published, published_at, landmark_id
        `;
        return rows[0] || null;
    },

    /**
     * Xóa tin tức
     */
    async delete(id) {
        const rows = await sql`
            DELETE FROM news WHERE id = ${id}
            RETURNING id, title
        `;
        return rows[0] || null;
    }
};

export default NewsModel;

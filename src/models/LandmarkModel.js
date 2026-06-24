// models/LandmarkModel.js
// Tầng Model: Tất cả truy vấn SQL liên quan đến bảng landmarks

import sql from '../config/database.js';

const LandmarkModel = {

    /**
     * Lấy tất cả landmarks (có thể lọc theo category)
     */
    async getAll({ category } = {}) {
        if (category) {
            return await sql`
                SELECT
                    id, name, category, description, image_url,
                    metadata, connected_node_id,
                    ST_AsGeoJSON(geom)::json AS geom,
                    created_at
                FROM landmarks
                WHERE category = ${category}
                ORDER BY name ASC
            `;
        }
        return await sql`
            SELECT
                id, name, category, description, image_url,
                metadata, connected_node_id,
                ST_AsGeoJSON(geom)::json AS geom,
                created_at
            FROM landmarks
            ORDER BY name ASC
        `;
    },

    /**
     * Lấy 1 landmark theo ID
     */
    async getById(id) {
        const rows = await sql`
            SELECT
                id, name, category, description, image_url,
                metadata, connected_node_id,
                ST_AsGeoJSON(geom)::json AS geom,
                created_at
            FROM landmarks
            WHERE id = ${id}
        `;
        return rows[0] || null;
    },

    /**
     * Tìm kiếm landmarks theo tên (ILIKE - không phân biệt hoa thường)
     */
    async search(keyword) {
        return await sql`
            SELECT
                id, name, category, description, image_url,
                metadata, connected_node_id,
                ST_AsGeoJSON(geom)::json AS geom,
                created_at
            FROM landmarks
            WHERE name ILIKE ${'%' + keyword + '%'}
               OR description ILIKE ${'%' + keyword + '%'}
            ORDER BY name ASC
        `;
    },

    /**
     * Tìm landmark gần nhất với một điểm (lng, lat)
     */
    async findNearest(lng, lat, limit = 5) {
        return await sql`
            SELECT
                id, name, category, description, image_url,
                metadata, connected_node_id,
                ST_AsGeoJSON(geom)::json AS geom,
                created_at,
                ROUND(ST_Distance(
                    geom::geography,
                    ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
                )::numeric, 2) AS distance_meters
            FROM landmarks
            ORDER BY geom <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
            LIMIT ${limit}
        `;
    },

    /**
     * Tạo mới landmark
     */
    async create({ name, category, description, image_url, metadata, connected_node_id, lng, lat }) {
        const rows = await sql`
            INSERT INTO landmarks (name, category, description, image_url, metadata, connected_node_id, geom)
            VALUES (
                ${name},
                ${category || null},
                ${description || null},
                ${image_url || null},
                ${metadata ? sql.json(metadata) : sql.json({})},
                ${connected_node_id || null},
                ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
            )
            RETURNING
                id, name, category, description, image_url,
                metadata, connected_node_id,
                ST_AsGeoJSON(geom)::json AS geom,
                created_at
        `;
        return rows[0];
    },

    /**
     * Cập nhật landmark theo ID
     */
    async update(id, { name, category, description, image_url, metadata, connected_node_id, lng, lat }) {
        const rows = await sql`
            UPDATE landmarks SET
                name              = COALESCE(${name || null}, name),
                category          = COALESCE(${category || null}, category),
                description       = COALESCE(${description || null}, description),
                image_url         = COALESCE(${image_url || null}, image_url),
                metadata          = COALESCE(${metadata ? sql.json(metadata) : null}, metadata),
                connected_node_id = COALESCE(${connected_node_id || null}, connected_node_id),
                geom              = CASE
                                        WHEN ${lng || null} IS NOT NULL AND ${lat || null} IS NOT NULL
                                        THEN ST_SetSRID(ST_MakePoint(${lng || 0}, ${lat || 0}), 4326)
                                        ELSE geom
                                    END
            WHERE id = ${id}
            RETURNING
                id, name, category, description, image_url,
                metadata, connected_node_id,
                ST_AsGeoJSON(geom)::json AS geom,
                created_at
        `;
        return rows[0] || null;
    },

    /**
     * Xóa landmark theo ID
     */
    async delete(id) {
        const rows = await sql`
            DELETE FROM landmarks WHERE id = ${id}
            RETURNING id, name
        `;
        return rows[0] || null;
    },

    /**
     * Lấy danh sách các category duy nhất
     */
    async getCategories() {
        return await sql`
            SELECT DISTINCT category
            FROM landmarks
            WHERE category IS NOT NULL
            ORDER BY category ASC
        `;
    }
};

export default LandmarkModel;

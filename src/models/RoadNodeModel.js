// models/RoadNodeModel.js
// Tầng Model: Truy vấn SQL liên quan đến bảng road_nodes

import sql from '../config/database.js';

const RoadNodeModel = {

    /**
     * Lấy tất cả nodes
     */
    async getAll() {
        return await sql`
            SELECT
                id, name,
                ST_AsGeoJSON(geom)::json AS geom,
                x, y
            FROM road_nodes
            ORDER BY id ASC
        `;
    },

    /**
     * Lấy node theo ID
     */
    async getById(id) {
        const rows = await sql`
            SELECT
                id, name,
                ST_AsGeoJSON(geom)::json AS geom,
                x, y
            FROM road_nodes
            WHERE id = ${id}
        `;
        return rows[0] || null;
    },

    /**
     * Tìm node gần nhất với tọa độ (lng, lat)
     */
    async findNearest(lng, lat) {
        const rows = await sql`
            SELECT
                id, name,
                ST_AsGeoJSON(geom)::json AS geom,
                x, y,
                ROUND(ST_Distance(
                    geom::geography,
                    ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
                )::numeric, 2) AS distance_meters
            FROM road_nodes
            ORDER BY geom <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
            LIMIT 1
        `;
        return rows[0] || null;
    },

    /**
     * Tạo mới node
     */
    async create({ name, lng, lat }) {
        const rows = await sql`
            INSERT INTO road_nodes (name, geom)
            VALUES (
                ${name || null},
                ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
            )
            RETURNING id, name, ST_AsGeoJSON(geom)::json AS geom, x, y
        `;
        return rows[0];
    },

    /**
     * Cập nhật node
     */
    async update(id, { name, lng, lat }) {
        const rows = await sql`
            UPDATE road_nodes SET
                name = COALESCE(${name || null}, name),
                geom = CASE
                           WHEN ${lng || null} IS NOT NULL AND ${lat || null} IS NOT NULL
                           THEN ST_SetSRID(ST_MakePoint(${lng || 0}, ${lat || 0}), 4326)
                           ELSE geom
                       END
            WHERE id = ${id}
            RETURNING id, name, ST_AsGeoJSON(geom)::json AS geom, x, y
        `;
        return rows[0] || null;
    },

    /**
     * Xóa node
     */
    async delete(id) {
        const rows = await sql`
            DELETE FROM road_nodes WHERE id = ${id}
            RETURNING id, name
        `;
        return rows[0] || null;
    }
};

export default RoadNodeModel;

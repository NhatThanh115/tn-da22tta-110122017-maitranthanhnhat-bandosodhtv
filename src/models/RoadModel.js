// models/RoadModel.js
// Tầng Model: Truy vấn SQL liên quan đến bảng roads

import sql from '../config/database.js';

const RoadModel = {

    /**
     * Lấy tất cả roads (kèm thông tin node nguồn & đích)
     */
    async getAll() {
        return await sql`
            SELECT
                r.id, r.name,
                r.source, r.target,
                r.cost, r.reverse_cost,
                ST_AsGeoJSON(r.geom)::json AS geom,
                n1.name AS source_name,
                n2.name AS target_name
            FROM roads r
            LEFT JOIN road_nodes n1 ON r.source = n1.id
            LEFT JOIN road_nodes n2 ON r.target = n2.id
            ORDER BY r.id ASC
        `;
    },

    /**
     * Lấy road theo ID
     */
    async getById(id) {
        const rows = await sql`
            SELECT
                r.id, r.name,
                r.source, r.target,
                r.cost, r.reverse_cost,
                ST_AsGeoJSON(r.geom)::json AS geom,
                n1.name AS source_name,
                n2.name AS target_name
            FROM roads r
            LEFT JOIN road_nodes n1 ON r.source = n1.id
            LEFT JOIN road_nodes n2 ON r.target = n2.id
            WHERE r.id = ${id}
        `;
        return rows[0] || null;
    },

    /**
     * Lấy tất cả roads dưới dạng GeoJSON FeatureCollection
     */
    async getGeoJSON() {
        const rows = await sql`
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'geometry', ST_AsGeoJSON(r.geom)::json,
                        'properties', json_build_object(
                            'id',           r.id,
                            'name',         r.name,
                            'source',       r.source,
                            'target',       r.target,
                            'cost',         r.cost,
                            'reverse_cost', r.reverse_cost
                        )
                    )
                ), '[]'::json)
            ) AS geojson
            FROM roads r
        `;
        return rows[0].geojson;
    },

    /**
     * Tạo mới road (cost tự động tính bởi trigger fn_calc_road_cost)
     */
    async create({ name, source, target, reverse_cost, coordinates }) {
        // coordinates: mảng [lng, lat] để tạo LineString
        const linestring = `LINESTRING(${coordinates.map(c => `${c[0]} ${c[1]}`).join(', ')})`;
        const rows = await sql`
            INSERT INTO roads (name, source, target, reverse_cost, geom)
            VALUES (
                ${name || null},
                ${source},
                ${target},
                ${reverse_cost ?? null},
                ST_GeomFromText(${linestring}, 4326)
            )
            RETURNING
                id, name, source, target, cost, reverse_cost,
                ST_AsGeoJSON(geom)::json AS geom
        `;
        return rows[0];
    },

    /**
     * Cập nhật road
     */
    async update(id, { name, source, target, reverse_cost }) {
        const rows = await sql`
            UPDATE roads SET
                name         = COALESCE(${name || null}, name),
                source       = COALESCE(${source || null}, source),
                target       = COALESCE(${target || null}, target),
                reverse_cost = COALESCE(${reverse_cost ?? null}, reverse_cost)
            WHERE id = ${id}
            RETURNING
                id, name, source, target, cost, reverse_cost,
                ST_AsGeoJSON(geom)::json AS geom
        `;
        return rows[0] || null;
    },

    /**
     * Xóa road
     */
    async delete(id) {
        const rows = await sql`
            DELETE FROM roads WHERE id = ${id}
            RETURNING id, name
        `;
        return rows[0] || null;
    },

    /**
     * Tìm đường ngắn nhất A* giữa 2 nodes (gọi stored function)
     */
    async findPathAStar(startNode, endNode) {
        return await sql`
            SELECT
                seq, node, edge, name, cost,
                ST_AsGeoJSON(geom)::json AS geom
            FROM find_path_astar(${startNode}, ${endNode})
        `;
    }
};

export default RoadModel;

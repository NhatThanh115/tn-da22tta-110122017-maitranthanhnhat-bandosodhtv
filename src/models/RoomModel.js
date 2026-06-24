// models/RoomModel.js
// Tầng Model: Tất cả truy vấn SQL liên quan đến bảng rooms

import sql from '../config/database.js';

const RoomModel = {

    /**
     * Lấy tất cả rooms (có thể lọc theo landmark_id)
     */
    async getAll({ landmark_id } = {}) {
        if (landmark_id) {
            return await sql`
                SELECT id, landmark_id, room_name, description
                FROM rooms
                WHERE landmark_id = ${landmark_id}
                ORDER BY room_name ASC
            `;
        }
        return await sql`
            SELECT id, landmark_id, room_name, description
            FROM rooms
            ORDER BY landmark_id ASC, room_name ASC
        `;
    },

    /**
     * Lấy 1 room theo ID
     */
    async getById(id) {
        const rows = await sql`
            SELECT id, landmark_id, room_name, description
            FROM rooms
            WHERE id = ${id}
        `;
        return rows[0] || null;
    },

    /**
     * Tìm kiếm phòng theo tên (không phân biệt hoa thường)
     */
    async search(keyword) {
        return await sql`
            SELECT id, landmark_id, room_name, description
            FROM rooms
            WHERE room_name ILIKE ${'%' + keyword + '%'}
               OR description ILIKE ${'%' + keyword + '%'}
            ORDER BY room_name ASC
        `;
    },

    /**
     * Tạo mới room
     */
    async create({ landmark_id, room_name, description }) {
        const rows = await sql`
            INSERT INTO rooms (landmark_id, room_name, description)
            VALUES (
                ${landmark_id},
                ${room_name},
                ${description || null}
            )
            RETURNING id, landmark_id, room_name, description
        `;
        return rows[0];
    },

    /**
     * Cập nhật room theo ID
     */
    async update(id, { landmark_id, room_name, description }) {
        const rows = await sql`
            UPDATE rooms SET
                landmark_id = COALESCE(${landmark_id || null}, landmark_id),
                room_name   = COALESCE(${room_name || null}, room_name),
                description = COALESCE(${description || null}, description)
            WHERE id = ${id}
            RETURNING id, landmark_id, room_name, description
        `;
        return rows[0] || null;
    },

    /**
     * Xóa room theo ID
     */
    async delete(id) {
        const rows = await sql`
            DELETE FROM rooms WHERE id = ${id}
            RETURNING id, room_name
        `;
        return rows[0] || null;
    }
};

export default RoomModel;

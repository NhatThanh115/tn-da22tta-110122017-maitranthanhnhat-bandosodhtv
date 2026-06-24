// config/database.js
// Kết nối PostgreSQL sử dụng thư viện 'postgres' (postgres.js)

import postgres from 'postgres';

const sql = postgres({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME     || 'postgres',
    username: process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max:      10,           // Pool size tối đa
    idle_timeout: 30,       // Giải phóng kết nối sau 30 giây nhàn rỗi
    connect_timeout: 10,    // Timeout kết nối
    transform: {
        undefined: null     // Tự động chuyển undefined → NULL
    },
    onnotice: (notice) => {
        // Bỏ qua các notice từ PostgreSQL trong quá trình phát triển
        if (process.env.NODE_ENV === 'development') {
            console.log('[DB Notice]', notice.message);
        }
    }
});

// Kiểm tra kết nối khi khởi động
export async function testConnection() {
    try {
        await sql`SELECT 1`;
        console.log('✅ Kết nối PostgreSQL thành công!');
        return true;
    } catch (err) {
        console.error('❌ Không thể kết nối PostgreSQL:', err.message);
        return false;
    }
}

export default sql;

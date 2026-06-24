// server.js
// Entry point của Backend MVC – TVU Digital Map

import 'dotenv/config';
import http    from 'http';
import express from 'express';
import cors    from 'cors';
import { WebSocketServer } from 'ws';

import { testConnection } from './config/database.js';

// Import Routes
import landmarkRoutes from './routes/landmarkRoutes.js';
import pathRoutes     from './routes/pathRoutes.js';
import newsRoutes     from './routes/newsRoutes.js';
import adminRoutes    from './routes/adminRoutes.js';
import roomRoutes     from './routes/roomRoutes.js';

const app        = express();
const httpServer = http.createServer(app);          // HTTP server dùng chung với WS
const PORT       = process.env.PORT || 3000;

// ============================================================
// Middleware
// ============================================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('public/uploads'));

// Logger đơn giản cho môi trường development
if (process.env.NODE_ENV === 'development') {
    app.use((req, _res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
        next();
    });
}

// ============================================================
// WebSocket Server  (cùng cổng với Express, path = /ws)
// ============================================================
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

/** Gửi JSON tới 1 client */
function sendTo(client, event, data = {}) {
    if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({ event, data, ts: Date.now() }));
    }
}

/** Broadcast tới tất cả client đang kết nối */
export function broadcast(event, data = {}) {
    const payload = JSON.stringify({ event, data, ts: Date.now() });
    wss.clients.forEach(client => {
        if (client.readyState === client.OPEN) client.send(payload);
    });
    console.log(`[WS] broadcast → ${event}`, data);
}

wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`[WS] Client kết nối: ${ip}  (tổng: ${wss.clients.size})`);

    // Chào client
    sendTo(ws, 'connected', { message: 'Kết nối WebSocket TVU Digital Map thành công' });

    ws.on('message', raw => {
        try {
            const msg = JSON.parse(raw);
            console.log(`[WS] ← ${ip}:`, msg);

            // Phản hồi ping
            if (msg.event === 'ping') sendTo(ws, 'pong', { ts: Date.now() });
        } catch {
            // ignore non-JSON
        }
    });

    ws.on('close', () => {
        console.log(`[WS] Client ngắt kết nối: ${ip}  (còn lại: ${wss.clients.size})`);
    });

    ws.on('error', err => console.error(`[WS] Lỗi client ${ip}:`, err.message));
});

// ============================================================
// API Routes
// ============================================================
app.use('/api/landmarks',    landmarkRoutes);
app.use('/api/paths',        pathRoutes);
app.use('/api/news',         newsRoutes);
app.use('/api/admin/config', adminRoutes);
app.use('/api/rooms',        roomRoutes);

// ── WebSocket control endpoints ──────────────────────────────

/**
 * POST /api/ws/reload
 * Body: { reason?: string, delay?: number }
 * Yêu cầu toàn bộ client tải lại trang.
 */
app.post('/api/ws/reload', (req, res) => {
    const { reason = 'Server yêu cầu tải lại trang', delay = 1500 } = req.body;
    broadcast('page-reload', { reason, delay });
    res.json({ success: true, clients: wss.clients.size });
});

/**
 * POST /api/ws/navigate
 * Body: { hash: string, delay?: number }
 * Chuyển tất cả client tới trang mới (hash).
 * Ví dụ: { hash: '#map' } → chuyển sang Mappage
 *         { hash: '#admin' } → chuyển sang Adminpage
 *         { hash: '' } → về trang chủ
 */
app.post('/api/ws/navigate', (req, res) => {
    const { hash = '', delay = 1200 } = req.body;
    broadcast('navigate', { hash, delay });
    res.json({ success: true, hash, clients: wss.clients.size });
});

/**
 * POST /api/ws/notify
 * Body: { message: string, type?: 'info'|'success'|'warning'|'error' }
 * Gửi thông báo toast tới toàn bộ client.
 */
app.post('/api/ws/notify', (req, res) => {
    const { message = '', type = 'info' } = req.body;
    broadcast('notify', { message, type });
    res.json({ success: true, clients: wss.clients.size });
});

/**
 * GET /api/ws/status
 * Trả về số client đang kết nối.
 */
app.get('/api/ws/status', (_req, res) => {
    res.json({ success: true, clients: wss.clients.size });
});

// ── Health Check ─────────────────────────────────────────────
app.get('/api/status', async (_req, res) => {
    const dbOk = await testConnection().catch(() => false);
    res.json({
        success:   true,
        message:   'TVU Digital Map Backend đang chạy',
        database:  dbOk ? 'connected' : 'disconnected',
        websocket: wss.clients.size,
        timestamp: new Date().toISOString(),
        version:   '1.0.0'
    });
});

// ── 404 ──────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint không tồn tại' });
});

// ── Global Error ─────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error('[Global Error]', err);
    res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ nội bộ',
        error:   process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ============================================================
// Khởi động server
// ============================================================
async function bootstrap() {
    const dbOk = await testConnection();
    if (!dbOk) {
        console.warn('⚠️  Server khởi động nhưng chưa kết nối được DB. Kiểm tra lại file .env');
    }

    httpServer.listen(PORT, () => {
        console.log(`\n🚀 TVU Digital Map – Server đang chạy trên cổng ${PORT}`);
        console.log(`   → API:  http://localhost:${PORT}/api/status`);
        console.log(`   → WS:   ws://localhost:${PORT}/ws\n`);
        console.log('   WebSocket endpoints:');
        console.log(`   POST /api/ws/reload    – Tải lại tất cả client`);
        console.log(`   POST /api/ws/navigate  – Chuyển trang { hash }`);
        console.log(`   POST /api/ws/notify    – Gửi thông báo { message, type }`);
        console.log(`   GET  /api/ws/status    – Số client kết nối\n`);
    });
}

bootstrap();

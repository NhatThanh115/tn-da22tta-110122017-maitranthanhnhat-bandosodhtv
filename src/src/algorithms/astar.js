// src/algorithms/astar.js
// Service gọi backend API tìm đường A* (pgRouting)
// Dùng phía frontend để tìm node gần nhất và tìm đường ngắn nhất

const API_BASE = '/api';

// Bounding box khuôn viên ĐH Trà Vinh (từ dữ liệu road.sql)
const CAMPUS_BOUNDS = {
    lngMin: 106.345,
    lngMax: 106.351,
    latMin: 9.918,
    latMax: 9.925,
};

// ── 3 điểm vào khuôn viên ────────────────────────────────────────────────────
// Hệ thống sẽ tự động chọn cổng gần điểm đích nhất để tối ưu đường đi nội bộ
const CAMPUS_GATES = [
    {
        label : 'Cổng 1',
        lng   : 106.346493,
        lat   : 9.923712,
        nodeId: null,   // Sẽ được resolve khi cần (lazy)
    },
    {
        label : 'Cổng 2',
        lng   : 106.347432,   // Điểm trong campus (cuối GeoJSON LineString)
        lat   : 9.923535,     // 9.923771 là điểm ngoài cổng, 9.923535 là điểm kết nối vào road graph
        nodeId: null,
    },
    {
        label : 'Đường Trần Văn Giàu',
        lng   : 106.348348,
        lat   : 9.923844,
        nodeId: null,
    },
    {
        label: 'Cổng 3',
        lng: 106.346355,
        lat: 9.923829,
        nodeId: null,
    },
];

// ── Utilities ────────────────────────────────────────────────────────────────

/**
 * Tính khoảng cách Euclidean (đơn vị độ, chỉ dùng để so sánh tương đối)
 */
function euclideanDist(lng1, lat1, lng2, lat2) {
    const dLng = (lng2 - lng1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
    const dLat = lat2 - lat1;
    return Math.sqrt(dLng * dLng + dLat * dLat);
}

// ── Service ──────────────────────────────────────────────────────────────────

const AStarService = {

    /**
     * Kiểm tra một tọa độ có nằm trong khuôn viên trường không
     * @param {number} lat
     * @param {number} lng
     * @returns {boolean}
     */
    isInsideCampus(lat, lng) {
        return (
            lng >= CAMPUS_BOUNDS.lngMin && lng <= CAMPUS_BOUNDS.lngMax &&
            lat >= CAMPUS_BOUNDS.latMin && lat <= CAMPUS_BOUNDS.latMax
        );
    },

    /**
     * Tìm cổng vào campus phù hợp nhất dựa trên vị trí điểm đích.
     * Tiêu chí: cổng có khoảng cách đến điểm đích ngắn nhất
     * → tối ưu hóa đường đi A* bên trong khuôn viên.
     *
     * @param {number} destLng  - Kinh độ điểm đích
     * @param {number} destLat  - Vĩ độ điểm đích
     * @returns {Promise<{ label, lng, lat, nodeId }>}
     */
    async findBestGate(destLng, destLat) {
        // Tính khoảng cách từ mỗi cổng đến điểm đích
        const ranked = CAMPUS_GATES.map(gate => ({
            ...gate,
            dist: euclideanDist(gate.lng, gate.lat, destLng, destLat),
        })).sort((a, b) => a.dist - b.dist);

        const bestGate = ranked[0]; // Cổng gần đích nhất

        // Resolve nodeId nếu chưa có (lazy: chỉ gọi API khi cần)
        if (bestGate.nodeId === null) {
            const node = await this.findNearestNode(bestGate.lng, bestGate.lat);
            // Cập nhật cache vào mảng gốc
            const idx = CAMPUS_GATES.findIndex(g => g.label === bestGate.label);
            if (idx !== -1) CAMPUS_GATES[idx].nodeId = node.id;
            bestGate.nodeId = node.id;
        }

        return bestGate; // { label, lng, lat, nodeId }
    },

    /**
     * Tìm road_node gần nhất với tọa độ (lng, lat)
     * @param {number} lng
     * @param {number} lat
     * @returns {Promise<{id, x, y}>}
     */
    async findNearestNode(lng, lat) {
        const res = await fetch(`${API_BASE}/paths/nodes?near=${lng},${lat}`);
        if (!res.ok) throw new Error('Không thể tìm node gần nhất');
        const result = await res.json();
        if (!result.data) throw new Error('Không có node nào trong DB');
        return result.data;
    },

    /**
     * Tìm đường A* giữa 2 node_id (gọi pgRouting qua backend)
     * @param {number} fromNodeId
     * @param {number} toNodeId
     * @returns {Promise<{total_cost_meters, data: Array}>}
     */
    async findPath(fromNodeId, toNodeId) {
        const res = await fetch(`${API_BASE}/paths/find?from=${fromNodeId}&to=${toNodeId}`);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Không tìm được đường');
        }
        return await res.json();
    },

    /**
     * Lấy GPS vị trí hiện tại của người dùng
     * Chiến lược 2 tầng:
     *   1) High-accuracy (GPS phần cứng) – timeout 6 s
     *   2) Nếu timeout/lỗi → thử lại Low-accuracy (IP/WiFi) – timeout 10 s
     *   3) Nếu vẫn lỗi → thông báo hướng dẫn chọn thủ công
     * @returns {Promise<{lat, lng}>}
     */
    getCurrentPosition() {
        if (!navigator.geolocation) {
            return Promise.reject(new Error('Trình duyệt không hỗ trợ định vị GPS'));
        }

        const tryGPS = (highAccuracy, timeout) =>
            new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    err => reject(err),
                    { enableHighAccuracy: highAccuracy, timeout, maximumAge: 30000 }
                );
            });

        // Tầng 1: high-accuracy (GPS chip) – nhanh, timeout 6 s
        return tryGPS(true, 6000).catch(() =>
            // Tầng 2: low-accuracy (IP/WiFi/cell) – timeout 10 s
            tryGPS(false, 10000).catch(() => {
                throw new Error(
                    'Không lấy được vị trí GPS. Hãy dùng "Chọn điểm bắt đầu trên bản đồ" để chỉ định vị trí thủ công.'
                );
            })
        );
    },
};

export default AStarService;

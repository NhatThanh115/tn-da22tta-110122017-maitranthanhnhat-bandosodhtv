// src/algorithms/pathRenderer.js
// Vẽ đường đi lên Leaflet map theo phong cách Google Maps
// Kỹ thuật: double-layer polyline (viền trắng + màu chính) + animated flow

import L from 'leaflet';

// Lưu trữ tất cả layer để xóa sau
const layers = {
    internalBorder : null,   // Viền trắng bên dưới đường A*
    internalMain   : null,   // Đường A* chính (xanh dương)
    internalFlow   : null,   // Animated dash trên đường A*
    externalBorder : null,   // Viền trắng bên dưới đường OSRM
    externalMain   : null,   // Đường OSRM chính (cam)
    startMarker    : null,
    endMarker      : null,
};

// Inject CSS animation (chỉ 1 lần)
let cssInjected = false;
function injectCSS() {
    if (cssInjected) return;
    cssInjected = true;
    const style = document.createElement('style');
    style.textContent = `
        /* Đường flow animation – nội bộ (xanh) */
        @keyframes flow-internal {
            to { stroke-dashoffset: -24; }
        }
        .path-flow-internal {
            stroke-dasharray: 8, 10;
            animation: flow-internal 0.5s linear infinite;
        }

        /* Pulse marker animation */
        @keyframes pulse-ring {
            0%   { transform: scale(0.5); opacity: 0.8; }
            100% { transform: scale(2);   opacity: 0; }
        }
        .marker-pulse-ring {
            border-radius: 50%;
            animation: pulse-ring 1.4s ease-out infinite;
        }
    `;
    document.head.appendChild(style);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Gom tất cả tọa độ từ mảng steps A* thành Array<[lat, lng]>
 *
 * Fix zigzag: pgRouting có thể duyệt edge theo hướng ngược (target→source)
 * trong khi geom được lưu theo hướng source→target.
 * Hàm này nối các edge lại đúng thứ tự bằng cách kiểm tra điểm đầu/cuối
 * và đảo ngược tọa độ khi cần.
 */
function stepsToLatLngs(steps) {
    // Lọc bỏ step không có geom (bước cuối pgRouting thường có edge = -1)
    const validSteps = steps.filter(s => {
        if (!s.geom) return false;
        const g = typeof s.geom === 'string' ? JSON.parse(s.geom) : s.geom;
        return g.type === 'LineString' && g.coordinates && g.coordinates.length >= 2;
    });

    if (validSteps.length === 0) return [];

    // Chuyển sang mảng tọa độ [lng, lat] cho từng step
    const edgeCoords = validSteps.map(s => {
        const g = typeof s.geom === 'string' ? JSON.parse(s.geom) : s.geom;
        return g.coordinates; // Array of [lng, lat]
    });

    const result = [];

    // Thêm toàn bộ tọa độ edge đầu tiên
    edgeCoords[0].forEach(([lng, lat]) => result.push([lat, lng]));

    // Với mỗi edge tiếp theo, kiểm tra hướng và nối liền mạch
    for (let i = 1; i < edgeCoords.length; i++) {
        const prev    = edgeCoords[i - 1];
        const current = edgeCoords[i];

        // Điểm cuối của edge trước (đã thêm vào result)
        const prevEnd   = prev[prev.length - 1]; // [lng, lat]
        const curFirst  = current[0];             // [lng, lat]
        const curLast   = current[current.length - 1];

        // Tính khoảng cách để xác định chiều nối
        const distToFirst = Math.abs(prevEnd[0] - curFirst[0]) + Math.abs(prevEnd[1] - curFirst[1]);
        const distToLast  = Math.abs(prevEnd[0] - curLast[0])  + Math.abs(prevEnd[1] - curLast[1]);

        let coords = current;
        if (distToLast < distToFirst) {
            // Edge đang được duyệt ngược → đảo chiều
            coords = [...current].reverse();
        }

        // Bỏ điểm đầu (trùng với điểm cuối edge trước) để tránh duplicate
        coords.slice(1).forEach(([lng, lat]) => result.push([lat, lng]));
    }

    return result;
}

/**
 * Xóa một layer khỏi map nếu tồn tại
 */
function removeLayer(key, map) {
    if (layers[key]) { layers[key].remove(); layers[key] = null; }
}

// ── Public API ────────────────────────────────────────────────────────────────

const PathRenderer = {

    /**
     * Vẽ đường A* nội bộ theo kiểu Google Maps
     * @param {L.Map}  map
     * @param {Array}  steps        – data[] từ find_path_astar()
     * @param {[lat,lng]|null} startLatLng – tọa độ điểm xuất phát thực tế (prepend)
     * @param {[lat,lng]|null} destLatLng  – tọa độ điểm đích thực tế (snap + append)
     */
    drawInternalPath(map, steps, startLatLng = null, destLatLng = null) {
        injectCSS();
        let latlngs = stepsToLatLngs(steps);
        if (latlngs.length === 0) return;

        // ── Snap điểm đầu về vị trí thực tế của người dùng ──────────────────
        // (tránh đường "nhảy" từ road node về user position)
        if (startLatLng) {
            latlngs = [startLatLng, ...latlngs];
        }

        // ── Snap điểm cuối về tọa độ landmark thực tế ────────────────────────
        // Vấn đề: edge cuối của A* có geometry chạy QUA destNode (road node),
        // nên điểm cuối của latlngs ≠ vị trí landmark → đường "vẽ lố".
        // Fix: tìm điểm cuối thực sự gần destLatLng nhất trong path,
        //      cắt bỏ phần thừa rồi append đúng tọa độ landmark.
        if (destLatLng) {
            const [dLat, dLng] = destLatLng;

            // Tìm index của điểm gần destLatLng nhất trong path đã gom
            let closestIdx  = latlngs.length - 1;
            let closestDist = Infinity;
            latlngs.forEach(([lat, lng], idx) => {
                const d = Math.abs(lat - dLat) + Math.abs(lng - dLng);
                if (d < closestDist) { closestDist = d; closestIdx = idx; }
            });

            // Ngưỡng: nếu điểm gần nhất còn cách khá xa (> ~50 m ≈ 0.0005°)
            // → giữ toàn bộ path rồi append; nếu gần → cắt phần thừa
            const THRESHOLD = 0.001; // ~110 m
            if (closestDist < THRESHOLD && closestIdx < latlngs.length - 1) {
                // Cắt bỏ những điểm "vẽ lố" phía sau node đích gần nhất
                latlngs = latlngs.slice(0, closestIdx + 1);
            }

            // Append đúng tọa độ landmark để đường kết thúc tại pin
            latlngs.push(destLatLng);
        }

        // Lớp 1 – viền trắng dày (tạo hiệu ứng drop-shadow/outline)
        layers.internalBorder = L.polyline(latlngs, {
            color   : '#ffffff',
            weight  : 13,
            opacity : 0.85,
            lineCap : 'round',
            lineJoin: 'round',
        }).addTo(map);

        // Lớp 2 – màu chính xanh dương đậm (Google Maps blue)
        layers.internalMain = L.polyline(latlngs, {
            color   : '#1A73E8',
            weight  : 8,
            opacity : 1,
            lineCap : 'round',
            lineJoin: 'round',
        }).addTo(map);

        // Lớp 3 – animated flow (chấm trắng chạy dọc)
        layers.internalFlow = L.polyline(latlngs, {
            color    : '#ffffff',
            weight   : 4,
            opacity  : 0.85,
            lineCap  : 'round',
            lineJoin : 'round',
            className: 'path-flow-internal',
        }).addTo(map);

        // fitBounds được gọi từ handleFindPath (Mappage.vue) để bao quát cả start + dest
    },

    /**
     * Vẽ đường OSRM bên ngoài khuôn viên (màu cam, nét đứt có viền)
     * @param {L.Map} map
     * @param {Array} coords  – Array<[lat, lng]> từ OsrmService
     */
    drawExternalPath(map, coords) {
        injectCSS();
        if (coords.length === 0) return;

        // Lớp 1 – viền trắng
        layers.externalBorder = L.polyline(coords, {
            color   : '#ffffff',
            weight  : 11,
            opacity : 0.8,
            lineCap : 'round',
            lineJoin: 'round',
        }).addTo(map);

        // Lớp 2 – màu cam (màu khác biệt so với trong campus)
        layers.externalMain = L.polyline(coords, {
            color     : '#1A73E8',
            weight    : 6,
            opacity   : 1,
            dashArray : '14, 8',
            lineCap   : 'round',
            lineJoin  : 'round',
        }).addTo(map);
    },

    /**
     * Đặt marker điểm xuất phát (xanh lá, có pulse ring)
     */
    setStartMarker(map, lat, lng, label = 'Vị trí của bạn') {
        removeLayer('startMarker', map);

        const icon = L.divIcon({
            className : '',
            iconSize  : [48, 48],
            iconAnchor: [24, 24],
            html: `
                <div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;">
                    <!-- Pulse ring -->
                    <div class="marker-pulse-ring" style="
                        position:absolute;
                        width:40px;height:40px;
                        background:rgba(34,197,94,0.35);
                        border:2px solid rgba(34,197,94,0.5);
                    "></div>
                    <!-- Core dot -->
                    <div style="
                        width:22px;height:22px;border-radius:50%;
                        background:#22C55E;
                        border:3px solid #fff;
                        box-shadow:0 2px 10px rgba(34,197,94,0.7);
                        display:flex;align-items:center;justify-content:center;
                        position:relative;z-index:1;
                    ">
                        <div style="width:8px;height:8px;border-radius:50%;background:#fff;"></div>
                    </div>
                </div>`,
        });

        layers.startMarker = L.marker([lat, lng], { icon, zIndexOffset: 500 })
            .bindPopup(`<b style="color:#16A34A">📍 ${label}</b>`, { offset: [0, -12] })
            .addTo(map);
    },

    /**
     * Đặt marker điểm đích (đỏ, hình giọt nước kiểu Google Maps)
     */
    setEndMarker(map, lat, lng, label = 'Điểm đến') {
        removeLayer('endMarker', map);

        const icon = L.divIcon({
            className : '',
            iconSize  : [36, 52],
            iconAnchor: [18, 50],
            html: `
                <div style="position:relative;width:36px;height:52px;display:flex;flex-direction:column;align-items:center;">
                    <!-- Pin body -->
                    <div style="
                        width:36px;height:36px;border-radius:50% 50% 50% 0;
                        background:#EA4335;
                        border:3px solid #fff;
                        box-shadow:0 3px 14px rgba(234,67,53,0.55);
                        transform:rotate(-45deg);
                        display:flex;align-items:center;justify-content:center;
                    ">
                        <div style="
                            width:14px;height:14px;border-radius:50%;
                            background:#fff;
                            transform:rotate(45deg);
                        "></div>
                    </div>
                    <!-- Pin shadow -->
                    <div style="
                        width:12px;height:6px;border-radius:50%;
                        background:rgba(0,0,0,0.22);
                        margin-top:2px;
                    "></div>
                </div>`,
        });

        layers.endMarker = L.marker([lat, lng], { icon, zIndexOffset: 600 })
            .bindPopup(`<b style="color:#DC2626">🏁 ${label}</b>`, { offset: [0, -48] })
            .addTo(map);
    },

    /**
     * Xóa tất cả path layers và markers
     * @param {L.Map} map
     */
    clearAll(map) {
        Object.keys(layers).forEach(key => removeLayer(key, map));
    },
};

export default PathRenderer;

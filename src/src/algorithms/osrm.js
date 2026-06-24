// src/algorithms/osrm.js
// Service gọi OSRM (Open Source Routing Machine) – public API, miễn phí
// Dùng để chỉ đường từ vị trí ngoài khuôn viên đến cổng trường

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

const OsrmService = {

    /**
     * Lấy tuyến đường từ điểm A đến điểm B qua OSRM
     * @param {number} fromLng  - Kinh độ điểm xuất phát
     * @param {number} fromLat  - Vĩ độ điểm xuất phát
     * @param {number} toLng    - Kinh độ điểm đến
     * @param {number} toLat    - Vĩ độ điểm đến
     * @returns {Promise<{ coords: Array<[lat, lng]>, distanceMeters: number, durationSeconds: number }>}
     */
    async getRoute(fromLng, fromLat, toLng, toLat) {
        const url = `${OSRM_BASE}/${fromLng},${fromLat};${toLng},${toLat}` +
                    `?overview=full&geometries=geojson&steps=false`;

        const res = await fetch(url);
        if (!res.ok) throw new Error('Không thể kết nối OSRM');

        const data = await res.json();

        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            throw new Error('OSRM không tìm được tuyến đường');
        }

        const route = data.routes[0];
        // GeoJSON coords là [lng, lat] → chuyển sang [lat, lng] cho Leaflet
        const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

        return {
            coords,                              // Array<[lat, lng]> cho Leaflet polyline
            distanceMeters: route.distance,      // Khoảng cách (m)
            durationSeconds: route.duration,     // Thời gian ước tính (giây)
        };
    },
};

export default OsrmService;

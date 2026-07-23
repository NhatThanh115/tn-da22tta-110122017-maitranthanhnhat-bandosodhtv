<script setup>
import { onMounted, onBeforeUnmount, ref, nextTick, watch } from 'vue';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './Mappage.css';
import AStarService  from './algorithms/astar.js';
import OsrmService   from './algorithms/osrm.js';
import PathRenderer  from './algorithms/pathRenderer.js';
import { useSearchWithRooms, fetchLandmarks } from './utils/Search.js';

/* ──────────────────────────────
   Leaflet icon fix (Vite)
────────────────────────────── */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* ──────────────────────────────
   Map refs
────────────────────────────── */
const mapContainer = ref(null);
let   map          = null;

/* ──────────────────────────────
   Tile layers
────────────────────────────── */
const currentLayer    = ref('street');   // 'street' | 'satellite'
const showLayerPanel  = ref(false);      // panel chọn layer
let   streetTile      = null;
let   satelliteTile   = null;

const LAYERS = {
  street: {
    label: 'Bản đồ đường',
    icon:  'fa-map',
    url:   'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 19, minZoom: 5,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  satellite: {
    label: 'Ảnh vệ tinh',
    icon:  'fa-satellite',
    url:   'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 19, minZoom: 5,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    },
  },
};

function toggleLayer(layerKey) {
  if (!map) return;
  if (layerKey === currentLayer.value) { showLayerPanel.value = false; return; }

  const prev = currentLayer.value;
  if (prev === 'street'    && streetTile)    map.removeLayer(streetTile);
  if (prev === 'satellite' && satelliteTile) map.removeLayer(satelliteTile);

  currentLayer.value = layerKey;
  if (layerKey === 'street'    && streetTile)    streetTile.addTo(map);
  if (layerKey === 'satellite' && satelliteTile) satelliteTile.addTo(map);

  showLayerPanel.value = false;
}

/* ──────────────────────────────
   State
────────────────────────────── */
const campusLocations  = ref([]);
const selectedLocation = ref(null);
const activeTab        = ref('map');

// State – phòng học của landmark đang chọn
const landmarkRooms = ref([]);   // danh sách phòng của tòa nhà
const selectedRoom  = ref(null); // phòng được chọn trong info panel

async function fetchLandmarkRooms(landmarkId) {
  if (!landmarkId) { landmarkRooms.value = []; return; }
  try {
    const res  = await fetch(`/api/rooms?landmark_id=${landmarkId}`);
    const json = await res.json();
    landmarkRooms.value = json.success ? json.data : [];
  } catch {
    landmarkRooms.value = [];
  }
}

function toggleRoomSelect(room) {
  selectedRoom.value = selectedRoom.value?.id === room.id ? null : room;
}

// Search composable (có hỗ trợ tìm phòng)
const {
  searchQuery,
  activeChip,
  chips,
  filteredLocations,
  filteredRooms,
  clearSearch,
  selectChip,
} = useSearchWithRooms(campusLocations);

// Direction state
const directionMode  = ref(false);
const isNavigating   = ref(false);
const isLoadingPath  = ref(false);
const navError       = ref('');

/* ──────────────────────────────
   Chọn điểm bắt đầu
   - 'gps'    → dùng GPS (mặc định)
   - 'custom' → chọn thủ công trên bản đồ
────────────────────────────── */
const startMode        = ref('gps');   // 'gps' | 'custom'
const pickingStartOnMap = ref(false);  // đang trong chế độ chọn trên bản đồ
const customStartPos   = ref(null);   // { lat, lng, label }
let   startMarkerLayer = null;        // L.marker cho điểm bắt đầu tùy chỉnh

/** Bắt đầu chế độ chọn trên bản đồ — thu gọn sheet để lộ bản đồ */
function startPickMode() {
  pickingStartOnMap.value = true;
  sheetExpanded.value = false;          // ← thu gọn sheet
  if (map) map.getContainer().style.cursor = 'crosshair';
}

/** Huỷ chế độ chọn — mở lại sheet */
function cancelPickMode() {
  pickingStartOnMap.value = false;
  sheetExpanded.value = true;           // ← mở lại sheet
  if (map) map.getContainer().style.cursor = '';
}

/** Xóa marker điểm bắt đầu tùy chỉnh khỏi bản đồ */
function clearCustomStartMarker() {
  if (startMarkerLayer) { startMarkerLayer.remove(); startMarkerLayer = null; }
}

/** Xử lý khi người dùng nhấn bản đồ trong pick mode */
function onMapPickClick(e) {
  if (!pickingStartOnMap.value) return;

  const { lat, lng } = e.latlng;
  customStartPos.value = { lat, lng, label: `Điểm chọn (${lat.toFixed(5)}, ${lng.toFixed(5)})` };

  // Hiển thị marker xanh lá cây tại vị trí chọn
  clearCustomStartMarker();
  const icon = L.divIcon({
    className: 'gm-pick-icon',
    html: '<div class="gm-pick-dot"></div>',
    iconSize:   [24, 24],
    iconAnchor: [12, 12],
  });
  startMarkerLayer = L.marker([lat, lng], { icon }).addTo(map);
  startMarkerLayer.bindPopup('Điểm bắt đầu').openPopup();

  startMode.value         = 'custom';
  pickingStartOnMap.value = false;
  sheetExpanded.value     = true;       // ← mở lại sheet sau khi chọn xong
  if (map) map.getContainer().style.cursor = '';
}

/** Reset về GPS */
function resetToGps() {
  startMode.value      = 'gps';
  customStartPos.value = null;
  clearCustomStartMarker();
  cancelPickMode();
}

/* ──────────────────────────────
   Sheet expand/collapse (mobile)
   - true  = mở rộng (mặc định)
   - false = thu gọn (khi đang navigate)
────────────────────────────── */
const sheetExpanded = ref(true);

// Touch drag để mở / đóng sheet
let touchStartY = 0;
function onHandleTouchStart(e) {
  touchStartY = e.touches[0].clientY;
}
function onHandleTouchEnd(e) {
  const deltaY = e.changedTouches[0].clientY - touchStartY;
  // kéo lên (deltaY âm) → expand; kéo xuống (deltaY dương) → collapse
  if (deltaY < -30)  sheetExpanded.value = true;
  if (deltaY >  30)  sheetExpanded.value = false;
}

/* ──────────────────────────────
   Category chips – từ Search.js
────────────────────────────── */

/* ──────────────────────────────
   filteredLocations – từ useSearch()
────────────────────────────── */

/* ──────────────────────────────
   Select / close location
────────────────────────────── */
function selectLocation(loc) {
  stopNavigation();
  selectedLocation.value = loc;
}

/**
 * Chọn từ kết quả tìm kiếm:
 * - Đóng dropdown, xóa query
 * - Fly-to tọa độ của landmark trên bản đồ
 * - Mở sidebar/bottom-sheet
 */
function selectFromSearch(loc) {
  const parsed = {
    ...loc,
    image:      loc.image_url || loc.image || '',
    department: loc.category  || loc.department || '',
  };

  // Lấy tọa độ
  let lat = null, lng = null;
  if (loc.geom) {
    const geo = typeof loc.geom === 'string' ? JSON.parse(loc.geom) : loc.geom;
    if (geo.type === 'Point') { [lng, lat] = geo.coordinates; }
  } else if (Array.isArray(loc.coords)) {
    [lat, lng] = loc.coords;
  }

  clearSearch();
  selectLocation(parsed);

  // Fly-to trên bản đồ
  if (map && lat !== null && lng !== null) {
    map.flyTo([lat, lng], 19, { duration: 0.8 });
  }
}

/**
 * Chọn phòng từ kết quả tìm kiếm:
 * - Tìm landmark liên kết qua landmark_id
 * - Fly-to và mở info panel của tòa nhà
 * - Tự động highlight phòng trong info panel
 */
function selectFromRoom(room) {
  clearSearch();
  if (!room.landmark_id) return;
  const landmark = campusLocations.value.find(
    l => l.id === room.landmark_id || String(l.id) === String(room.landmark_id)
  );
  if (landmark) {
    selectFromSearch(landmark);
    nextTick(() => { selectedRoom.value = room; });
  }
}

function closeDetail() {
  selectedLocation.value = null;
  stopNavigation();
}

/* ──────────────────────────────
   Direction helpers
────────────────────────────── */
function openDirectionMode() {
  directionMode.value = true;
  navError.value = '';
}
function stopNavigation() {
  if (map) PathRenderer.clearAll(map);
  isNavigating.value  = false;
  directionMode.value = false;
  navError.value      = '';
  sheetExpanded.value = true;
  resetToGps();           // reset điểm bắt đầu về mặc định
  cancelPickMode();
}

async function handleFindPath() {
  if (!selectedLocation.value) return;
  navError.value      = '';
  isLoadingPath.value = true;
  try {
    /* 1. Xác định điểm bắt đầu */
    let userPos;
    if (startMode.value === 'custom' && customStartPos.value) {
      userPos = { lat: customStartPos.value.lat, lng: customStartPos.value.lng };
    } else {
      userPos = await AStarService.getCurrentPosition();
    }

    /* 2. Điểm đích */
    const destGeom   = selectedLocation.value.geom;
    const destCoords = destGeom
      ? (typeof destGeom === 'string' ? JSON.parse(destGeom) : destGeom).coordinates
      : null;
    if (!destCoords) throw new Error('Không lấy được tọa độ điểm đến');
    const [destLng, destLat] = destCoords;

    const destNode = await AStarService.findNearestNode(destLng, destLat);
    PathRenderer.setEndMarker(map, destLat, destLng, selectedLocation.value.name);

    /* 3. Tìm đường */
    const inside = AStarService.isInsideCampus(userPos.lat, userPos.lng);
    const startLabel = startMode.value === 'custom'
      ? (customStartPos.value?.label || 'Điểm chọn')
      : 'Vị trí GPS của bạn';

    if (inside) {
      const nearestNode = await AStarService.findNearestNode(userPos.lng, userPos.lat);
      const pathResult  = await AStarService.findPath(nearestNode.id, destNode.id);
      PathRenderer.setStartMarker(map, userPos.lat, userPos.lng, startLabel);
      PathRenderer.drawInternalPath(
        map,
        pathResult.data,
        [userPos.lat, userPos.lng],   // snap điểm đầu về vị trí thực
        [destLat, destLng],           // snap điểm cuối về tọa độ landmark
      );
    } else {
      const bestGate  = await AStarService.findBestGate(destLng, destLat);
      const osrmRoute = await OsrmService.getRoute(
        userPos.lng, userPos.lat, bestGate.lng, bestGate.lat
      );
      PathRenderer.setStartMarker(map, userPos.lat, userPos.lng, startLabel);
      PathRenderer.drawExternalPath(map, osrmRoute.coords);
      const pathResult = await AStarService.findPath(bestGate.nodeId, destNode.id);
      // Đường nội bộ: snap điểm đầu về cổng, điểm cuối về landmark
      PathRenderer.drawInternalPath(
        map,
        pathResult.data,
        [bestGate.lat, bestGate.lng], // snap từ cổng vào
        [destLat, destLng],           // snap điểm cuối về tọa độ landmark
      );
    }

    /* 4. Phóng to bao quát cả điểm bắt đầu lẫn điểm đích */
    const bounds = L.latLngBounds(
      [userPos.lat, userPos.lng],
      [destLat, destLng]
    );
    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 19, animate: true, duration: 0.8 });

    isNavigating.value  = true;
    sheetExpanded.value = false;
  } catch (err) {
    console.error('[Mappage] handleFindPath', err);
    navError.value = err.message || 'Lỗi không xác định';
  } finally {
    isLoadingPath.value = false;
  }
}


/* ──────────────────────────────
   Map init
────────────────────────────── */

// Registry lưu tất cả marker để quản lý opacity
const markerRegistry = []; // { marker: L.Marker, id: number|string }

function addMarkersToMap() {
  campusLocations.value.forEach(loc => {
    let coords = loc.coords;
    if (loc.geom) {
      const geo = typeof loc.geom === 'string' ? JSON.parse(loc.geom) : loc.geom;
      if (geo.type === 'Point') coords = [geo.coordinates[1], geo.coordinates[0]];
    }
    const marker = L.marker(coords).addTo(map);
    const parsed = { ...loc, coords, image: loc.image_url || loc.image, department: loc.category || loc.department };
    markerRegistry.push({ marker, id: loc.id });
    marker.on('click', () => selectLocation(parsed));
  });
}

/**
 * Cập nhật opacity của tất cả marker:
 * - Nếu đang chọn một landmark: chỉ hiện rõ marker đó, mờ còn lại
 * - Nếu đang tìm kiếm: chỉ hiện rõ marker khaóp, mờ còn lại
 * - Bình thường: tất cả opacity 1
 */
function updateMarkersOpacity() {
  if (!markerRegistry.length) return;

  if (selectedLocation.value) {
    const selId = selectedLocation.value.id;
    markerRegistry.forEach(({ marker, id }) => {
      marker.setOpacity(id === selId ? 1 : 0.1);
    });
  } else if (searchQuery.value.trim()) {
    const matchedIds = new Set(filteredLocations.value.map(l => l.id));
    markerRegistry.forEach(({ marker, id }) => {
      marker.setOpacity(matchedIds.has(id) ? 1 : 0.1);
    });
  } else {
    markerRegistry.forEach(({ marker }) => marker.setOpacity(1));
  }
}

function initMap() {
  if (!mapContainer.value || map) return;
  map = L.map(mapContainer.value, { zoomControl: false }).setView([9.92345, 106.34785], 17);

  // Tạo sẵn cả 2 tile layers
  streetTile    = L.tileLayer(LAYERS.street.url,    LAYERS.street.options);
  satelliteTile = L.tileLayer(LAYERS.satellite.url, LAYERS.satellite.options);

  // Thêm layer mặc định (street)
  streetTile.addTo(map);
  currentLayer.value = 'street';

  L.control.zoom({ position: 'bottomright' }).addTo(map);
  addMarkersToMap();

  // Lắng nghe click bản đồ cho chế độ chọn điểm bắt đầu
  map.on('click', onMapPickClick);

  // Đóng layer panel khi click bản đồ
  map.on('click', () => { showLayerPanel.value = false; });
}

/* fetchLandmarks – từ Search.js */

/* Locate user */
function locateUser() {
  if (!map) return;
  map.locate({ setView: true, maxZoom: 18 });
}

/**
 * Đọc nav_highlight từ sessionStorage (được ghi bởi NewsDetailpage).
 * Nếu tìm thấy landmark → fly-to và mở sidebar/bottom-sheet.
 */
function applyNavHighlight() {
  const raw = sessionStorage.getItem('nav_highlight');
  if (!raw) return;
  sessionStorage.removeItem('nav_highlight');

  try {
    const { landmark_id, landmark_name, lat, lng } = JSON.parse(raw);

    // Tìm landmark trong danh sách đã load từ API
    let found = null;
    if (landmark_id) {
      found = campusLocations.value.find(l => l.id === landmark_id || String(l.id) === String(landmark_id));
    }
    if (!found && landmark_name) {
      const nameLower = landmark_name.toLowerCase();
      found = campusLocations.value.find(l => l.name?.toLowerCase() === nameLower);
    }

    if (found) {
      // Gọi selectFromSearch để fly-to và mở sidebar
      selectFromSearch(found);
    } else if (lat && lng && map) {
      // Fallback: fly-to tọa độ ngay cả khi không tìm thấy landmark
      map.flyTo([lat, lng], 19, { duration: 0.8 });
    }
  } catch (e) {
    console.warn('[Mappage] applyNavHighlight parse error:', e);
  }
}

onMounted(async () => {
  await nextTick();
  await fetchLandmarks(campusLocations);
  initMap();
  // Sau khi map sẵn sàng, kiểm tra xem có landmark cần highlight không
  setTimeout(applyNavHighlight, 150);
});

onBeforeUnmount(() => {
  if (map) { map.remove(); map = null; }
});

// Watch: làm mờ marker khi tìm kiếm
watch(
  () => [searchQuery.value, filteredLocations.value],
  () => { if (!selectedLocation.value) updateMarkersOpacity(); },
  { deep: true }
);

// Watch: làm mờ marker khi chọn / đóng landmark
watch(selectedLocation, (loc) => {
  updateMarkersOpacity();
  selectedRoom.value = null;
  if (loc?.id) fetchLandmarkRooms(loc.id);
  else landmarkRooms.value = [];
});
</script>

<template>
  <div class="mappage-root">

    <!-- ══════════════════════════════════════════
         FULL-SCREEN MAP LAYER
    ══════════════════════════════════════════ -->
    <div class="gm-map-layer">
      <div ref="mapContainer" class="leaflet-map-container"></div>
    </div>

    <!-- ══════════════════════════════════════════
         PICK MODE BANNER (xuất hiện khi chọn điểm trên bản đồ)
    ══════════════════════════════════════════ -->
    <transition name="fade">
      <div v-if="pickingStartOnMap" class="gm-pick-banner" id="gm-pick-banner">
        <div class="gm-pick-banner-inner">
          <i class="fa-solid fa-crosshairs"></i>
          <span>Nhấn vào vị trí bắt đầu trên bản đồ</span>
          <button class="gm-pick-cancel" id="gm-pick-cancel" @click="cancelPickMode">
            <i class="fa-solid fa-xmark"></i> Huỷ
          </button>
        </div>
      </div>
    </transition>

    <!-- ══════════════════════════════════════════
         FLOATING SEARCH BAR (Desktop, top-left)
    ══════════════════════════════════════════ -->
    <div class="gm-float-search" id="gm-float-search">
      <div class="gm-float-top-row">
        <button class="gm-back-home-btn" id="gm-back-home-btn" @click="$router.push({ name: 'Homepage' })" title="Trở về Homepage">
          <i class="fa-solid fa-house"></i>
        </button>
        <div class="gm-brand-pill">
          <div class="gm-logo"><i class="fa-solid fa-graduation-cap"></i></div>
          <span class="gm-brand-name">TVU Digital Map</span>
        </div>
      </div>
      <!-- Search box + Dropdown wrapper -->
      <div class="gm-search-wrap">
        <div class="gm-search-box" id="gm-search-box">
          <i class="fa-solid fa-magnifying-glass gm-search-icon"></i>
          <input
            v-model="searchQuery"
            type="text"
            class="gm-search-input"
            id="gm-search-input"
            placeholder="Tìm tòa nhà, phòng học, khoa..."
            autocomplete="off"
          />
          <button
            v-if="searchQuery"
            class="gm-search-clear"
            id="gm-search-clear"
            @click="clearSearch"
            aria-label="Xoá"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Dropdown kết quả tìm kiếm -->
        <transition name="fade">
          <div
            v-if="searchQuery && (filteredLocations.length || filteredRooms.length)"
            class="gm-search-results"
            id="gm-search-results"
          >
            <!-- Nhóm: Tòa nhà / Địa điểm -->
            <template v-if="filteredLocations.length">
              <div class="gm-search-group-label"><i class="fa-solid fa-building"></i> Tòa nhà / Địa điểm</div>
              <div
                v-for="loc in filteredLocations.slice(0, 4)"
                :key="'lm-' + loc.id"
                class="gm-search-result-item"
                @click="selectFromSearch(loc)"
              >
                <i class="fa-solid fa-location-dot gm-sr-icon"></i>
                <div class="gm-sr-text">
                  <span class="gm-sr-name">{{ loc.name }}</span>
                  <span class="gm-sr-cat">{{ loc.category }}</span>
                </div>
              </div>
            </template>
            <!-- Nhóm: Phòng học -->
            <template v-if="filteredRooms.length">
              <div class="gm-search-group-label"><i class="fa-solid fa-door-open"></i> Phòng học</div>
              <div
                v-for="room in filteredRooms.slice(0, 4)"
                :key="'rm-' + room.id"
                class="gm-search-result-item"
                @click="selectFromRoom(room)"
              >
                <i class="fa-solid fa-door-open gm-sr-icon" style="color:#6366f1"></i>
                <div class="gm-sr-text">
                  <span class="gm-sr-name">{{ room.room_name }}</span>
                  <span class="gm-sr-cat">
                    <i class="fa-solid fa-door-open" style="font-size:0.75em;margin-right:3px"></i>
                    {{ room.description ? room.description.slice(0, 55) + (room.description.length > 55 ? '...' : '') : 'Nhấn để xem vị trí' }}
                  </span>
                </div>
              </div>
            </template>
          </div>
          <div
            v-else-if="searchQuery && !filteredLocations.length && !filteredRooms.length"
            class="gm-search-results gm-search-results-empty"
            id="gm-search-empty"
          >
            <span class="gm-sr-empty">
              <i class="fa-solid fa-circle-exclamation"></i>
              Không tìm thấy “{{ searchQuery }}”
            </span>
          </div>
        </transition>
      </div><!-- /gm-search-wrap -->
    </div>

    <!-- ══════════════════════════════════════════
         LEFT SIDEBAR — hiện khi chọn địa điểm
    ══════════════════════════════════════════ -->
    <transition name="sidebar-slide">
      <aside
        v-if="selectedLocation"
        class="gm-sidebar gm-info-sidebar"
        id="gm-sidebar"
      >
        <!-- ── Ảnh cover ── -->
        <div class="gm-sb-img-wrap">
          <img
            :src="selectedLocation.image || 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&q=80'"
            :alt="selectedLocation.name"
            class="gm-sb-img"
          />
          <div class="gm-sb-img-overlay"></div>
          <!-- Nút đóng sidebar -->
          <button class="gm-sb-close" id="gm-sb-close" @click="closeDetail" aria-label="Đóng">
            <i class="fa-solid fa-xmark"></i>
          </button>
          <span v-if="selectedLocation.department" class="gm-detail-badge">
            {{ selectedLocation.department }}
          </span>
        </div>

        <!-- ── Nội dung cuộn ── -->
        <div class="gm-sb-body">

          <!-- Tên & mô tả -->
          <h2 class="gm-detail-title">{{ selectedLocation.name }}</h2>
          <p class="gm-detail-desc">{{ selectedLocation.description }}</p>

          <!-- Room Selector (sidebar desktop) -->
          <div v-if="landmarkRooms.length" class="room-selector-wrap">
            <div class="room-selector-header">
              <i class="fa-solid fa-door-open"></i>
              Chọn phòng <span class="room-count-badge">{{ landmarkRooms.length }}</span>
            </div>
            <div class="room-chips">
              <button
                v-for="r in landmarkRooms"
                :key="r.id"
                class="room-chip"
                :class="{ 'room-chip-active': selectedRoom?.id === r.id }"
                @click="toggleRoomSelect(r)"
              >
                {{ r.room_name }}
              </button>
            </div>
            <transition name="fade">
              <div v-if="selectedRoom" class="room-desc-card">
                <div class="room-desc-name">
                  <i class="fa-solid fa-door-open"></i> {{ selectedRoom.room_name }}
                </div>
                <p class="room-desc-text">{{ selectedRoom.description }}</p>
              </div>
            </transition>
          </div>

          <!-- ── Nút hành động (khi chưa mở direction) ── -->
          <template v-if="!directionMode">
            <div class="gm-detail-actions">
              <button class="gm-action-btn gm-action-btn-primary" id="gm-detail-directions" @click="openDirectionMode">
                <i class="fa-solid fa-route"></i> Chỉ đường
              </button>
              <button class="gm-action-btn" id="gm-detail-save" aria-label="Lưu">
                <i class="fa-regular fa-bookmark"></i>
                <span>Lưu</span>
              </button>
              <button class="gm-action-btn" id="gm-detail-share" aria-label="Chia sẻ">
                <i class="fa-solid fa-share-nodes"></i>
                <span>Chia sẻ</span>
              </button>
            </div>
          </template>

          <!-- ── Direction panel (trong sidebar) ── -->
          <transition name="fade">
            <div v-if="directionMode" class="gm-dir-panel" id="gm-dir-panel">

              <!-- Hàng điểm bắt đầu -->
              <div class="gm-dir-row gm-dir-row-start" :class="{ 'gm-dir-row-custom': startMode === 'custom' }">
                <i class="fa-solid fa-circle-dot" style="color:#34a853"></i>
                <span class="gm-dir-start-label">
                  {{ startMode === 'custom' && customStartPos
                      ? customStartPos.label
                      : 'Vị trí GPS của bạn' }}
                </span>
                <button v-if="startMode === 'custom'" class="gm-dir-reset-btn" @click="resetToGps" title="Dùng GPS">
                  <i class="fa-solid fa-rotate-left"></i>
                </button>
              </div>

              <!-- Nút chọn trên bản đồ -->
              <button class="gm-dir-pick-btn" id="gm-dir-pick-btn" @click="startPickMode">
                <i class="fa-solid fa-map-pin"></i>
                Chọn điểm bắt đầu trên bản đồ
              </button>

              <!-- Đường chấm nối -->
              <div class="gm-dir-dot-line">
                <span></span><span></span><span></span>
              </div>

              <!-- Hàng điểm đến -->
              <div class="gm-dir-row">
                <i class="fa-solid fa-location-dot" style="color:#ea4335"></i>
                <span>{{ selectedLocation.name }}</span>
              </div>

              <div v-if="navError" class="gm-dir-error">
                <i class="fa-solid fa-triangle-exclamation"></i> {{ navError }}
              </div>

              <div class="gm-dir-actions">
                <button
                  class="gm-btn-find"
                  id="gm-btn-find"
                  @click="handleFindPath"
                  :disabled="isLoadingPath"
                >
                  <i class="fa-solid" :class="isLoadingPath ? 'fa-spinner fa-spin' : 'fa-location-arrow'"></i>
                  {{ isLoadingPath ? 'Đang tìm...' : 'Tìm đường' }}
                </button>
                <button class="gm-btn-stop" id="gm-btn-stop" @click="stopNavigation">
                  <i class="fa-solid fa-stop"></i> Dừng
                </button>
              </div>

              <!-- Nút quay lại xem thông tin -->
              <button class="gm-dir-back-btn" @click="directionMode = false">
                <i class="fa-solid fa-arrow-left"></i> Quay lại thông tin
              </button>
            </div>
          </transition>

        </div>
      </aside>
    </transition><!-- /gm-sidebar -->

    <!-- ══════════════════════════════════════════
         MOBILE BOTTOM SHEET (≤ 768px)
         Thay thế sidebar — hiện khi chọn landmark
    ══════════════════════════════════════════ -->
    <transition name="sheet">
      <div
        v-if="selectedLocation"
        class="gm-bottom-sheet"
        :class="{
          'gm-sheet-minimized': !sheetExpanded && (isNavigating || pickingStartOnMap),
          'gm-pick-active':     pickingStartOnMap
        }"
        id="gm-mobile-bottom-sheet"
      >
        <!-- Handle kéo lên/xuống — luôn hiển thị và hoạt động dù đang thu gọn -->
        <div
          class="gm-sheet-handle"
          @touchstart="onHandleTouchStart"
          @touchend="onHandleTouchEnd"
        ></div>

        <!-- Nút đóng — ẩn khi đang pick mode (tránh nhầm lẫn) -->
        <button v-if="!pickingStartOnMap" class="gm-sheet-close" @click="closeDetail" aria-label="Đóng">
          <i class="fa-solid fa-xmark"></i>
        </button>

        <!-- Mini bar: PICK MODE — hiện khi đang chọn điểm trên bản đồ -->
        <div v-if="pickingStartOnMap && !sheetExpanded" class="gm-sheet-mini">
          <div class="gm-sheet-mini-dest">
            <i class="fa-solid fa-crosshairs" style="color:#34a853;animation:pulse-icon 1.2s infinite"></i>
            <span style="color:#34a853;font-weight:600">Nhấn vào bản đồ để chọn điểm</span>
          </div>
          <button class="gm-btn-stop gm-btn-stop-mini" @click="cancelPickMode">
            <i class="fa-solid fa-xmark"></i> Huỷ
          </button>
        </div>

        <!-- Mini bar: NAVIGATE MODE — hiện khi đang điều hướng -->
        <div v-if="isNavigating && !pickingStartOnMap && !sheetExpanded" class="gm-sheet-mini">
          <div class="gm-sheet-mini-dest">
            <i class="fa-solid fa-location-dot" style="color:#ea4335"></i>
            <span>{{ selectedLocation.name }}</span>
          </div>
          <button class="gm-btn-stop gm-btn-stop-mini" @click="stopNavigation">
            <i class="fa-solid fa-stop"></i> Dừng
          </button>
        </div>

        <!-- Nội dung đầy đủ khi sheet mở (ẩn khi đang pick mode và sheet thu gọn) -->
        <div v-if="sheetExpanded || (!isNavigating && !pickingStartOnMap)" class="gm-sheet-content">

          <!-- Ảnh thumbnail + tên địa điểm -->
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
            <img
              :src="selectedLocation.image || 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=200&q=80'"
              :alt="selectedLocation.name"
              style="width:64px;height:64px;border-radius:10px;object-fit:cover;flex-shrink:0;"
            />
            <div style="flex:1;min-width:0;">
              <h2 class="gm-detail-title" style="font-size:1rem;margin:0 0 4px;">{{ selectedLocation.name }}</h2>
              <span v-if="selectedLocation.department" class="gm-result-badge">{{ selectedLocation.department }}</span>
            </div>
          </div>

          <!-- Mô tả -->
          <p class="gm-detail-desc" style="margin-bottom:14px;">{{ selectedLocation.description }}</p>

          <!-- Room Selector (mobile sheet) -->
          <div v-if="landmarkRooms.length" class="room-selector-wrap">
            <div class="room-selector-header">
              <i class="fa-solid fa-door-open"></i>
              Chọn phòng <span class="room-count-badge">{{ landmarkRooms.length }}</span>
            </div>
            <div class="room-chips">
              <button
                v-for="r in landmarkRooms"
                :key="r.id"
                class="room-chip"
                :class="{ 'room-chip-active': selectedRoom?.id === r.id }"
                @click="toggleRoomSelect(r)"
              >
                {{ r.room_name }}
              </button>
            </div>
            <transition name="fade">
              <div v-if="selectedRoom" class="room-desc-card">
                <div class="room-desc-name">
                  <i class="fa-solid fa-door-open"></i> {{ selectedRoom.room_name }}
                </div>
                <p class="room-desc-text">{{ selectedRoom.description }}</p>
              </div>
            </transition>
          </div>

          <!-- Nút hành động khi chưa mở direction -->
          <template v-if="!directionMode">
            <div class="gm-detail-actions">
              <button class="gm-action-btn gm-action-btn-primary" id="gm-mobile-directions" @click="openDirectionMode">
                <i class="fa-solid fa-route"></i> Chỉ đường
              </button>
              <button class="gm-action-btn" aria-label="Lưu">
                <i class="fa-regular fa-bookmark"></i>
                <span>Lưu</span>
              </button>
              <button class="gm-action-btn" aria-label="Chia sẻ">
                <i class="fa-solid fa-share-nodes"></i>
                <span>Chia sẻ</span>
              </button>
            </div>
          </template>

          <!-- Direction panel trong bottom sheet -->
          <transition name="fade">
            <div v-if="directionMode" class="gm-dir-panel" id="gm-mobile-dir-panel" style="border:none;padding:0;">

              <!-- Điểm bắt đầu -->
              <div class="gm-dir-row gm-dir-row-start" :class="{ 'gm-dir-row-custom': startMode === 'custom' }">
                <i class="fa-solid fa-circle-dot" style="color:#34a853"></i>
                <span class="gm-dir-start-label">
                  {{ startMode === 'custom' && customStartPos ? customStartPos.label : 'Vị trí GPS của bạn' }}
                </span>
                <button v-if="startMode === 'custom'" class="gm-dir-reset-btn" @click="resetToGps" title="Dùng GPS">
                  <i class="fa-solid fa-rotate-left"></i>
                </button>
              </div>

              <!-- Chọn trên bản đồ -->
              <button class="gm-dir-pick-btn" id="gm-mobile-pick-btn" @click="startPickMode">
                <i class="fa-solid fa-map-pin"></i>
                Chọn điểm bắt đầu trên bản đồ
              </button>

              <!-- Đường chấm nối -->
              <div class="gm-dir-dot-line">
                <span></span><span></span><span></span>
              </div>

              <!-- Điểm đến -->
              <div class="gm-dir-row">
                <i class="fa-solid fa-location-dot" style="color:#ea4335"></i>
                <span>{{ selectedLocation.name }}</span>
              </div>

              <!-- Lỗi -->
              <div v-if="navError" class="gm-dir-error">
                <i class="fa-solid fa-triangle-exclamation"></i> {{ navError }}
              </div>

              <!-- Nút hành động -->
              <div class="gm-dir-actions">
                <button
                  class="gm-btn-find"
                  id="gm-mobile-btn-find"
                  @click="handleFindPath"
                  :disabled="isLoadingPath"
                >
                  <i class="fa-solid" :class="isLoadingPath ? 'fa-spinner fa-spin' : 'fa-location-arrow'"></i>
                  {{ isLoadingPath ? 'Đang tìm...' : 'Tìm đường' }}
                </button>
                <button class="gm-btn-stop" id="gm-mobile-btn-stop" @click="stopNavigation">
                  <i class="fa-solid fa-stop"></i> Dừng
                </button>
              </div>

              <button class="gm-dir-back-btn" @click="directionMode = false">
                <i class="fa-solid fa-arrow-left"></i> Quay lại thông tin
              </button>
            </div>
          </transition>

        </div><!-- /gm-sheet-content -->
      </div>
    </transition><!-- /gm-mobile-bottom-sheet -->


    <!-- ══════════════════════════════════════════
         FAB BUTTONS (right side)
    ══════════════════════════════════════════ -->
    <div class="gm-fab-group" id="gm-fab-group">
      <button class="gm-fab gm-fab-locate" id="gm-fab-locate" @click="locateUser" title="Vị trí của tôi">
        <i class="fa-solid fa-location-crosshairs"></i>
      </button>
      <button
        class="gm-fab"
        id="gm-fab-layers"
        title="Lớp bản đồ"
        :class="{ 'gm-fab-active': showLayerPanel }"
        @click.stop="showLayerPanel = !showLayerPanel"
      >
        <i class="fa-solid fa-layer-group"></i>
      </button>
    </div>

    <!-- Layer picker panel -->
    <transition name="fade">
      <div v-if="showLayerPanel" class="gm-layer-panel" id="gm-layer-panel" @click.stop>
        <div class="gm-layer-panel-title">Chọn lớp bản đồ</div>
        <div class="gm-layer-options">
          <button
            v-for="(cfg, key) in LAYERS"
            :key="key"
            class="gm-layer-option"
            :class="{ 'gm-layer-option-active': currentLayer === key }"
            @click="toggleLayer(key)"
          >
            <div class="gm-layer-thumb" :class="'gm-layer-thumb-' + key">
              <i class="fa-solid" :class="cfg.icon"></i>
            </div>
            <span>{{ cfg.label }}</span>
            <i v-if="currentLayer === key" class="fa-solid fa-check gm-layer-check"></i>
          </button>
        </div>
      </div>
    </transition>

    <!-- ══════════════════════════════════════════
         TOP-RIGHT controls
    ══════════════════════════════════════════ -->
    <!-- Map attribution (desktop) -->
    <div class="gm-attribution">© OpenStreetMap contributors | TVU Digital Map</div>

    <!-- ══════════════════════════════════════════
         MOBILE HEADER
    ══════════════════════════════════════════ -->
    <header class="gm-mobile-header" id="gm-mobile-header">
      <div class="gm-mobile-logo"><i class="fa-solid fa-graduation-cap"></i></div>
      <div class="gm-mobile-search-wrap">
        <div class="gm-mobile-search-box">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Tìm địa điểm trên campus..."
            id="gm-mobile-search"
            autocomplete="off"
          />
          <button v-if="searchQuery" class="gm-mobile-search-clear" @click="clearSearch" aria-label="Xoá">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <!-- Mobile search dropdown -->
        <transition name="fade">
          <div
            v-if="searchQuery && (filteredLocations.length || filteredRooms.length)"
            class="gm-mobile-search-results"
            id="gm-mobile-search-results"
          >
            <!-- Nhóm: Tòa nhà -->
            <template v-if="filteredLocations.length">
              <div class="gm-search-group-label"><i class="fa-solid fa-building"></i> Tòa nhà / Địa điểm</div>
              <div
                v-for="loc in filteredLocations.slice(0, 3)"
                :key="'lm-' + loc.id"
                class="gm-search-result-item"
                @click="selectFromSearch(loc)"
              >
                <i class="fa-solid fa-location-dot gm-sr-icon"></i>
                <div class="gm-sr-text">
                  <span class="gm-sr-name">{{ loc.name }}</span>
                  <span class="gm-sr-cat">{{ loc.category }}</span>
                </div>
              </div>
            </template>
            <!-- Nhóm: Phòng học -->
            <template v-if="filteredRooms.length">
              <div class="gm-search-group-label"><i class="fa-solid fa-door-open"></i> Phòng học</div>
              <div
                v-for="room in filteredRooms.slice(0, 3)"
                :key="'rm-' + room.id"
                class="gm-search-result-item"
                @click="selectFromRoom(room)"
              >
                <i class="fa-solid fa-door-open gm-sr-icon" style="color:#6366f1"></i>
                <div class="gm-sr-text">
                  <span class="gm-sr-name">{{ room.room_name }}</span>
                  <span class="gm-sr-cat">
                    <i class="fa-solid fa-door-open" style="font-size:0.75em;margin-right:3px"></i>
                    {{ room.description ? room.description.slice(0, 55) + (room.description.length > 55 ? '...' : '') : 'Nhấn để xem vị trí' }}
                  </span>
                </div>
              </div>
            </template>
          </div>
          <div
            v-else-if="searchQuery && !filteredLocations.length && !filteredRooms.length"
            class="gm-mobile-search-results"
            id="gm-mobile-search-empty"
          >
            <span class="gm-sr-empty"><i class="fa-solid fa-circle-exclamation"></i> Không tìm thấy “{{ searchQuery }}”</span>
          </div>
        </transition>
      </div>
    </header>



    <!-- ══════════════════════════════════════════
         MOBILE BOTTOM NAVIGATION
    ══════════════════════════════════════════ -->
    <nav class="mobile-bottom-nav" id="gm-mobile-nav">
      <!-- Khám phá: trang hiện tại (Mappage) -->
      <button class="bottom-nav-item bnav-active" id="gm-nav-explore">
        <i class="fa-solid fa-compass"></i>
        <span>Khám phá</span>
      </button>
      <!-- Tin tức: chuyển sang Newspage -->
      <button class="bottom-nav-item" @click="$router.push({ name: 'Newspage' })" id="gm-nav-news">
        <i class="fa-solid fa-newspaper"></i>
        <span>Tin tức</span>
      </button>
      <!-- Danh sách: chuyển sang Landmarkpage -->
      <button class="bottom-nav-item" @click="$router.push({ name: 'Landmarkpage' })" id="gm-nav-landmarks">
        <i class="fa-solid fa-building"></i>
        <span>Danh sách</span>
      </button>
    </nav>

  </div><!-- /mappage-root -->
</template>

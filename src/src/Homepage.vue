<script setup>
import { onMounted, onBeforeUnmount, ref, computed, nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './Homepage.css';
import AStarService  from './algorithms/astar.js';
import OsrmService   from './algorithms/osrm.js';
import PathRenderer  from './algorithms/pathRenderer.js';
import { useSearchWithRooms, fetchLandmarks } from './utils/Search.js';

// Fix Leaflet marker icon với Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Refs cho map containers
const mobileMapContainer = ref(null);
const desktopMapContainer = ref(null);
let map = null;

// ── News / Events từ DB ──
const allNews = ref([]);

const announcements = computed(() =>
  allNews.value
    .filter(n => n.type === 'thong-bao' || n.type === 'tin-tuc')
    .filter(n => n.is_published !== false)
    .slice(0, 4)
);

const upcomingEvents = computed(() =>
  allNews.value
    .filter(n => n.type === 'su-kien')
    .filter(n => n.is_published !== false)
    .slice(0, 5)
);

async function fetchNews() {
  try {
    const res = await fetch('/api/news?limit=20');
    const json = await res.json();
    if (json.success && json.data?.length) {
      allNews.value = json.data;
    }
  } catch (e) {
    console.error('[Homepage] Fetch news error:', e);
  }
}

function formatNewsDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getTypeLabel(type) {
  if (type === 'thong-bao') return 'Thông báo';
  if (type === 'su-kien') return 'Sự kiện';
  return 'Tin tức';
}

function goToNewsPage() {
  window.location.hash = '#news';
  window.location.reload();
}

// Router
const router = useRouter();

/**
 * Mở trang chi tiết tin tức / thông báo / sự kiện
 */
function openNewsDetail(item) {
  router.push({ name: 'NewsDetailpage', params: { id: item.id } });
}

// State – Info panel
const selectedLocation = ref(null);
const mobileMenuOpen = ref(false);
const toggleMenu = () => { mobileMenuOpen.value = !mobileMenuOpen.value; };
const closeMenu = () => { mobileMenuOpen.value = false; };

// State – phòng học của landmark đang chọn
const landmarkRooms = ref([]);   // danh sách phòng của toà nhà đang xem
const selectedRoom  = ref(null); // phòng được chọn trong info card

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

/**
 * Chuyển sang trang Bản đồ (Mappage) và tải lại trang
 * vì main.js đọc window.location.hash một lần duy nhất khi khởi động.
 */
function goToMap() {
  closeMenu();
  window.location.hash = '#map';
  window.location.reload();
}
const activeTab = ref('home');
const setTab = (tab) => { activeTab.value = tab; };
const closeSheet = () => { selectedLocation.value = null; stopNavigation(); };

// State – Direction panel
const directionMode = ref(false);      // Đang ở chế độ chỉ đường?
const isNavigating = ref(false);       // Đang hiển thị đường đi?
const isLoadingPath = ref(false);      // Đang tìm đường?
const navigationError = ref('');       // Thông báo lỗi

/**
 * Kích hoạt panel chỉ đường khi người dùng click "Chỉ đường đến đây"
 */
function openDirectionMode() {
  directionMode.value = true;
  navigationError.value = '';
}

/**
 * Dừng tìm đường – xóa tất cả path layers và reset state
 */
function stopNavigation() {
  if (map) PathRenderer.clearAll(map);
  isNavigating.value  = false;
  directionMode.value = false;
  navigationError.value = '';
}

/**
 * Hàm chính: Hybrid routing
 * - Trong campus  → A* (pgRouting)
 * - Ngoài campus → OSRM đến cổng → A* cổng đến đích
 */
async function handleFindPath() {
  if (!selectedLocation.value) return;
  navigationError.value = '';
  isLoadingPath.value = true;

  try {
    // 1. Lấy vị trí người dùng
    const userPos = await AStarService.getCurrentPosition();

    // 2. Lấy tọa độ điểm đích từ landmark đang chọn
    const destGeom = selectedLocation.value.geom;
    const destCoords = destGeom
      ? (typeof destGeom === 'string' ? JSON.parse(destGeom) : destGeom).coordinates
      : null; // [lng, lat]

    if (!destCoords) throw new Error('Không lấy được tọa độ điểm đến');

    const [destLng, destLat] = destCoords;

    // 3. Tìm node gần điểm đích nhất
    const destNode = await AStarService.findNearestNode(destLng, destLat);

    // 4. Đặt marker đích
    PathRenderer.setEndMarker(map, destLat, destLng, selectedLocation.value.name);

    // 5. Kiểm tra vị trí người dùng có trong campus không
    const inside = AStarService.isInsideCampus(userPos.lat, userPos.lng);

    if (inside) {
      // ── TRONG CAMPUS: A* trực tiếp ──────────────────────────────
      const nearestNode = await AStarService.findNearestNode(userPos.lng, userPos.lat);
      const pathResult  = await AStarService.findPath(nearestNode.id, destNode.id);

      PathRenderer.setStartMarker(map, userPos.lat, userPos.lng, 'Vị trí của bạn');
      PathRenderer.drawInternalPath(
        map,
        pathResult.data,
        [userPos.lat, userPos.lng], // snap điểm đầu về vị trí thực
        [destLat, destLng],         // snap điểm cuối về tọa độ landmark
      );

    } else {
      // ── NGOÀI CAMPUS: OSRM → Cổng phù hợp → A* đến đích ────────────────

      // Chọn cổng vào trường gần điểm đích nhất
      const bestGate = await AStarService.findBestGate(destLng, destLat);

      // OSRM: từ người dùng → cổng được chọn
      const osrmRoute = await OsrmService.getRoute(
        userPos.lng, userPos.lat,
        bestGate.lng, bestGate.lat
      );
      PathRenderer.setStartMarker(map, userPos.lat, userPos.lng, 'Vị trí của bạn');
      PathRenderer.drawExternalPath(map, osrmRoute.coords);

      // A*: từ cổng được chọn → điểm đích
      const pathResult = await AStarService.findPath(bestGate.nodeId, destNode.id);
      PathRenderer.drawInternalPath(
        map,
        pathResult.data,
        [bestGate.lat, bestGate.lng], // snap điểm đầu về tọa độ cổng
        [destLat, destLng],           // snap điểm cuối về tọa độ landmark
      );
      console.info(`[Routing] Vào campus qua: ${bestGate.label} (node ${bestGate.nodeId})`);
    }

    isNavigating.value = true;

  } catch (err) {
    console.error('[handleFindPath]', err);
    navigationError.value = err.message || 'Lỗi không xác định';
  } finally {
    isLoadingPath.value = false;
  }
}

// Dữ liệu địa điểm + Search composable
const campusLocations = ref([]);
const {
  searchQuery,
  activeChip,
  chips,
  filteredLocations,
  filteredRooms,
  clearSearch,
  selectChip,
} = useSearchWithRooms(campusLocations);

// Registry lưu tất cả marker để quản lý opacity
const markerRegistry = []; // { marker: L.Marker, id: number|string }

function addMarkersToMap() {
  campusLocations.value.forEach(loc => {
    let coords = loc.coords;
    if (loc.geom) {
      const geo = typeof loc.geom === 'string' ? JSON.parse(loc.geom) : loc.geom;
      if (geo.type === 'Point') {
        coords = [geo.coordinates[1], geo.coordinates[0]];
      }
    }
    const locWithParsedCoords = { ...loc, coords, image: loc.image_url || loc.image, department: loc.category || loc.department };
    const marker = L.marker(coords).addTo(map);
    markerRegistry.push({ marker, id: loc.id });
    marker.on('click', () => {
      stopNavigation();
      selectedLocation.value = locWithParsedCoords;
    });
  });
}

/**
 * Cập nhật opacity của tất cả marker:
 * - Nếu đang chọn một landmark (selectedLocation): chỉ hiện rõ marker đó, mờ còn lại
 * - Nếu đang tìm kiếm (searchQuery): chỉ hiện rõ marker khaóp, mờ còn lại
 * - Bình thường: tất cả opacity 1
 */
function updateMarkersOpacity() {
  if (!markerRegistry.length) return;

  if (selectedLocation.value) {
    // Chế độ: đang xem thông tin một landmark
    const selId = selectedLocation.value.id;
    markerRegistry.forEach(({ marker, id }) => {
      marker.setOpacity(id === selId ? 1 : 0.1);
    });
  } else if (searchQuery.value.trim()) {
    // Chế độ: đang tìm kiếm
    const matchedIds = new Set(filteredLocations.value.map(l => l.id));
    markerRegistry.forEach(({ marker, id }) => {
      marker.setOpacity(matchedIds.has(id) ? 1 : 0.1);
    });
  } else {
    // Bình thường: hiện tất cả
    markerRegistry.forEach(({ marker }) => marker.setOpacity(1));
  }
}

/**
 * Chọn từ kết quả tìm kiếm:
 * - Đặt selectedLocation
 * - Fly-to tọa độ trên bản đồ (giống Mappage)
 * - Cuộn bản đồ về trung tâm màn hình
 */
function selectFromSearch(loc) {
  const parsed = {
    ...loc,
    image:      loc.image_url || loc.image || '',
    department: loc.category  || loc.department || '',
  };

  // Parse toạ độ
  let lat = null, lng = null;
  if (loc.geom) {
    const geo = typeof loc.geom === 'string' ? JSON.parse(loc.geom) : loc.geom;
    if (geo.type === 'Point') { [lng, lat] = geo.coordinates; }
  } else if (Array.isArray(loc.coords)) {
    [lat, lng] = loc.coords;
  }

  stopNavigation();
  clearSearch();
  selectedLocation.value = parsed;

  // Fly-to và phóng to zoom 19 (giống Mappage)
  if (map && lat !== null && lng !== null) {
    map.flyTo([lat, lng], 19, { duration: 0.8 });
  }
}

/**
 * Chọn phòng từ kết quả tìm kiếm:
 * - Tìm landmark tương ứng qua landmark_id
 * - Fly-to và mở info panel của toà nhà
 * - Tự động highlight phòng đó trong info card
 */
function selectFromRoom(room) {
  clearSearch();
  if (!room.landmark_id) return;
  const landmark = campusLocations.value.find(
    l => l.id === room.landmark_id || String(l.id) === String(room.landmark_id)
  );
  if (landmark) {
    selectFromSearch(landmark);
    // Sau khi landmark được chọn, đặt selectedRoom để highlight
    nextTick(() => { selectedRoom.value = room; });
  }
}

function initMapOn(container) {
  if (!container || map) return;
  map = L.map(container).setView([9.92345, 106.34785], 17);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    minZoom: 5,
    attribution: '© OpenStreetMap contributors | Hệ thống bản đồ số ĐH Trà Vinh'
  }).addTo(map);
  addMarkersToMap();
}

/* fetchLandmarks – từ Search.js */

onMounted(async () => {
  await nextTick();
  await Promise.all([fetchLandmarks(campusLocations), fetchNews()]);
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (isMobile) {
    initMapOn(mobileMapContainer.value);
  } else {
    initMapOn(desktopMapContainer.value);
  }
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
  selectedRoom.value = null;           // reset phòng khi đổi landmark
  if (loc?.id) fetchLandmarkRooms(loc.id);
  else landmarkRooms.value = [];
});
</script>

<template>
  <div class="homepage-wrapper">

    <!-- ===== HEADER ===== -->
    <header class="app-header">
      <div class="header-top">
        <div class="brand">
          <div class="logo-circle">
            <i class="fa-solid fa-graduation-cap"></i>
          </div>
          <div class="brand-text">
            <h1 class="university-name">Đại học Trà Vinh</h1>
            <span class="sub-title">Smart Campus Map</span>
          </div>
        </div>

        <!-- Navbar inline với brand (desktop) -->
        <nav class="nav-bar-inline" :class="{ 'mobile-open': mobileMenuOpen }">
          <ul class="nav-items-inline">
            <li class="active"><a href="#" @click="closeMenu"><i class="fa-solid fa-house"></i> Trang chủ</a></li>
            <li><a href="#map" @click.prevent="goToMap"><i class="fa-solid fa-map-location-dot"></i> Bản đồ khuôn viên</a></li>
            <li><a href="#news" @click="closeMenu"><i class="fa-solid fa-calendar-check"></i> Sự kiện</a></li>
            <li><a href="#" @click.prevent="$router.push({ name: 'Landmarkpage' }); closeMenu()"><i class="fa-solid fa-building"></i> Danh sách Tòa nhà</a></li>
          </ul>
        </nav>

        <div class="header-actions">
          <button class="hamburger-btn" @click="toggleMenu" :class="{ open: mobileMenuOpen }" aria-label="Menu" id="btn-hamburger">
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>

      <!-- Thanh tìm kiếm thay thế navbar cũ -->
      <div class="header-search-bar">
        <div class="header-search-inner">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Tìm kiếm tòa nhà, phòng học, hoặc khoa..."
            class="header-search-input"
            id="header-search-field"
            autocomplete="off"
            @keyup.enter="() => {}"
          />
          <button v-if="searchQuery" class="header-search-clear" @click="clearSearch" aria-label="Xoá">
            <i class="fa-solid fa-xmark"></i>
          </button>
          <button class="header-search-btn" id="btn-header-search" @click="() => {}">
            <i class="fa-solid fa-magnifying-glass"></i> TÌM KIẾM
          </button>
        </div>
        <!-- Kết quả tìm kiếm dropdown -->
        <transition name="fade">
          <div v-if="searchQuery && (filteredLocations.length || filteredRooms.length)" class="header-search-dropdown" id="header-search-results">
            <!-- Nhóm: Tòa nhà / Địa điểm -->
            <template v-if="filteredLocations.length">
              <div class="search-group-label"><i class="fa-solid fa-building"></i> Tòa nhà / Địa điểm</div>
              <div
                v-for="loc in filteredLocations.slice(0, 4)"
                :key="'lm-' + loc.id"
                class="search-result-item"
                @click="selectFromSearch(loc)"
              >
                <i class="fa-solid fa-location-dot search-result-icon"></i>
                <div>
                  <div class="search-result-name">{{ loc.name }}</div>
                  <div class="search-result-cat">{{ loc.category }}</div>
                </div>
              </div>
            </template>
            <!-- Nhóm: Phòng học -->
            <template v-if="filteredRooms.length">
              <div class="search-group-label"><i class="fa-solid fa-door-open"></i> Phòng học</div>
              <div
                v-for="room in filteredRooms.slice(0, 4)"
                :key="'rm-' + room.id"
                class="search-result-item"
                @click="selectFromRoom(room)"
              >
                <i class="fa-solid fa-door-open search-result-icon" style="color:#6366f1"></i>
                <div>
                  <div class="search-result-name">{{ room.room_name }}</div>
                  <div class="search-result-cat">
                    <i class="fa-solid fa-door-open" style="font-size:0.75em;margin-right:4px"></i>
                    {{ room.description ? room.description.slice(0, 55) + (room.description.length > 55 ? '...' : '') : 'Nhấn để xem vị trí' }}
                  </div>
                </div>
              </div>
            </template>
          </div>
          <div v-else-if="searchQuery && !filteredLocations.length && !filteredRooms.length" class="header-search-dropdown" id="header-search-empty">
            <div class="search-result-empty">
              <i class="fa-solid fa-magnifying-glass"></i>
              Không tìm thấy "{{ searchQuery }}"
            </div>
          </div>
        </transition>
      </div>
    </header>

    <!-- ===== MOBILE APP LAYOUT ===== -->
    <div class="mobile-app-screen">

      <!-- Mobile top search bar -->
      <div class="mobile-search-bar">
        <div class="mobile-search-inner">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Tìm tòa nhà, phòng học, khoa..."
            class="mobile-search-input"
            id="mobile-search-field"
            autocomplete="off"
          />
          <button
            v-if="searchQuery"
            class="mobile-filter-btn"
            id="btn-clear-mobile"
            @click="clearSearch"
            aria-label="Xoá"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>


      <!-- Map full width -->
      <div class="mobile-map-container">
        <div ref="mobileMapContainer" class="leaflet-map-container"></div>

        <!-- FAB Locate me -->
        <button class="fab-locate" id="btn-locate" title="Vị trí của tôi">
          <i class="fa-solid fa-location-crosshairs"></i>
        </button>
        <!-- FAB Layers -->
        <button class="fab-layers" id="btn-layers" title="Chọn bản đồ">
          <i class="fa-solid fa-layer-group"></i>
        </button>
      </div>

      <!-- Backdrop: tối nền khi mở sheet -->
      <transition name="fade">
        <div class="sheet-backdrop" v-if="selectedLocation" @click="closeSheet" id="sheet-backdrop"></div>
      </transition>

      <!-- Bottom Info Sheet (slide up khi chọn địa điểm) -->
      <transition name="sheet">
        <div class="bottom-info-sheet" v-if="selectedLocation" id="location-info-sheet">

          <!-- Header cố định: drag handle + nút đóng luôn hiển thị -->
          <div class="sheet-header">
            <div class="sheet-drag-handle" @click="closeSheet"></div>
            <button class="sheet-close-btn" @click="closeSheet" id="btn-close-sheet" aria-label="Đóng">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <!-- Nội dung có thể cuộn -->
          <div class="sheet-scrollable">
            <div class="sheet-img-wrapper">
              <img :src="selectedLocation.image" :alt="selectedLocation.name" class="sheet-img" />
              <span class="sheet-badge">{{ selectedLocation.department }}</span>
            </div>
            <div class="sheet-body">
              <h3 class="sheet-title">{{ selectedLocation.name }}</h3>
              <p class="sheet-desc">{{ selectedLocation.description }}</p>

              <!-- Room Selector (mobile) -->
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
              <div class="sheet-actions">
                <!-- Nút chỉ đường -->
                <template v-if="!directionMode">
                  <button class="sheet-btn-primary" id="btn-directions" @click="openDirectionMode">
                    <i class="fa-solid fa-route"></i> Chỉ đường
                  </button>
                  <button class="sheet-btn-secondary" id="btn-save-loc" aria-label="Lưu">
                    <i class="fa-regular fa-bookmark"></i>
                  </button>
                  <button class="sheet-btn-secondary" id="btn-share-loc" aria-label="Chia sẻ">
                    <i class="fa-solid fa-share-nodes"></i>
                  </button>
                </template>

                <!-- Panel chỉ đường (mobile) -->
                <template v-else>
                  <div class="direction-panel-mobile" id="direction-panel-mobile">
                    <div class="dir-destination">
                      <i class="fa-solid fa-flag-checkered" style="color:#EF4444"></i>
                      <span>{{ selectedLocation.name }}</span>
                    </div>
                    <p v-if="navigationError" class="dir-error">⚠️ {{ navigationError }}</p>
                    <div class="dir-actions">
                      <button class="sheet-btn-primary dir-find-btn" id="btn-mobile-find-path"
                        @click="handleFindPath" :disabled="isLoadingPath">
                        <i class="fa-solid" :class="isLoadingPath ? 'fa-spinner fa-spin' : 'fa-location-arrow'"></i>
                        {{ isLoadingPath ? 'Đang tìm...' : 'Tìm đường' }}
                      </button>
                      <button class="sheet-btn-danger dir-stop-btn" id="btn-mobile-stop-nav"
                        @click="stopNavigation">
                        <i class="fa-solid fa-xmark"></i> Dừng tìm đường
                      </button>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>

        </div>
      </transition>

      <!-- Bottom sheet placeholder hint (khi chưa chọn) -->
      <div class="bottom-hint-bar" v-if="!selectedLocation" id="bottom-hint">
        <i class="fa-solid fa-hand-pointer"></i>
        <span>Chạm vào một địa điểm trên bản đồ để xem thông tin</span>
      </div>
    </div>

    <!-- ===== DESKTOP MAIN CONTENT ===== -->
    <main class="main-content">
      <div class="search-container">
        <div class="search-bar">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Tìm kiếm tòa nhà, phòng học, hoặc khoa..."
            class="search-input"
            id="desktop-search-field"
            autocomplete="off"
            @keyup.enter="() => {}"
          />
          <button class="search-btn" id="btn-desktop-search" @click="() => {}">
            <i class="fa-solid fa-magnifying-glass"></i> TÌM KIẾM
          </button>
        </div>
        <!-- Kết quả tìm kiếm -->
        <transition name="fade">
          <div v-if="searchQuery && (filteredLocations.length || filteredRooms.length)" class="search-results-dropdown" id="desktop-search-results">
            <!-- Nhóm: Tòa nhà -->
            <template v-if="filteredLocations.length">
              <div class="search-group-label"><i class="fa-solid fa-building"></i> Tòa nhà / Địa điểm</div>
              <div
                v-for="loc in filteredLocations.slice(0, 4)"
                :key="'lm-' + loc.id"
                class="search-result-item"
                @click="selectFromSearch(loc)"
              >
                <i class="fa-solid fa-location-dot search-result-icon"></i>
                <div>
                  <div class="search-result-name">{{ loc.name }}</div>
                  <div class="search-result-cat">{{ loc.category }}</div>
                </div>
              </div>
            </template>
            <!-- Nhóm: Phòng học -->
            <template v-if="filteredRooms.length">
              <div class="search-group-label"><i class="fa-solid fa-door-open"></i> Phòng học</div>
              <div
                v-for="room in filteredRooms.slice(0, 4)"
                :key="'rm-' + room.id"
                class="search-result-item"
                @click="selectFromRoom(room)"
              >
                <i class="fa-solid fa-door-open search-result-icon" style="color:#6366f1"></i>
                <div>
                  <div class="search-result-name">{{ room.room_name }}</div>
                  <div class="search-result-cat">
                    <i class="fa-solid fa-door-open" style="font-size:0.75em;margin-right:4px"></i>
                    {{ room.description ? room.description.slice(0, 55) + (room.description.length > 55 ? '...' : '') : 'Nhấn để xem vị trí' }}
                  </div>
                </div>
              </div>
            </template>
          </div>
          <div v-else-if="searchQuery && !filteredLocations.length && !filteredRooms.length" class="search-results-dropdown" id="desktop-search-empty">
            <div class="search-result-empty">
              <i class="fa-solid fa-magnifying-glass"></i>
              Không tìm thấy "{{ searchQuery }}"
            </div>
          </div>
        </transition>
      </div>

      <section class="map-area">
        <div class="left-column map-widget">
          <div class="widget-body p-0 map-body">
            <div ref="desktopMapContainer" class="leaflet-map-container"></div>
          </div>
        </div>
        
        <div class="right-column d-flex flex-column gap-3">
          <div class="info-widget flex-grow">
            <div class="widget-header bg-dark-navy">
              <h3>THÔNG TIN CHI TIẾT</h3>
            </div>
            <div class="widget-body location-panel">
              <div v-if="selectedLocation" class="location-details">
                <div class="loc-image-wrapper">
                  <img :src="selectedLocation.image" :alt="selectedLocation.name" class="loc-detail-img" />
                  <span class="loc-badge">{{ selectedLocation.department }}</span>
                </div>
                <h4 class="loc-title">{{ selectedLocation.name }}</h4>
                <p class="loc-desc">{{ selectedLocation.description }}</p>

                <!-- Room Selector (desktop) -->
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
                <div class="loc-actions">
                  <template v-if="!directionMode">
                    <button class="btn-primary w-100" id="btn-desktop-directions"
                      @click="openDirectionMode">
                      <i class="fa-solid fa-route"></i> Chỉ đường đến đây
                    </button>
                  </template>

                  <!-- Panel chỉ đường (desktop) -->
                  <template v-else>
                    <div class="direction-panel-desktop" id="direction-panel-desktop">
                      <div class="dir-row">
                        <i class="fa-solid fa-person-walking" style="color:#22C55E;font-size:18px"></i>
                        <span class="dir-label">Vị trí GPS của bạn</span>
                      </div>
                      <div class="dir-divider"></div>
                      <div class="dir-row">
                        <i class="fa-solid fa-flag-checkered" style="color:#EF4444;font-size:18px"></i>
                        <span class="dir-label">{{ selectedLocation.name }}</span>
                      </div>
                      <p v-if="navigationError" class="dir-error">⚠️ {{ navigationError }}</p>
                      <button class="btn-primary w-100 mt-2" id="btn-desktop-find-path"
                        @click="handleFindPath" :disabled="isLoadingPath">
                        <i class="fa-solid" :class="isLoadingPath ? 'fa-spinner fa-spin' : 'fa-location-arrow'"></i>
                        {{ isLoadingPath ? 'Đang tìm đường...' : 'Tìm đường' }}
                      </button>
                      <button class="btn-danger w-100 mt-1" id="btn-desktop-stop-nav"
                        v-if="isNavigating" @click="stopNavigation">
                        <i class="fa-solid fa-stop"></i> Dừng tìm đường
                      </button>
                    </div>
                  </template>
                </div>
              </div>
              <div v-else class="placeholder-info">
                <div class="text-center">
                  <i class="fa-solid fa-location-dot fa-2x text-light-gray mb-2"></i>
                  <p class="text-muted m-0">Click vào một địa điểm trên bản đồ để xem chi tiết không gian và chức năng.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="secondary-widgets">
        <!-- ═══ BẢNG TIN THÔNG BÁO (từ DB) ═══ -->
        <div class="widget-box announcement-widget">
          <div class="widget-header bg-royal-blue text-white">
            <h3>BẢNG TIN THÔNG BÁO</h3>
          </div>
          <div class="widget-body p-0">
            <ul class="list-group" v-if="announcements.length">
              <li
                class="list-item list-item-clickable"
                v-for="item in announcements"
                :key="item.id"
                @click="openNewsDetail(item)"
                :id="`news-item-${item.id}`"
                role="button"
                tabindex="0"
                @keyup.enter="openNewsDetail(item)"
              >
                <div class="item-thumb" :style="item.image_url ? { backgroundImage: `url(${item.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}">
                  <i v-if="!item.image_url" class="fa-solid" :class="item.type === 'thong-bao' ? 'fa-bell' : 'fa-newspaper'" style="font-size:1.2rem;color:#fff"></i>
                </div>
                <div class="item-info">
                  <span class="item-type-badge" :class="item.type === 'thong-bao' ? 'badge-announce' : 'badge-news'">{{ getTypeLabel(item.type) }}</span>
                  <h4>{{ item.title }}</h4>
                  <p>{{ item.summary || item.content?.replace(/<[^>]*>/g, '').slice(0, 100) + '...' }}</p>
                  <span class="item-date"><i class="fa-regular fa-clock"></i> {{ formatNewsDate(item.published_at) }}</span>
                </div>
                <i class="fa-solid fa-chevron-right item-arrow"></i>
              </li>
            </ul>
            <div v-else class="widget-empty">
              <i class="fa-solid fa-inbox"></i>
              <p>Chưa có thông báo nào</p>
            </div>
            <div class="widget-view-all" v-if="announcements.length">
              <button class="btn-view-all" @click="goToNewsPage" id="btn-view-all-news">
                Xem tất cả <i class="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- ═══ SỰ KIỆN SẮP DIỄN RA (từ DB) ═══ -->
        <div class="widget-box event-widget">
          <div class="widget-header bg-gold text-dark">
            <h3>SỰ KIỆN SẮP DIỄN RA</h3>
          </div>
          <div class="widget-body">
            <div class="timeline" v-if="upcomingEvents.length">
              <div
                class="timeline-item timeline-item-clickable"
                v-for="ev in upcomingEvents"
                :key="ev.id"
                @click="openNewsDetail(ev)"
                :id="`event-item-${ev.id}`"
                role="button"
                tabindex="0"
                @keyup.enter="openNewsDetail(ev)"
              >
                <div class="time-label">{{ formatNewsDate(ev.published_at) }}</div>
                <div class="timeline-content">
                  <span>{{ ev.title }}</span>
                  <small v-if="ev.landmark_name" class="timeline-loc">
                    <i class="fa-solid fa-location-dot"></i> {{ ev.landmark_name }}
                  </small>
                </div>
                <i class="fa-solid fa-chevron-right timeline-arrow"></i>
              </div>
            </div>
            <div v-else class="widget-empty">
              <i class="fa-solid fa-calendar-xmark"></i>
              <p>Chưa có sự kiện nào</p>
            </div>
            <div class="widget-view-all" v-if="upcomingEvents.length">
              <button class="btn-view-all" @click="goToNewsPage" id="btn-view-all-events">
                Xem tất cả <i class="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- ===== FOOTER (Desktop only) ===== -->
    <footer class="app-footer">
      <div class="footer-content">
        <div class="footer-brand">
          <h3>Đại học Trà Vinh</h3>
          <p>Dự án Bản đồ số thông minh - Mang đến Trải nghiệm học đường tốt nhất</p>
        </div>
      </div>
    </footer>

    <!-- ===== MOBILE BOTTOM NAVIGATION ===== -->
    <nav class="mobile-bottom-nav" id="mobile-bottom-nav">
      <button class="bottom-nav-item" :class="{ 'bnav-active': activeTab === 'home' }" @click="setTab('home')" id="bnav-home">
        <i class="fa-solid fa-house"></i>
        <span>Trang chủ</span>
      </button>
      <button class="bottom-nav-item" :class="{ 'bnav-active': activeTab === 'map' }" @click="setTab('map')" id="bnav-map">
        <i class="fa-solid fa-map-location-dot"></i>
        <span>Bản đồ</span>
      </button>
      <button class="bottom-nav-item bottom-nav-center" :class="{ 'bnav-active': activeTab === 'search' }" @click="setTab('search')" id="bnav-search">
        <div class="bnav-center-circle">
          <i class="fa-solid fa-magnifying-glass"></i>
        </div>
      </button>
      <button class="bottom-nav-item" :class="{ 'bnav-active': activeTab === 'events' }" @click="setTab('events')" id="bnav-events">
        <i class="fa-solid fa-calendar-check"></i>
        <span>Sự kiện</span>
      </button>
      <button class="bottom-nav-item" :class="{ 'bnav-active': activeTab === 'profile' }" @click="setTab('profile')" id="bnav-profile">
        <i class="fa-solid fa-user"></i>
        <span></span>
      </button>
    </nav>

  </div>
</template>
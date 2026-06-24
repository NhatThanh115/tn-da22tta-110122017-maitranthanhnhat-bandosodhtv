<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import './Homepage.css';
import './Landmarkpage.css';

const router = useRouter();

// ── State ─────────────────────────────────────────────────────
const landmarks      = ref([]);
const isLoading      = ref(true);
const searchQuery    = ref('');
const activeCategory = ref('all');
const viewMode       = ref('grid');    // 'grid' | 'list'
const sortBy         = ref('name');    // 'name' | 'category'
const selectedLandmark = ref(null);   // modal detail
const mobileMenuOpen = ref(false);

const toggleMenu = () => { mobileMenuOpen.value = !mobileMenuOpen.value; };
const closeMenu  = () => { mobileMenuOpen.value = false; };

// ── Fetch landmarks ────────────────────────────────────────────
async function fetchLandmarks() {
  isLoading.value = true;
  try {
    const res  = await fetch('/api/landmarks');
    const json = await res.json();
    if (json.data?.length) {
      landmarks.value = json.data.map(l => ({
        ...l,
        image: l.image_url || l.image || '',
        department: l.category || '',
        lat: l.geom ? (() => {
          const g = typeof l.geom === 'string' ? JSON.parse(l.geom) : l.geom;
          return g?.type === 'Point' ? g.coordinates[1] : null;
        })() : null,
        lng: l.geom ? (() => {
          const g = typeof l.geom === 'string' ? JSON.parse(l.geom) : l.geom;
          return g?.type === 'Point' ? g.coordinates[0] : null;
        })() : null,
      }));
    }
  } catch (e) {
    console.error('[Landmarkpage] fetch:', e);
  } finally {
    isLoading.value = false;
  }
}

// ── Categories ─────────────────────────────────────────────────
const CATEGORY_ICONS = {
  'lecture':  'fa-school',
  'library':  'fa-book',
  'canteen':  'fa-utensils',
  'parking':  'fa-square-parking',
  'office':   'fa-building',
  'facility': 'fa-wrench',
  'dormitory':'fa-house-chimney',
  'sport':    'fa-dumbbell',
  'medical':  'fa-kit-medical',
};
function getCatIcon(cat) {
  if (!cat) return 'fa-location-dot';
  const key = cat.toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_ICONS)) {
    if (key.includes(k)) return v;
  }
  return 'fa-location-dot';
}

const categories = computed(() => {
  const map = {};
  landmarks.value.forEach(l => {
    const cat = l.category || 'Khác';
    map[cat] = (map[cat] || 0) + 1;
  });
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
});

// ── Normalize (remove diacritics) ─────────────────────────────
function normalize(str = '') {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// ── Filtered & sorted list ─────────────────────────────────────
const filteredLandmarks = computed(() => {
  let list = landmarks.value;

  // Filter by category
  if (activeCategory.value !== 'all') {
    list = list.filter(l => l.category === activeCategory.value);
  }

  // Filter by search
  const q = normalize(searchQuery.value);
  if (q) {
    list = list.filter(l =>
      normalize(l.name).includes(q) ||
      normalize(l.description).includes(q) ||
      normalize(l.category).includes(q)
    );
  }

  // Sort
  list = [...list];
  if (sortBy.value === 'name') {
    list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
  } else if (sortBy.value === 'category') {
    list.sort((a, b) => (a.category || '').localeCompare(b.category || '', 'vi'));
  }

  return list;
});

// ── Navigate to map ────────────────────────────────────────────
function viewOnMap(landmark) {
  sessionStorage.setItem('nav_highlight', JSON.stringify({
    landmark_id:   landmark.id,
    landmark_name: landmark.name,
    lat:           landmark.lat,
    lng:           landmark.lng,
  }));
  router.push({ name: 'Mappage' });
}

function findRoute(landmark) {
  if (!landmark.lat) return;
  sessionStorage.setItem('nav_destination', JSON.stringify({
    name: landmark.name,
    lat:  landmark.lat,
    lng:  landmark.lng,
  }));
  router.push({ name: 'Homepage' });
}

// ── Helpers ────────────────────────────────────────────────────
function openDetail(landmark) { selectedLandmark.value = landmark; }
function closeDetail()        { selectedLandmark.value = null; }

function goToHome() { router.push({ name: 'Homepage' }); }
function goToMap()  { router.push({ name: 'Mappage' }); }
function goToNews() { router.push({ name: 'Newspage' }); }

function clearSearch() {
  searchQuery.value = '';
  activeCategory.value = 'all';
}

const fallbackImg = 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&q=80';

onMounted(fetchLandmarks);
</script>

<template>
  <div class="lm-wrapper">

    <!-- ===== HEADER (dùng chung với Homepage) ===== -->
    <header class="app-header">
      <div class="header-top">
        <div class="brand">
          <div class="logo-circle">
            <i class="fa-solid fa-graduation-cap"></i>
          </div>
          <div class="brand-text">
            <h1 class="university-name">Đại học Trà Vinh</h1>
            <span class="sub-title">Danh sách Tòa nhà</span>
          </div>
        </div>

        <!-- Navbar inline với brand (desktop) -->
        <nav class="nav-bar-inline">
          <ul class="nav-items-inline">
            <li><a href="#" @click.prevent="goToHome(); closeMenu()"><i class="fa-solid fa-house"></i> Trang chủ</a></li>
            <li><a href="#" @click.prevent="goToMap(); closeMenu()"><i class="fa-solid fa-map-location-dot"></i> Bản đồ khuôn viên</a></li>
            <li><a href="#" @click.prevent="goToNews(); closeMenu()"><i class="fa-solid fa-calendar-check"></i> Sự kiện</a></li>
            <li class="active"><a href="#" @click.prevent="closeMenu()"><i class="fa-solid fa-building"></i> Danh sách Tòa nhà</a></li>
          </ul>
        </nav>

        <div class="header-actions">
          <button class="hamburger-btn" @click="toggleMenu" :class="{ open: mobileMenuOpen }"
            aria-label="Menu" id="btn-hamburger">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>

      <!-- Thanh tìm kiếm tòa nhà thay thế navbar cũ -->
      <div class="header-search-bar">
        <div class="header-search-inner">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input
            v-model="searchQuery"
            type="text"
            class="header-search-input"
            id="lm-header-search-field"
            placeholder="Tìm tòa nhà, phòng học, khoa..."
            autocomplete="off"
          />
          <button v-if="searchQuery" class="header-search-clear" @click="searchQuery = ''" aria-label="Xóa">
            <i class="fa-solid fa-xmark"></i>
          </button>
          <button class="header-search-btn" id="lm-header-search-btn">
            <i class="fa-solid fa-magnifying-glass"></i> TÌM KIẾM
          </button>
        </div>
      </div>
    </header>

    <!-- ===== HERO + SEARCH ===== -->
    <section class="lm-hero">
      <div class="lm-hero-inner">
        <h2><i class="fa-solid fa-building" style="color:#EEC643;margin-right:10px"></i>Danh sách Tòa nhà</h2>
        <p>Khám phá toàn bộ cơ sở vật chất khuôn viên Đại học Trà Vinh</p>
        <div class="lm-search-wrap">
          <div class="lm-search-box">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input
              v-model="searchQuery"
              type="text"
              class="lm-search-input"
              id="lm-search-input"
              placeholder="Tìm tòa nhà, phòng học, khoa..."
              autocomplete="off"
            />
            <button v-if="searchQuery" class="lm-search-clear" @click="searchQuery = ''" aria-label="Xóa">
              <i class="fa-solid fa-xmark"></i>
            </button>
            <button class="lm-search-btn" id="lm-search-btn">
              <i class="fa-solid fa-magnifying-glass"></i> Tìm kiếm
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== STATS BAR ===== -->
    <div class="lm-stats-bar" v-if="!isLoading">
      <span class="lm-stats-text">
        Hiển thị <strong>{{ filteredLandmarks.length }}</strong> /
        <strong>{{ landmarks.length }}</strong> địa điểm
        <template v-if="activeCategory !== 'all'"> – Danh mục: <strong>{{ activeCategory }}</strong></template>
        <template v-if="searchQuery"> – Tìm kiếm: <strong>"{{ searchQuery }}"</strong></template>
      </span>
      <button v-if="searchQuery || activeCategory !== 'all'" class="lm-clear-filter-btn" @click="clearSearch" id="lm-clear-filter">
        <i class="fa-solid fa-xmark"></i> Xóa bộ lọc
      </button>
    </div>

    <!-- ===== MAIN LAYOUT ===== -->
    <div class="lm-main">

      <!-- ── SIDEBAR FILTER ── -->
      <aside class="lm-filter-sidebar">
        <div class="lm-filter-card">
          <div class="lm-filter-header">
            <i class="fa-solid fa-sliders"></i> Danh mục
          </div>
          <ul class="lm-filter-list" id="lm-filter-list">
            <li class="lm-filter-item" :class="{ active: activeCategory === 'all' }"
              @click="activeCategory = 'all'" id="filter-all">
              <i class="fa-solid fa-globe" style="color:#2667FF;width:16px"></i>
              Tất cả
              <span class="lm-filter-count">{{ landmarks.length }}</span>
            </li>
            <li
              v-for="cat in categories"
              :key="cat.name"
              class="lm-filter-item"
              :class="{ active: activeCategory === cat.name }"
              @click="activeCategory = cat.name"
              :id="'filter-' + cat.name.replace(/\s+/g, '-')"
            >
              <i class="fa-solid" :class="getCatIcon(cat.name)" style="color:#2667FF;width:16px"></i>
              {{ cat.name }}
              <span class="lm-filter-count">{{ cat.count }}</span>
            </li>
          </ul>
        </div>
      </aside>

      <!-- ── CONTENT AREA ── -->
      <div class="lm-content">

        <!-- Toolbar -->
        <div class="lm-toolbar" v-if="!isLoading">
          <div class="lm-view-toggle">
            <button class="lm-view-btn" :class="{ active: viewMode === 'grid' }"
              @click="viewMode = 'grid'" id="btn-view-grid">
              <i class="fa-solid fa-grid-2"></i> Lưới
            </button>
            <button class="lm-view-btn" :class="{ active: viewMode === 'list' }"
              @click="viewMode = 'list'" id="btn-view-list">
              <i class="fa-solid fa-list"></i> Danh sách
            </button>
          </div>
          <select class="lm-sort-select" v-model="sortBy" id="lm-sort-select">
            <option value="name">Sắp xếp: Tên A–Z</option>
            <option value="category">Sắp xếp: Danh mục</option>
          </select>
        </div>

        <!-- ── LOADING ── -->
        <div v-if="isLoading" class="lm-loading">
          <div class="lm-spinner"></div>
          <span>Đang tải danh sách tòa nhà...</span>
        </div>

        <!-- ── EMPTY ── -->
        <div v-else-if="filteredLandmarks.length === 0" class="lm-empty">
          <i class="fa-solid fa-magnifying-glass"></i>
          <p>Không tìm thấy địa điểm nào</p>
          <small>Thử thay đổi từ khóa hoặc danh mục tìm kiếm</small>
        </div>

        <!-- ── GRID VIEW ── -->
        <div v-else-if="viewMode === 'grid'" class="lm-grid" id="lm-grid">
          <div
            v-for="loc in filteredLandmarks"
            :key="loc.id"
            class="lm-card"
            @click="openDetail(loc)"
            :id="'lm-card-' + loc.id"
          >
            <div class="lm-card-img-wrap">
              <img
                :src="loc.image || fallbackImg"
                :alt="loc.name"
                class="lm-card-img"
                @error="e => e.target.src = fallbackImg"
              />
              <span class="lm-card-badge">{{ loc.category || 'Địa điểm' }}</span>
              <button class="lm-card-map-btn" @click.stop="viewOnMap(loc)" title="Xem trên bản đồ"
                :id="'btn-map-' + loc.id">
                <i class="fa-solid fa-map-location-dot"></i>
              </button>
            </div>
            <div class="lm-card-body">
              <p class="lm-card-name">{{ loc.name }}</p>
              <p class="lm-card-desc">{{ loc.description || 'Khuôn viên Đại học Trà Vinh' }}</p>
              <div class="lm-card-footer">
                <i class="fa-solid fa-location-dot"></i>
                <span>{{ loc.category || 'Đại học Trà Vinh' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ── LIST VIEW ── -->
        <div v-else class="lm-list" id="lm-list">
          <div
            v-for="loc in filteredLandmarks"
            :key="loc.id"
            class="lm-list-item"
            @click="openDetail(loc)"
            :id="'lm-list-item-' + loc.id"
          >
            <img
              :src="loc.image || fallbackImg"
              :alt="loc.name"
              class="lm-list-img"
              @error="e => e.target.src = fallbackImg"
            />
            <div class="lm-list-body">
              <div>
                <div class="lm-list-top">
                  <p class="lm-list-name">{{ loc.name }}</p>
                  <span class="lm-list-badge">{{ loc.category || 'Địa điểm' }}</span>
                </div>
                <p class="lm-list-desc">{{ loc.description || 'Khuôn viên Đại học Trà Vinh' }}</p>
              </div>
              <div class="lm-list-actions">
                <button class="lm-list-map-btn" @click.stop="viewOnMap(loc)"
                  :id="'btn-list-map-' + loc.id">
                  <i class="fa-solid fa-map-location-dot"></i> Xem bản đồ
                </button>
                <button class="lm-list-map-btn" @click.stop="findRoute(loc)" v-if="loc.lat"
                  :id="'btn-list-route-' + loc.id"
                  style="background:#F5FFF5;color:#16a34a">
                  <i class="fa-solid fa-route"></i> Tìm đường
                </button>
              </div>
            </div>
          </div>
        </div>

      </div><!-- /lm-content -->
    </div><!-- /lm-main -->

    <!-- ===== MODAL DETAIL ===== -->
    <transition name="fade">
      <div v-if="selectedLandmark" class="lm-modal-backdrop" @click.self="closeDetail" id="lm-modal-backdrop">
        <div class="lm-modal" id="lm-modal">
          <img
            :src="selectedLandmark.image || fallbackImg"
            :alt="selectedLandmark.name"
            class="lm-modal-img"
            @error="e => e.target.src = fallbackImg"
          />
          <button class="lm-modal-close" @click="closeDetail" id="lm-modal-close" aria-label="Đóng">
            <i class="fa-solid fa-xmark"></i>
          </button>
          <div class="lm-modal-body">
            <span class="lm-modal-cat">{{ selectedLandmark.category || 'Địa điểm' }}</span>
            <h2 class="lm-modal-name">{{ selectedLandmark.name }}</h2>
            <div class="lm-modal-divider"></div>
            <p class="lm-modal-desc">
              {{ selectedLandmark.description || 'Địa điểm thuộc khuôn viên Đại học Trà Vinh.' }}
            </p>
            <div class="lm-modal-actions">
              <button class="lm-modal-btn lm-modal-btn-primary" @click="viewOnMap(selectedLandmark); closeDetail()"
                id="lm-modal-btn-map">
                <i class="fa-solid fa-map-location-dot"></i> Xem trên bản đồ
              </button>
              <button class="lm-modal-btn lm-modal-btn-secondary" v-if="selectedLandmark.lat"
                @click="findRoute(selectedLandmark); closeDetail()"
                id="lm-modal-btn-route">
                <i class="fa-solid fa-route"></i> Tìm đường
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- ===== FOOTER ===== -->
    <footer class="lm-footer">
      <div class="lm-footer-inner">
        <div>
          <h3>Đại học Trà Vinh</h3>
          <p>Hệ thống Bản đồ số thông minh – TVU Digital Map</p>
        </div>
        <p>© 2026 TVU. Tất cả quyền được bảo lưu.</p>
      </div>
    </footer>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import '@vueup/vue-quill/dist/vue-quill.snow.css';
import './Homepage.css';
import './Newspage.css';


// ── State ─────────────────────────────────────────────────────
const isLoading  = ref(false);
const newsItems  = ref([]);
const page       = ref(1);
const totalPages = ref(1);
const searchQuery = ref('');
const activeTab   = ref('all');   // all | thong-bao | su-kien | tin-tuc
const selectedArticle = ref(null);
const router = useRouter();
const mobileMenuOpen  = ref(false);
const toggleMenu = () => { mobileMenuOpen.value = !mobileMenuOpen.value; };
const closeMenu  = () => { mobileMenuOpen.value = false; };

const TABS = [
  { key: 'all',       label: 'Tất cả',    icon: 'fa-solid fa-layer-group' },
  { key: 'thong-bao', label: 'Thông báo', icon: 'fa-solid fa-bell' },
  { key: 'tin-tuc',   label: 'Tin tức',   icon: 'fa-solid fa-newspaper' },
  { key: 'su-kien',   label: 'Sự kiện',   icon: 'fa-solid fa-calendar-check' },
];

// ── Mock data (dùng khi API chưa trả về hoặc DB trống) ──────
const FALLBACK_NEWS = [
  {
    id: 1, type: 'thong-bao',
    title: 'Cập nhật dữ liệu bản đồ số – Khoa Y Dược',
    content: 'Hệ thống Bản đồ số Đại học Trà Vinh vừa hoàn thiện việc số hóa toàn bộ sơ đồ phòng học, phòng thực hành và các phòng chức năng thuộc Khoa Y Dược. Sinh viên và giảng viên có thể tra cứu phòng cụ thể trực tiếp trên ứng dụng.\n\nMọi thắc mắc vui lòng liên hệ Phòng Công nghệ Thông tin – Tòa A, tầng 3.',
    image_url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80',
    published_at: '2026-05-30T08:00:00Z',
    landmark_name: 'Tòa nhà Khoa Y Dược',
    lat: 9.92300, lng: 106.34800
  },
  {
    id: 2, type: 'su-kien',
    title: 'Ngày hội việc làm – Job Fair TVU 2026',
    content: 'Ngày hội việc làm TVU 2026 quy tụ hơn 50 doanh nghiệp uy tín trong và ngoài tỉnh, với hàng ngàn vị trí tuyển dụng cho sinh viên năm cuối và cựu sinh viên. Các hoạt động bao gồm: phỏng vấn trực tiếp, hội thảo kỹ năng mềm, và triển lãm ngành nghề.',
    image_url: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&q=80',
    published_at: '2026-06-15T07:30:00Z',
    landmark_name: 'Hội trường Lớn – Tòa B',
    lat: 9.92380, lng: 106.34750
  },
  {
    id: 3, type: 'tin-tuc',
    title: 'TVU lọt Top 10 Đại học xanh Việt Nam 2026',
    content: 'Đại học Trà Vinh chính thức được xếp hạng trong Top 10 Đại học Xanh tại Việt Nam năm 2026 theo bảng xếp hạng GreenMetric. Thành tích này ghi nhận nỗ lực phát triển không gian xanh, tiết kiệm năng lượng và quản lý chất thải bền vững.',
    image_url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&q=80',
    published_at: '2026-05-28T10:00:00Z',
    landmark_name: null,
    lat: null, lng: null
  },
  {
    id: 4, type: 'su-kien',
    title: 'Hội thảo Ứng dụng GIS trong Quản lý Đô thị',
    content: 'Hội thảo khoa học quốc gia với chủ đề "Ứng dụng Hệ thống Thông tin Địa lý (GIS) trong quy hoạch và quản lý đô thị thông minh" sẽ diễn ra tại Trường ĐH Trà Vinh. Đây là cơ hội để sinh viên ngành CNTT, Địa lý và Quy hoạch giao lưu với các chuyên gia hàng đầu.',
    image_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    published_at: '2026-05-20T08:00:00Z',
    landmark_name: 'Phòng hội thảo – Tòa C',
    lat: 9.92420, lng: 106.34820
  },
  {
    id: 5, type: 'thong-bao',
    title: 'Bảo trì hệ thống tìm đường 22h–24h ngày 05/06',
    content: 'Phòng CNTT thông báo: Hệ thống tìm đường thông minh trên Bản đồ số TVU sẽ tạm gián đoạn từ 22:00 đến 24:00 ngày 05/06/2026 để nâng cấp cơ sở hạ tầng máy chủ và cập nhật dữ liệu đường đi mới nhất. Trong thời gian này, tính năng xem bản đồ vẫn hoạt động bình thường.',
    image_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80',
    published_at: '2026-05-25T14:00:00Z',
    landmark_name: null,
    lat: null, lng: null
  },
  {
    id: 6, type: 'su-kien',
    title: 'Lễ trao bằng tốt nghiệp đợt 1 năm 2026',
    content: 'Lễ trao bằng tốt nghiệp đợt 1 năm học 2025–2026 sẽ được tổ chức trọng thể tại Nhà thi đấu đa năng Đại học Trà Vinh. Sinh viên tốt nghiệp vui lòng đăng ký tham dự trước ngày 25/05/2026 qua Cổng thông tin sinh viên.',
    image_url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80',
    published_at: '2026-06-01T07:00:00Z',
    landmark_name: 'Nhà thi đấu đa năng',
    lat: 9.92310, lng: 106.34860
  },
];

// ── Computed: Sự kiện sắp diễn ra từ DB (type = su-kien) ────
// Dùng eventsData – fetch riêng với limit cao hơn để timeline luôn đầy đủ
const eventsData = ref([]);

const upcomingEvents = computed(() =>
  eventsData.value
    .filter(n => n.type === 'su-kien')
    .sort((a, b) => new Date(a.published_at) - new Date(b.published_at))
    .slice(0, 5)
);

async function fetchUpcomingEvents() {
  try {
    const res  = await fetch('/api/news?limit=50');
    const json = await res.json();
    if (json.success && json.data?.length) {
      eventsData.value = json.data;
    } else {
      // Fallback: dùng FALLBACK_NEWS lọc su-kien
      eventsData.value = FALLBACK_NEWS.filter(n => n.type === 'su-kien');
    }
  } catch {
    eventsData.value = FALLBACK_NEWS.filter(n => n.type === 'su-kien');
  }
}

// ── Fetch từ API ──────────────────────────────────────────────
async function fetchNews(reset = false) {
  if (reset) { page.value = 1; newsItems.value = []; }
  isLoading.value = true;
  try {
    const params = new URLSearchParams({
      page: page.value, limit: 6,
      ...(searchQuery.value ? { search: searchQuery.value } : {})
    });
    const res = await fetch(`/api/news?${params}`);
    const json = await res.json();
    if (json.success && json.data?.length) {
      newsItems.value = reset ? json.data : [...newsItems.value, ...json.data];
      totalPages.value = json.pagination?.total_pages ?? 1;
    } else {
      // Fallback mock data
      if (reset) newsItems.value = FALLBACK_NEWS;
      totalPages.value = 1;
    }
  } catch {
    if (reset) newsItems.value = FALLBACK_NEWS;
    totalPages.value = 1;
  } finally {
    isLoading.value = false;
  }
}

async function loadMore() {
  page.value++;
  await fetchNews(false);
}

// ── Computed ──────────────────────────────────────────────────
const displayedItems = computed(() => {
  let list = newsItems.value;
  if (activeTab.value !== 'all') {
    list = list.filter(n => n.type === activeTab.value);
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(n =>
      n.title?.toLowerCase().includes(q) ||
      n.content?.toLowerCase().includes(q)
    );
  }
  return list;
});

const featuredItem = computed(() => displayedItems.value[0] || null);
const restItems    = computed(() => displayedItems.value.slice(1));

// ── Helpers ───────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getBadgeClass(type) {
  return type === 'su-kien'   ? 'news-badge-gold'
       : type === 'thong-bao' ? 'news-badge-red'
       : 'news-badge-blue';
}

function getTypeLabel(type) {
  return type === 'su-kien'   ? '🗓 Sự kiện'
       : type === 'thong-bao' ? '🔔 Thông báo'
       : '📰 Tin tức';
}

function openArticle(item) { router.push({ name: 'NewsDetailpage', params: { id: item.id } }); }
function closeArticle()    { selectedArticle.value = null; }

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}

function findEventOnMap(item) {
  closeArticle();
  if (item.lat && item.lng) {
    flyToEvent(item.lat, item.lng, item.title);
    // scroll to map
    mapContainer.value?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * Nhấn "Tìm trên bản đồ" trong timeline:
 * Lưu nav_highlight → chuyển sang Mappage để fly-to landmark
 */
function findTimelineEvent(ev) {
  if (!ev.landmark_id && !ev.lat) return;
  sessionStorage.setItem('nav_highlight', JSON.stringify({
    landmark_id:   ev.landmark_id   || null,
    landmark_name: ev.landmark_name || ev.title,
    lat:           ev.lat           || null,
    lng:           ev.lng           || null,
  }));
  router.push({ name: 'Mappage' });
}

function goToHome() { window.location.hash = '#/'; window.location.reload(); }
function goToMap()  { window.location.hash = '#/map'; window.location.reload(); }

// Search
let searchTimer = null;
function onSearchInput() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => fetchNews(true), 400);
}
function clearSearch() { searchQuery.value = ''; fetchNews(true); }

function setTab(key) { activeTab.value = key; }

// ── Lifecycle ─────────────────────────────────────────────────
onMounted(async () => {
  // Fetch song song: danh sách chính + toàn bộ su-kien cho timeline
  await Promise.all([fetchNews(true), fetchUpcomingEvents()]);
});
</script>

<template>
  <div class="newspage-wrapper">

    <!-- ===== HEADER ===== -->
    <header class="app-header">
      <div class="header-top">
        <div class="brand">
          <div class="logo-circle">
            <i class="fa-solid fa-graduation-cap"></i>
          </div>
          <div class="brand-text">
            <h1 class="university-name">Đại học Trà Vinh</h1>
            <span class="sub-title">Tin tức &amp; Sự kiện</span>
          </div>
        </div>

        <!-- Navbar inline với brand (desktop) -->
        <nav class="nav-bar-inline">
          <ul class="nav-items-inline">
            <li><a href="#" @click.prevent="goToHome"><i class="fa-solid fa-house"></i> Trang chủ</a></li>
            <li><a href="#" @click.prevent="goToMap"><i class="fa-solid fa-map-location-dot"></i> Bản đồ khuôn viên</a></li>
            <li class="active"><a href="#" @click="closeMenu"><i class="fa-solid fa-calendar-check"></i> Sự kiện</a></li>
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

      <!-- Thanh tìm kiếm tin tức thay thế navbar cũ -->
      <div class="header-search-bar">
        <div class="header-search-inner">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Tìm kiếm tin tức, thông báo, sự kiện..."
            class="header-search-input"
            id="news-header-search-field"
            autocomplete="off"
            @input="onSearchInput"
          />
          <button v-if="searchQuery" class="header-search-clear" @click="clearSearch" aria-label="Xoá">
            <i class="fa-solid fa-xmark"></i>
          </button>
          <button class="header-search-btn" id="btn-news-header-search">
            <i class="fa-solid fa-magnifying-glass"></i> TÌM KIẾM
          </button>
        </div>
      </div>
    </header>

    <!-- ===== HERO ===== -->
    <section class="news-hero">
      <div class="news-hero-overlay"></div>
      <div class="news-hero-content">
        <h1><i class="fa-solid fa-newspaper"></i> Tin tức &amp; Sự kiện TVU</h1>
        <p>Cập nhật thông báo, tin tức và các sự kiện diễn ra tại Đại học Trà Vinh</p>
      </div>
    </section>

    <!-- ===== MAIN ===== -->
    <main class="news-main">

      <!-- Controls: Search + Tabs -->
      <div class="news-controls">
        <div class="news-search-wrap">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Tìm kiếm tin tức, thông báo..."
            id="news-search-input"
            autocomplete="off"
            @input="onSearchInput"
          />
          <button v-if="searchQuery" class="news-clear-btn" @click="clearSearch" aria-label="Xoá">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="news-tabs">
          <button
            v-for="tab in TABS" :key="tab.key"
            :id="`tab-${tab.key}`"
            class="news-tab-btn"
            :class="[activeTab === tab.key ? (tab.key === 'su-kien' ? 'active-gold' : 'active') : '']"
            @click="setTab(tab.key)"
          >
            <i :class="tab.icon"></i> {{ tab.label }}
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="isLoading && !newsItems.length" class="news-loading">
        <div class="news-spinner"></div>
        <span>Đang tải...</span>
      </div>

      <!-- Empty -->
      <div v-else-if="!isLoading && !displayedItems.length" class="news-empty">
        <i class="fa-solid fa-inbox"></i>
        <p>Không tìm thấy nội dung phù hợp.</p>
      </div>

      <!-- Grid -->
      <div v-else class="news-grid">

        <!-- LEFT: Articles -->
        <div class="news-articles-col">

          <!-- Featured -->
          <div v-if="featuredItem" class="news-featured" @click="openArticle(featuredItem)" :id="`news-featured-${featuredItem.id}`">
            <img :src="featuredItem.image_url" :alt="featuredItem.title" class="news-featured-img" />
            <div class="news-featured-body">
              <div class="news-featured-meta">
                <span class="news-badge" :class="getBadgeClass(featuredItem.type)">{{ getTypeLabel(featuredItem.type) }}</span>
                <span class="news-date-text"><i class="fa-regular fa-clock"></i> {{ formatDate(featuredItem.published_at) }}</span>
              </div>
              <h2 class="news-featured-title">{{ featuredItem.title }}</h2>
              <p class="news-featured-excerpt">{{ featuredItem.summary || stripHtml(featuredItem.content)?.slice(0, 180) }}...</p>
              <div class="news-featured-footer">
                <button
                  v-if="featuredItem.lat && featuredItem.landmark_name"
                  class="news-loc-chip"
                  @click.stop="findEventOnMap(featuredItem)"
                  :id="`btn-map-featured-${featuredItem.id}`"
                >
                  <i class="fa-solid fa-location-dot"></i> {{ featuredItem.landmark_name }}
                </button>
                <span v-else-if="featuredItem.landmark_name" class="news-loc-chip" style="cursor:default">
                  <i class="fa-solid fa-location-dot"></i> {{ featuredItem.landmark_name }}
                </span>
                <button class="news-read-more">
                  Đọc thêm <i class="fa-solid fa-arrow-right"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- List -->
          <div class="news-list">
            <div
              v-for="item in restItems"
              :key="item.id"
              class="news-card"
              :class="{ 'event-card': item.type === 'su-kien' }"
              @click="openArticle(item)"
              :id="`news-card-${item.id}`"
            >
              <img :src="item.image_url" :alt="item.title" class="news-card-thumb" />
              <div class="news-card-body">
                <div class="news-card-meta">
                  <span class="news-badge" :class="getBadgeClass(item.type)">{{ getTypeLabel(item.type) }}</span>
                  <span class="news-date-text"><i class="fa-regular fa-clock"></i> {{ formatDate(item.published_at) }}</span>
                </div>
                <h3 class="news-card-title">{{ item.title }}</h3>
                <p class="news-card-excerpt">{{ item.summary || stripHtml(item.content)?.slice(0, 100) }}...</p>
                <div class="news-card-footer">
                  <button
                    v-if="item.lat && item.landmark_name"
                    class="news-loc-chip"
                    @click.stop="findEventOnMap(item)"
                    :id="`btn-map-card-${item.id}`"
                  >
                    <i class="fa-solid fa-map-pin"></i> Xem trên bản đồ
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Load More -->
          <div class="news-load-more-wrap" v-if="page < totalPages">
            <button class="news-load-more-btn" :disabled="isLoading" @click="loadMore" id="btn-load-more">
              <i class="fa-solid" :class="isLoading ? 'fa-spinner fa-spin' : 'fa-chevron-down'"></i>
              {{ isLoading ? 'Đang tải...' : 'Xem thêm' }}
            </button>
          </div>
        </div>

        <!-- RIGHT: Map + Events -->
        <div class="news-right-col">
          <!-- Upcoming Events Timeline -->
          <div class="news-upcoming-panel">
            <div class="news-upcoming-header">
              <i class="fa-solid fa-calendar-days"></i>
              <h3>Sự kiện sắp diễn ra</h3>
            </div>
            <div class="news-timeline">
              <!-- Empty state -->
              <div v-if="upcomingEvents.length === 0" style="padding:1.5rem;text-align:center;color:#94a3b8;font-size:0.88rem">
                <i class="fa-solid fa-calendar-xmark" style="font-size:1.5rem;display:block;margin-bottom:8px;color:#cbd5e1"></i>
                Chưa có sự kiện nào
              </div>
              <div
                v-for="ev in upcomingEvents"
                :key="ev.id"
                class="news-tl-item"
                :id="`tl-event-${ev.id}`"
              >
                <!-- Lấy ngày/tháng từ published_at -->
                <div class="news-tl-dot">{{ new Date(ev.published_at).getDate().toString().padStart(2,'0') }}</div>
                <div class="news-tl-body">
                  <div class="news-tl-date">
                    {{ new Date(ev.published_at).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit' }) }}
                  </div>
                  <div class="news-tl-title">{{ ev.title }}</div>
                  <div class="news-tl-loc" v-if="ev.landmark_name">
                    <i class="fa-solid fa-location-dot"></i> {{ ev.landmark_name }}
                  </div>
                  <button
                    class="news-tl-find-btn"
                    @click="findTimelineEvent(ev)"
                    :id="`btn-tl-map-${ev.id}`"
                    v-if="ev.landmark_id || ev.lat"
                  >
                    <i class="fa-solid fa-map-pin"></i> Xem trên bản đồ
                  </button>
                  <button
                    class="news-tl-find-btn"
                    style="background:#F0F9F4;color:#16a34a"
                    @click="openArticle(ev)"
                    :id="`btn-tl-detail-${ev.id}`"
                  >
                    <i class="fa-solid fa-arrow-right"></i> Xem chi tiết
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>

    <!-- ===== FOOTER ===== -->
    <footer class="news-footer">
      <div class="news-footer-inner">
        <div>
          <h3>Đại học Trà Vinh</h3>
          <p>Hệ thống Bản đồ số thông minh – TVU Digital Map</p>
        </div>
        <p>© 2026 TVU. Tất cả quyền được bảo lưu.</p>
      </div>
    </footer>

    <!-- ===== ARTICLE DETAIL MODAL ===== -->
    <transition name="fade">
      <div
        v-if="selectedArticle"
        class="news-modal-backdrop"
        @click.self="closeArticle"
        id="news-modal-backdrop"
      >
        <div class="news-modal" id="news-modal">
          <img
            v-if="selectedArticle.image_url"
            :src="selectedArticle.image_url"
            :alt="selectedArticle.title"
            class="news-modal-img"
          />
          <div class="news-modal-body">
            <div class="news-modal-meta">
              <span class="news-badge" :class="getBadgeClass(selectedArticle.type)">
                {{ getTypeLabel(selectedArticle.type) }}
              </span>
              <span class="news-date-text">
                <i class="fa-regular fa-clock"></i> {{ formatDate(selectedArticle.published_at) }}
              </span>
              <span v-if="selectedArticle.landmark_name" class="news-date-text">
                <i class="fa-solid fa-location-dot" style="color:#2667FF"></i>
                {{ selectedArticle.landmark_name }}
              </span>
            </div>
            <h2 class="news-modal-title">{{ selectedArticle.title }}</h2>
            <div class="news-modal-content ql-editor" v-html="selectedArticle.content" style="padding: 0; max-height: 400px; overflow-y: auto;"></div>
          </div>
          <div class="news-modal-footer">
            <button class="news-modal-close" @click="closeArticle" id="btn-modal-close">
              <i class="fa-solid fa-xmark"></i> Đóng
            </button>
            <button
              v-if="selectedArticle.lat"
              class="news-modal-map-btn"
              @click="findEventOnMap(selectedArticle)"
              id="btn-modal-find-map"
            >
              <i class="fa-solid fa-map-location-dot"></i> Tìm vị trí trên bản đồ
            </button>
          </div>
        </div>
      </div>
    </transition>

  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import '@vueup/vue-quill/dist/vue-quill.snow.css';
import './Homepage.css';
import './Newspage.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const route  = useRoute();
const router = useRouter();

// ── State ─────────────────────────────────────────────────────
const article      = ref(null);
const isLoading    = ref(true);
const notFound     = ref(false);
const mobileMenuOpen = ref(false);
const toggleMenu   = () => { mobileMenuOpen.value = !mobileMenuOpen.value; };
const closeMenu    = () => { mobileMenuOpen.value = false; };

// ── Map ───────────────────────────────────────────────────────
const mapContainer = ref(null);
let map = null;

function initMap(lat, lng, name) {
  if (!mapContainer.value || map) return;
  map = L.map(mapContainer.value).setView([lat, lng], 18);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap'
  }).addTo(map);
  L.marker([lat, lng])
    .addTo(map)
    .bindPopup(`<b>${name}</b>`)
    .openPopup();
}

// ── Fallback mock (đồng bộ với Newspage) ──────────────────────
const FALLBACK = {
  1: { id:1, type:'thong-bao', title:'Cập nhật dữ liệu bản đồ số – Khoa Y Dược',
       content:'Hệ thống Bản đồ số Đại học Trà Vinh vừa hoàn thiện việc số hóa toàn bộ sơ đồ phòng học, phòng thực hành và các phòng chức năng thuộc Khoa Y Dược. Sinh viên và giảng viên có thể tra cứu phòng cụ thể trực tiếp trên ứng dụng.\n\nMọi thắc mắc vui lòng liên hệ Phòng Công nghệ Thông tin – Tòa A, tầng 3.',
       image_url:'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200&q=80',
       published_at:'2026-05-30T08:00:00Z', landmark_name:'Tòa nhà Khoa Y Dược', lat:9.92300, lng:106.34800 },
  2: { id:2, type:'su-kien', title:'Ngày hội việc làm – Job Fair TVU 2026',
       content:'Ngày hội việc làm TVU 2026 quy tụ hơn 50 doanh nghiệp uy tín trong và ngoài tỉnh, với hàng ngàn vị trí tuyển dụng cho sinh viên năm cuối và cựu sinh viên.\n\nCác hoạt động bao gồm: phỏng vấn trực tiếp, hội thảo kỹ năng mềm, và triển lãm ngành nghề.\n\nThời gian: 8:00 – 17:00 ngày 15/06/2026\nĐịa điểm: Hội trường Lớn – Tòa B, Đại học Trà Vinh',
       image_url:'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&q=80',
       published_at:'2026-06-15T07:30:00Z', landmark_name:'Hội trường Lớn – Tòa B', lat:9.92380, lng:106.34750 },
  3: { id:3, type:'tin-tuc', title:'TVU lọt Top 10 Đại học xanh Việt Nam 2026',
       content:'Đại học Trà Vinh chính thức được xếp hạng trong Top 10 Đại học Xanh tại Việt Nam năm 2026 theo bảng xếp hạng GreenMetric.\n\nThành tích này ghi nhận nỗ lực phát triển không gian xanh, tiết kiệm năng lượng và quản lý chất thải bền vững của nhà trường trong nhiều năm qua.',
       image_url:'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&q=80',
       published_at:'2026-05-28T10:00:00Z', landmark_name:null, lat:null, lng:null },
  4: { id:4, type:'su-kien', title:'Hội thảo Ứng dụng GIS trong Quản lý Đô thị',
       content:'Hội thảo khoa học quốc gia với chủ đề "Ứng dụng Hệ thống Thông tin Địa lý (GIS) trong quy hoạch và quản lý đô thị thông minh" sẽ diễn ra tại Trường ĐH Trà Vinh.\n\nĐây là cơ hội để sinh viên ngành CNTT, Địa lý và Quy hoạch giao lưu với các chuyên gia hàng đầu.\n\nThời gian: 8:00 – 12:00 ngày 20/05/2026\nĐịa điểm: Phòng hội thảo – Tòa C',
       image_url:'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80',
       published_at:'2026-05-20T08:00:00Z', landmark_name:'Phòng hội thảo – Tòa C', lat:9.92420, lng:106.34820 },
  5: { id:5, type:'thong-bao', title:'Bảo trì hệ thống tìm đường 22h–24h ngày 05/06',
       content:'Phòng CNTT thông báo: Hệ thống tìm đường thông minh trên Bản đồ số TVU sẽ tạm gián đoạn từ 22:00 đến 24:00 ngày 05/06/2026 để nâng cấp cơ sở hạ tầng máy chủ và cập nhật dữ liệu đường đi mới nhất.\n\nTrong thời gian bảo trì, tính năng xem bản đồ vẫn hoạt động bình thường. Xin lỗi vì sự bất tiện này.',
       image_url:'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80',
       published_at:'2026-05-25T14:00:00Z', landmark_name:null, lat:null, lng:null },
  6: { id:6, type:'su-kien', title:'Lễ trao bằng tốt nghiệp đợt 1 năm 2026',
       content:'Lễ trao bằng tốt nghiệp đợt 1 năm học 2025–2026 sẽ được tổ chức trọng thể tại Nhà thi đấu đa năng Đại học Trà Vinh.\n\nSinh viên tốt nghiệp vui lòng đăng ký tham dự trước ngày 25/05/2026 qua Cổng thông tin sinh viên.\n\nThời gian: 7:30 – 11:30 ngày 01/06/2026\nĐịa điểm: Nhà thi đấu đa năng, Đại học Trà Vinh',
       image_url:'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200&q=80',
       published_at:'2026-06-01T07:00:00Z', landmark_name:'Nhà thi đấu đa năng', lat:9.92310, lng:106.34860 },
};

// ── Fetch ─────────────────────────────────────────────────────
async function fetchArticle() {
  isLoading.value = true;
  const id = parseInt(route.params.id);
  try {
    const res  = await fetch(`/api/news/${id}`);
    const json = await res.json();
    if (json.success && json.data) {
      article.value = json.data;
    } else {
      article.value = FALLBACK[id] || null;
      if (!article.value) notFound.value = true;
    }
  } catch {
    article.value = FALLBACK[id] || null;
    if (!article.value) notFound.value = true;
  } finally {
    isLoading.value = false;
    if (article.value?.lat && article.value?.lng) {
      // Đợi DOM render xong rồi init map
      setTimeout(() => initMap(article.value.lat, article.value.lng, article.value.landmark_name), 100);
    }
  }
}

function isHtml(str) {
  if (!str) return false;
  return /<[a-z][\s\S]*>/i.test(str);
}

// ── Helpers ───────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('vi-VN', { weekday:'long', day:'2-digit', month:'2-digit', year:'numeric' });
}
function getBadgeClass(type) {
  return type === 'su-kien' ? 'news-badge-gold' : type === 'thong-bao' ? 'news-badge-red' : 'news-badge-blue';
}
function getTypeLabel(type) {
  return type === 'su-kien' ? '🗓 Sự kiện' : type === 'thong-bao' ? '🔔 Thông báo' : '📰 Tin tức';
}

function goToHome() { window.location.hash = '#/'; window.location.reload(); }
function goToMap()  { window.location.hash = '#/map'; window.location.reload(); }
function goBack()   { router.push({ name: 'Newspage' }); }

function openMapApp() {
  if (!article.value?.lat) return;
  window.open(`https://www.google.com/maps?q=${article.value.lat},${article.value.lng}`, '_blank');
}

/**
 * Lưu thông tin điểm đích vào sessionStorage rồi chuyển sang
 * Homepage – Homepage sẽ tự đọc và kích hoạt chế độ chỉ đường.
 */
function findRoute() {
  if (!article.value?.lat) return;
  sessionStorage.setItem('nav_destination', JSON.stringify({
    name: article.value.landmark_name || article.value.title,
    lat:  article.value.lat,
    lng:  article.value.lng,
  }));
  window.location.hash = '#/';
  window.location.reload();
}

/**
 * Lưu thông tin địa điểm vào sessionStorage rồi chuyển sang
 * Mappage – Mappage sẽ tự đọc, fly-to và mở sidebar/bottom-sheet.
 */
function goToMapHighlight() {
  // Cần ít nhất landmark_id hoặc lat/lng
  if (!article.value?.landmark_id && !article.value?.lat) return;
  sessionStorage.setItem('nav_highlight', JSON.stringify({
    landmark_id:   article.value.landmark_id   || null,
    landmark_name: article.value.landmark_name || article.value.title,
    lat:           article.value.lat           || null,
    lng:           article.value.lng           || null,
  }));
  window.location.hash = '#/map';
  window.location.reload();
}

onMounted(fetchArticle);
onBeforeUnmount(() => { if (map) { map.remove(); map = null; } });
</script>

<template>
  <div class="newspage-wrapper">

    <!-- ===== HEADER (giống Homepage) ===== -->
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
        <div class="header-actions">
          <button class="hamburger-btn" @click="toggleMenu" :class="{ open: mobileMenuOpen }" aria-label="Menu" id="btn-hamburger">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
      <nav class="nav-bar" :class="{ 'mobile-open': mobileMenuOpen }">
        <ul class="nav-items">
          <li><a href="#" @click.prevent="goToHome"><i class="fa-solid fa-house"></i> Trang chủ</a></li>
          <li><a href="#" @click.prevent="goToMap"><i class="fa-solid fa-map-location-dot"></i> Bản đồ khuôn viên</a></li>
          <li class="active"><a href="#" @click.prevent="goBack"><i class="fa-solid fa-calendar-check"></i> Sự kiện</a></li>
          <li><a href="#" @click.prevent="$router.push({ name: 'Landmarkpage' }); closeMenu()"><i class="fa-solid fa-building"></i> Danh sách Tòa nhà</a></li>
          <li><a href="#" @click="closeMenu"><i class="fa-solid fa-circle-info"></i> Giới thiệu</a></li>
        </ul>
      </nav>
    </header>

    <!-- ===== LOADING ===== -->
    <div v-if="isLoading" class="news-loading" style="flex:1">
      <div class="news-spinner"></div>
      <span>Đang tải bài viết...</span>
    </div>

    <!-- ===== NOT FOUND ===== -->
    <div v-else-if="notFound" class="news-empty" style="flex:1">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <p>Không tìm thấy bài viết này.</p>
      <button class="news-load-more-btn" @click="goBack" style="margin-top:1rem">
        <i class="fa-solid fa-arrow-left"></i> Quay lại danh sách
      </button>
    </div>

    <!-- ===== CONTENT ===== -->
    <main v-else-if="article" class="nd-main">

      <!-- Breadcrumb -->
      <div class="nd-breadcrumb">
        <button class="nd-back-btn" @click="goBack" id="btn-back">
          <i class="fa-solid fa-arrow-left"></i> Tin tức &amp; Sự kiện
        </button>
        <i class="fa-solid fa-chevron-right nd-sep"></i>
        <span class="nd-crumb-title">{{ article.title }}</span>
      </div>

      <div class="nd-layout">

        <!-- LEFT: Article body -->
        <article class="nd-article">

          <!-- Hero image -->
          <div class="nd-hero-img-wrap" v-if="article.image_url">
            <img :src="article.image_url" :alt="article.title" class="nd-hero-img" />
            <span class="nd-hero-badge news-badge" :class="getBadgeClass(article.type)">
              {{ getTypeLabel(article.type) }}
            </span>
          </div>

          <!-- Meta -->
          <div class="nd-meta">
            <span class="news-badge" :class="getBadgeClass(article.type)">{{ getTypeLabel(article.type) }}</span>
            <span class="news-date-text">
              <i class="fa-regular fa-calendar"></i> {{ formatDate(article.published_at) }}
            </span>
            <span v-if="article.landmark_name" class="news-date-text">
              <i class="fa-solid fa-location-dot" style="color:#2667FF"></i> {{ article.landmark_name }}
            </span>
          </div>

          <!-- Title -->
          <h1 class="nd-title">{{ article.title }}</h1>

          <!-- Divider -->
          <div class="nd-divider"></div>

          <!-- Content -->
          <div class="nd-content">
            <div v-if="isHtml(article.content)" class="ql-editor" v-html="article.content" style="padding:0"></div>
            <template v-else>
              <p v-for="(para, i) in article.content?.split('\n\n')" :key="i">{{ para }}</p>
            </template>
          </div>

          <!-- Share actions -->
          <div class="nd-actions">
            <!-- Nút Xem trên bản đồ: hiển thị khi có landmark_id hoặc lat/lng -->
            <button class="nd-action-btn nd-action-view-map" id="btn-view-on-map" @click="goToMapHighlight"
              v-if="article.landmark_id || article.lat">
              <i class="fa-solid fa-map-location-dot"></i> Xem trên bản đồ
            </button>
          </div>
        </article>

        <!-- RIGHT: Sidebar -->
        <aside class="nd-sidebar">

          <!-- Map (chỉ hiển thị nếu có tọa độ) -->
          <div class="nd-map-card" v-if="article.lat">
            <div class="nd-card-header">
              <i class="fa-solid fa-map-location-dot"></i> Vị trí tổ chức
            </div>
            <div class="nd-map-wrap">
              <div ref="mapContainer" class="nd-leaflet" id="nd-event-map"></div>
            </div>
            <div class="nd-map-footer">
              <i class="fa-solid fa-location-dot" style="color:#2667FF"></i>
              <span>{{ article.landmark_name }}</span>
              <button class="nd-map-open-btn" @click="openMapApp" id="btn-open-maps">
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
              </button>
            </div>
          </div>

          <!-- Info card -->
          <div class="nd-info-card">
            <div class="nd-card-header">
              <i class="fa-solid fa-circle-info"></i> Thông tin bài viết
            </div>
            <ul class="nd-info-list">
              <li>
                <span class="nd-info-label"><i class="fa-regular fa-calendar"></i> Ngày đăng</span>
                <span class="nd-info-val">{{ formatDate(article.published_at) }}</span>
              </li>
              <li>
                <span class="nd-info-label"><i class="fa-solid fa-tag"></i> Phân loại</span>
                <span class="news-badge" :class="getBadgeClass(article.type)">{{ getTypeLabel(article.type) }}</span>
              </li>
              <li v-if="article.landmark_name">
                <span class="nd-info-label"><i class="fa-solid fa-location-dot"></i> Địa điểm</span>
                <span class="nd-info-val">{{ article.landmark_name }}</span>
              </li>
            </ul>
          </div>

          <!-- Back button -->
          <button class="news-load-more-btn" style="width:100%" @click="goBack" id="btn-sidebar-back">
            <i class="fa-solid fa-arrow-left"></i> Quay lại danh sách
          </button>

        </aside>
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

  </div>
</template>

<style scoped>
/* ── Layout ── */
.nd-main {
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  padding: 1.5rem 2rem;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* ── Breadcrumb ── */
.nd-breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.nd-back-btn {
  background: none; border: none;
  color: #2667FF; font-weight: 600; font-size: 0.9rem;
  cursor: pointer; display: flex; align-items: center; gap: 6px;
  padding: 0; transition: gap 0.2s;
}
.nd-back-btn:hover { gap: 10px; }
.nd-sep { color: #ccc; font-size: 0.75rem; }
.nd-crumb-title {
  font-size: 0.88rem; color: #666;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  max-width: 400px;
}

/* ── 2-col layout ── */
.nd-layout {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 2rem;
  align-items: start;
}

/* ── Article ── */
.nd-article {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12);
  overflow: hidden;
}
.nd-hero-img-wrap {
  position: relative; width: 100%;
}
.nd-hero-img {
  width: 100%; height: 420px;
  object-fit: cover; display: block;
}
.nd-hero-badge {
  position: absolute; top: 16px; left: 16px;
  font-size: 0.82rem !important;
  padding: 5px 14px !important;
}
.nd-meta {
  display: flex; align-items: center; gap: 10px;
  flex-wrap: wrap;
  padding: 1.25rem 1.75rem 0;
}
.nd-title {
  font-size: clamp(1.4rem, 3vw, 2rem);
  font-weight: 800; color: #111D4A;
  margin: 0.75rem 1.75rem 0;
  line-height: 1.3;
}
.nd-divider {
  height: 3px;
  background: linear-gradient(90deg, #2667FF 0%, #EEC643 100%);
  margin: 1rem 1.75rem;
  border-radius: 2px;
  width: 80px;
}
.nd-content {
  padding: 0 1.75rem 1.5rem;
  font-size: 1rem; color: #444;
  line-height: 1.85;
}
.nd-content p { margin: 0 0 1.1rem 0; }
.nd-content p:last-child { margin-bottom: 0; }

.nd-actions {
  display: flex; gap: 0.75rem; flex-wrap: wrap;
  padding: 1rem 1.75rem 1.5rem;
  border-top: 1px solid #E2E8F0;
}
.nd-action-btn {
  display: inline-flex; align-items: center; gap: 7px;
  background: #2667FF; color: white; border: none;
  padding: 0.6rem 1.4rem; border-radius: 50px;
  font-weight: 600; font-size: 0.9rem;
  cursor: pointer; transition: background 0.2s;
}
.nd-action-btn:hover { background: #1c52d1; }
.nd-action-secondary {
  background: white; color: #111D4A;
  border: 2px solid #E2E8F0;
}
.nd-action-secondary:hover { background: #F7F7FF; border-color: #2667FF; color: #2667FF; }
/* Nút Xem trên bản đồ */
.nd-action-view-map {
  background: linear-gradient(135deg, #0d7fe8 0%, #2667FF 100%);
  color: white;
  box-shadow: 0 4px 14px rgba(38, 103, 255, 0.30);
  position: relative; overflow: hidden;
}
.nd-action-view-map::after {
  content: '';
  position: absolute; inset: 0;
  background: rgba(255,255,255,0.12);
  transform: scaleX(0); transform-origin: left;
  transition: transform 0.3s ease;
}
.nd-action-view-map:hover { background: linear-gradient(135deg, #0a6dd4 0%, #1c52d1 100%); }
.nd-action-view-map:hover::after { transform: scaleX(1); }
/* Nút Tìm đường */
.nd-action-route {
  background: linear-gradient(135deg, #111D4A 0%, #1a2d6b 100%);
  color: #EEC643;
  box-shadow: 0 4px 14px rgba(17, 29, 74, 0.35);
  position: relative; overflow: hidden;
}
.nd-action-route::after {
  content: '';
  position: absolute; inset: 0;
  background: rgba(238, 198, 67, 0.12);
  transform: scaleX(0); transform-origin: left;
  transition: transform 0.3s ease;
}
.nd-action-route:hover { background: linear-gradient(135deg, #1a2d6b 0%, #2a3f8f 100%); }
.nd-action-route:hover::after { transform: scaleX(1); }

/* ── Sidebar ── */
.nd-sidebar {
  display: flex; flex-direction: column; gap: 1rem;
  position: sticky; top: 120px;
}
.nd-card-header {
  background: #111D4A; color: white;
  padding: 0.8rem 1.1rem;
  font-size: 0.88rem; font-weight: 700;
  display: flex; align-items: center; gap: 7px;
  letter-spacing: 0.3px;
}
.nd-card-header i { color: #EEC643; }

/* Map card */
.nd-map-card {
  background: white; border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12);
  border-top: 4px solid #EEC643;
}
.nd-map-wrap { height: 260px; }
.nd-leaflet { width: 100%; height: 100%; }
.nd-map-footer {
  display: flex; align-items: center; gap: 8px;
  padding: 0.7rem 1rem;
  font-size: 0.82rem; color: #444;
  border-top: 1px solid #E2E8F0;
}
.nd-map-footer span { flex: 1; }
.nd-map-open-btn {
  background: #F0F4FF; border: none;
  color: #2667FF; border-radius: 50%;
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 0.8rem;
  transition: background 0.2s;
}
.nd-map-open-btn:hover { background: #2667FF; color: white; }

/* Info card */
.nd-info-card {
  background: white; border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12);
  border-top: 4px solid #2667FF;
}
.nd-info-list {
  list-style: none; margin: 0; padding: 0.75rem 1.1rem;
  display: flex; flex-direction: column; gap: 0.75rem;
}
.nd-info-list li {
  display: flex; align-items: flex-start;
  justify-content: space-between; gap: 0.5rem;
  flex-wrap: wrap;
}
.nd-info-label {
  font-size: 0.82rem; color: #666;
  display: flex; align-items: center; gap: 5px;
  white-space: nowrap;
}
.nd-info-val {
  font-size: 0.85rem; color: #111D4A;
  font-weight: 600; text-align: right;
}

/* ── Responsive ── */
@media (max-width: 900px) {
  .nd-layout { grid-template-columns: 1fr; }
  .nd-sidebar { position: static; }
  .nd-map-wrap { height: 220px; }
}
@media (max-width: 768px) {
  .nd-main { padding: 1rem; }
  .nd-hero-img { height: 220px; }
  .nd-title { font-size: 1.25rem; margin: 0.5rem 1rem 0; }
  .nd-meta { padding: 1rem 1rem 0; }
  .nd-content { padding: 0 1rem 1rem; font-size: 0.95rem; }
  .nd-actions { padding: 0.75rem 1rem 1rem; }
  .nd-crumb-title { max-width: 180px; }
}
</style>

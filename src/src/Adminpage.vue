<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { QuillEditor } from '@vueup/vue-quill';
import '@vueup/vue-quill/dist/vue-quill.snow.css';
import './Adminpage.css';

// ── State ──
const activeMenu = ref('landmarks');
const loading = ref(false);
const showModal = ref(false);
const editingItem = ref(null);
const searchQuery = ref('');
const filterCategory = ref('');
const currentPage = ref(1);
const itemsPerPage = 10;

// ── Data ──
const landmarks = ref([]);
const news = ref([]);
const roadNodes = ref([]);
const roads = ref([]);

// ── News form specific ──
const newsForm = ref({
  title: '',
  summary: '',
  content: '',
  type: 'tin-tuc',
  is_published: true,
  landmark_id: '',
  imageFile: null,
  imagePreview: null,
});

// ── Stats ──
const stats = computed(() => [
  { label: 'Địa điểm', value: landmarks.value.length, icon: 'fa-location-dot', color: 'blue', change: '+3', up: true },
  { label: 'Tin tức', value: news.value.length, icon: 'fa-newspaper', color: 'green', change: '+5', up: true },
  { label: 'Road Nodes', value: roadNodes.value.length, icon: 'fa-circle-nodes', color: 'gold', change: '0', up: true },
  { label: 'Đường đi', value: roads.value.length, icon: 'fa-road', color: 'purple', change: '+2', up: true },
]);

// ── Tabs config ──
const tabs = [
  { key: 'landmarks', label: 'Địa điểm', icon: 'fa-location-dot' },
  { key: 'news', label: 'Tin tức', icon: 'fa-newspaper' },
  { key: 'roadnodes', label: 'Nodes', icon: 'fa-circle-nodes' },
  { key: 'roads', label: 'Đường đi', icon: 'fa-road' },
];

// ── News type options ──
const newsTypes = [
  { value: 'tin-tuc', label: 'Tin tức' },
  { value: 'thong-bao', label: 'Thông báo' },
  { value: 'su-kien', label: 'Sự kiện' },
];

// ── Quill toolbar config ──
const quillToolbar = [
  ['bold', 'italic', 'underline', 'strike'],
  ['blockquote', 'code-block'],
  [{ header: 1 }, { header: 2 }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ indent: '-1' }, { indent: '+1' }],
  [{ color: [] }, { background: [] }],
  ['link', 'image'],
  ['clean'],
];

// ── Current data based on active tab ──
const currentData = computed(() => {
  let data = [];
  if (activeMenu.value === 'landmarks') data = landmarks.value;
  else if (activeMenu.value === 'news') data = news.value;
  else if (activeMenu.value === 'roadnodes') data = roadNodes.value;
  else if (activeMenu.value === 'roads') data = roads.value;

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    data = data.filter(item =>
      (item.name || item.title || '').toLowerCase().includes(q)
    );
  }
  if (filterCategory.value && activeMenu.value === 'landmarks') {
    data = data.filter(item => item.category === filterCategory.value);
  }
  return data;
});

const totalPages = computed(() => Math.ceil(currentData.value.length / itemsPerPage) || 1);
const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return currentData.value.slice(start, start + itemsPerPage);
});
const categories = computed(() => {
  const cats = [...new Set(landmarks.value.map(l => l.category).filter(Boolean))];
  return cats.sort();
});

// ── Form (for non-news tabs) ──
const form = ref({});
const formFields = computed(() => {
  if (activeMenu.value === 'landmarks') return [
    { key: 'name', label: 'Tên địa điểm', type: 'text', required: true },
    { key: 'category', label: 'Danh mục', type: 'text' },
    { key: 'description', label: 'Mô tả', type: 'textarea' },
    { key: 'image_url', label: 'URL hình ảnh', type: 'text' },
    { key: 'lng', label: 'Kinh độ (lng)', type: 'number', half: true },
    { key: 'lat', label: 'Vĩ độ (lat)', type: 'number', half: true },
  ];
  if (activeMenu.value === 'roadnodes') return [
    { key: 'name', label: 'Tên node', type: 'text' },
    { key: 'lng', label: 'Kinh độ (lng)', type: 'number', half: true },
    { key: 'lat', label: 'Vĩ độ (lat)', type: 'number', half: true },
  ];
  return [
    { key: 'name', label: 'Tên đường', type: 'text' },
    { key: 'source', label: 'Node nguồn', type: 'number', half: true },
    { key: 'target', label: 'Node đích', type: 'number', half: true },
    { key: 'reverse_cost', label: 'Chi phí ngược', type: 'number' },
  ];
});

// ── API helpers ──
const apiBase = {
  landmarks: '/api/landmarks',
  news: '/api/news',
  roadnodes: '/api/paths/nodes',
  roads: '/api/paths',
};

async function fetchData(type) {
  try {
    const res = await fetch(apiBase[type]);
    if (res.ok) {
      const result = await res.json();
      return result.data || [];
    }
  } catch (e) { console.error(`Fetch ${type} error:`, e); }
  return [];
}

async function loadAll() {
  loading.value = true;
  const [l, n, rn, r] = await Promise.all([
    fetchData('landmarks'), fetchData('news'),
    fetchData('roadnodes'), fetchData('roads'),
  ]);
  landmarks.value = l; news.value = n;
  roadNodes.value = rn; roads.value = r;
  loading.value = false;
}

function resetNewsForm() {
  newsForm.value = {
    title: '',
    summary: '',
    content: '',
    type: 'tin-tuc',
    is_published: true,
    landmark_id: '',
    imageFile: null,
    imagePreview: null,
  };
}

function openCreate() {
  editingItem.value = null;
  if (activeMenu.value === 'news') {
    resetNewsForm();
  } else {
    form.value = {};
  }
  showModal.value = true;
}

function openEdit(item) {
  editingItem.value = item;
  if (activeMenu.value === 'news') {
    newsForm.value = {
      title: item.title || '',
      summary: item.summary || '',
      content: item.content || '',
      type: item.type || 'tin-tuc',
      is_published: item.is_published !== false,
      landmark_id: item.landmark_id || '',
      imageFile: null,
      imagePreview: item.image_url || null,
    };
  } else {
    form.value = { ...item };
    if (item.geom && item.geom.coordinates) {
      form.value.lng = item.geom.coordinates[0];
      form.value.lat = item.geom.coordinates[1];
    }
  }
  showModal.value = true;
}

function onImageChange(e) {
  const file = e.target.files[0];
  if (file) {
    newsForm.value.imageFile = file;
    newsForm.value.imagePreview = URL.createObjectURL(file);
  }
}

function removeImage() {
  newsForm.value.imageFile = null;
  newsForm.value.imagePreview = null;
}

async function saveForm() {
  const isEdit = !!editingItem.value;

  // ── News tab: sử dụng FormData (multipart) ──
  if (activeMenu.value === 'news') {
    const nf = newsForm.value;
    if (!nf.title.trim()) {
      alert('Vui lòng nhập tiêu đề tin tức');
      return;
    }

    const fd = new FormData();
    fd.append('title', nf.title);
    fd.append('summary', nf.summary);
    fd.append('content', nf.content);
    fd.append('type', nf.type);
    fd.append('is_published', String(nf.is_published));
    if (nf.landmark_id) fd.append('landmark_id', nf.landmark_id);
    if (nf.imageFile) fd.append('image', nf.imageFile);

    const url = isEdit ? `/api/news/${editingItem.value.id}` : '/api/news';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, { method, body: fd });
      if (res.ok) {
        showModal.value = false;
        await loadAll();
      } else {
        const err = await res.json();
        alert(err.message || 'Lỗi khi lưu');
      }
    } catch (e) { alert('Lỗi kết nối server'); }
    return;
  }

  // ── Các tab khác: sử dụng JSON ──
  const base = apiBase[activeMenu.value];
  const url = isEdit ? `${base}/${editingItem.value.id}` : base;
  const method = isEdit ? 'PUT' : 'POST';
  try {
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value),
    });
    if (res.ok) {
      showModal.value = false;
      await loadAll();
    } else {
      const err = await res.json();
      alert(err.message || 'Lỗi khi lưu');
    }
  } catch (e) { alert('Lỗi kết nối server'); }
}

async function deleteItem(item) {
  if (!confirm(`Xóa "${item.name || item.title}" ?`)) return;
  const base = apiBase[activeMenu.value];
  try {
    await fetch(`${base}/${item.id}`, { method: 'DELETE' });
    await loadAll();
  } catch (e) { alert('Lỗi khi xóa'); }
}

function switchTab(key) {
  activeMenu.value = key;
  currentPage.value = 1;
  searchQuery.value = '';
  filterCategory.value = '';
}

function getCoords(item) {
  if (item.geom && item.geom.coordinates) {
    return `${item.geom.coordinates[0].toFixed(5)}, ${item.geom.coordinates[1].toFixed(5)}`;
  }
  if (item.x != null && item.y != null) return `${item.x.toFixed(5)}, ${item.y.toFixed(5)}`;
  return '—';
}

function getCatClass(cat) {
  if (!cat) return '';
  const map = { 'Khoa': 'blue', 'Phòng học': 'green', 'Căng-tin': 'gold', 'ATM': 'purple' };
  return map[cat] || ['green','gold','purple','red'][cat.charCodeAt(0) % 4];
}

function getTypeLabel(type) {
  const t = newsTypes.find(n => n.value === type);
  return t ? t.label : type || '—';
}

function getTypeClass(type) {
  if (type === 'thong-bao') return 'gold';
  if (type === 'su-kien') return 'purple';
  return 'blue';
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

onMounted(loadAll);
</script>

<template>
  <div class="admin-wrapper">

    <!-- ═══ SIDEBAR ═══ -->
    <aside class="admin-sidebar">
      <div class="sidebar-brand">
        <div class="sidebar-logo"><i class="fa-solid fa-map-location-dot"></i></div>
        <div class="sidebar-brand-text">
          <h2>TVU Digital Map</h2>
          <span>Admin Panel</span>
        </div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-label">Tổng quan</div>
        <ul class="sidebar-nav">
          <li :class="{ active: activeMenu === 'dashboard' }">
            <button @click="activeMenu = 'dashboard'" id="nav-dashboard">
              <i class="fa-solid fa-gauge-high"></i> Dashboard
            </button>
          </li>
        </ul>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-label">Quản lý dữ liệu</div>
        <ul class="sidebar-nav">
          <li :class="{ active: activeMenu === 'landmarks' }">
            <button @click="switchTab('landmarks')" id="nav-landmarks">
              <i class="fa-solid fa-location-dot"></i> Địa điểm
              <span class="nav-badge">{{ landmarks.length }}</span>
            </button>
          </li>
          <li :class="{ active: activeMenu === 'news' }">
            <button @click="switchTab('news')" id="nav-news">
              <i class="fa-solid fa-newspaper"></i> Tin tức
            </button>
          </li>
          <li :class="{ active: activeMenu === 'roadnodes' }">
            <button @click="switchTab('roadnodes')" id="nav-roadnodes">
              <i class="fa-solid fa-circle-nodes"></i> Road Nodes
            </button>
          </li>
          <li :class="{ active: activeMenu === 'roads' }">
            <button @click="switchTab('roads')" id="nav-roads">
              <i class="fa-solid fa-road"></i> Đường đi
            </button>
          </li>
        </ul>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-label"></div>
        <ul class="sidebar-nav">
          <li><a href="/" id="nav-home"><i class="fa-solid fa-arrow-left"></i> Về trang chủ</a></li>
        </ul>
      </div>
    </aside>

    <!-- ═══ MAIN AREA ═══ -->
    <div class="admin-main">

      <!-- Header -->
      <header class="admin-header">
        <div class="header-left">
          <div>
            <h1>{{ activeMenu === 'dashboard' ? 'Dashboard' : tabs.find(t => t.key === activeMenu)?.label || 'Quản lý' }}</h1>
            <div class="header-breadcrumb">
              <span>Admin</span>
              <i class="fa-solid fa-chevron-right"></i>
              <span class="current">{{ activeMenu === 'dashboard' ? 'Tổng quan' : tabs.find(t => t.key === activeMenu)?.label || '' }}</span>
            </div>
          </div>
        </div>
      </header>

      <!-- Content -->
      <div class="admin-content">

        <!-- Stats -->
        <div class="stats-grid">
          <div class="stat-card" v-for="s in stats" :key="s.label"
               :style="{ '--card-accent': s.color === 'blue' ? '#3b82f6' : s.color === 'green' ? '#22c55e' : s.color === 'gold' ? '#eec643' : '#a855f7' }">
            <div class="stat-info">
              <h3>{{ s.label }}</h3>
              <div class="stat-value">{{ s.value }}</div>
              <div class="stat-change up"><i class="fa-solid fa-arrow-up"></i> {{ s.change }}</div>
            </div>
            <div class="stat-icon" :class="s.color">
              <i class="fa-solid" :class="s.icon"></i>
            </div>
          </div>
        </div>

        <!-- Data Panel -->
        <div class="content-grid" v-if="activeMenu !== 'dashboard'">
          <div class="data-panel">
            <!-- Panel header with tabs -->
            <div class="panel-header">
              <h2><i class="fa-solid" :class="tabs.find(t => t.key === activeMenu)?.icon"></i> Quản lý {{ tabs.find(t => t.key === activeMenu)?.label }}</h2>
              <div class="panel-actions">
                <button class="btn-admin primary" @click="openCreate" id="btn-create">
                  <i class="fa-solid fa-plus"></i> Thêm mới
                </button>
              </div>
            </div>

            <!-- Filter bar -->
            <div class="panel-filter-bar">
              <div class="filter-input">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input v-model="searchQuery" type="text" placeholder="Tìm kiếm..." id="filter-search" />
              </div>
              <select v-if="activeMenu === 'landmarks'" class="filter-select" v-model="filterCategory" id="filter-category">
                <option value="">Tất cả danh mục</option>
                <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
              </select>
              <button class="btn-admin outline" @click="loadAll" id="btn-refresh">
                <i class="fa-solid fa-rotate"></i> Refresh
              </button>
            </div>

            <!-- Table: Landmarks -->
            <div class="admin-table-wrap" v-if="activeMenu === 'landmarks'">
              <table class="admin-table">
                <thead><tr>
                  <th>ID</th><th>Tên</th><th>Danh mục</th><th>Tọa độ</th><th>Ngày tạo</th><th></th>
                </tr></thead>
                <tbody>
                  <tr v-for="item in paginatedData" :key="item.id">
                    <td class="cell-id">#{{ item.id }}</td>
                    <td class="cell-name">{{ item.name }}</td>
                    <td><span class="cell-category" :class="getCatClass(item.category)">{{ item.category || '—' }}</span></td>
                    <td class="cell-coords">{{ getCoords(item) }}</td>
                    <td class="muted">{{ formatDate(item.created_at) }}</td>
                    <td class="cell-actions">
                      <button class="action-btn" title="Sửa" @click="openEdit(item)"><i class="fa-solid fa-pen"></i></button>
                      <button class="action-btn delete" title="Xóa" @click="deleteItem(item)"><i class="fa-solid fa-trash"></i></button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Table: News -->
            <div class="admin-table-wrap" v-if="activeMenu === 'news'">
              <table class="admin-table">
                <thead><tr>
                  <th>ID</th><th>Ảnh</th><th>Tiêu đề</th><th>Loại</th><th>Trạng thái</th><th>Landmark</th><th>Ngày đăng</th><th></th>
                </tr></thead>
                <tbody>
                  <tr v-for="item in paginatedData" :key="item.id">
                    <td class="cell-id">#{{ item.id }}</td>
                    <td>
                      <img v-if="item.image_url" :src="item.image_url" class="cell-thumb" :alt="item.title" />
                      <div v-else class="cell-thumb-empty"><i class="fa-solid fa-image"></i></div>
                    </td>
                    <td class="cell-name">{{ item.title }}</td>
                    <td><span class="cell-category" :class="getTypeClass(item.type)">{{ getTypeLabel(item.type) }}</span></td>
                    <td>
                      <span class="cell-status" :class="item.is_published !== false ? 'published' : 'draft'">
                        <i class="fa-solid" :class="item.is_published !== false ? 'fa-circle-check' : 'fa-circle-pause'"></i>
                        {{ item.is_published !== false ? 'Đã xuất bản' : 'Bản nháp' }}
                      </span>
                    </td>
                    <td class="muted">{{ item.landmark_name || '—' }}</td>
                    <td class="muted">{{ formatDate(item.published_at) }}</td>
                    <td class="cell-actions">
                      <button class="action-btn" title="Sửa" @click="openEdit(item)"><i class="fa-solid fa-pen"></i></button>
                      <button class="action-btn delete" title="Xóa" @click="deleteItem(item)"><i class="fa-solid fa-trash"></i></button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Table: Road Nodes -->
            <div class="admin-table-wrap" v-if="activeMenu === 'roadnodes'">
              <table class="admin-table">
                <thead><tr>
                  <th>ID</th><th>Tên</th><th>Tọa độ</th><th></th>
                </tr></thead>
                <tbody>
                  <tr v-for="item in paginatedData" :key="item.id">
                    <td class="cell-id">#{{ item.id }}</td>
                    <td class="cell-name">{{ item.name || '—' }}</td>
                    <td class="cell-coords">{{ getCoords(item) }}</td>
                    <td class="cell-actions">
                      <button class="action-btn" title="Sửa" @click="openEdit(item)"><i class="fa-solid fa-pen"></i></button>
                      <button class="action-btn delete" title="Xóa" @click="deleteItem(item)"><i class="fa-solid fa-trash"></i></button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Table: Roads -->
            <div class="admin-table-wrap" v-if="activeMenu === 'roads'">
              <table class="admin-table">
                <thead><tr>
                  <th>ID</th><th>Tên</th><th>Source</th><th>Target</th><th>Cost (m)</th><th></th>
                </tr></thead>
                <tbody>
                  <tr v-for="item in paginatedData" :key="item.id">
                    <td class="cell-id">#{{ item.id }}</td>
                    <td class="cell-name">{{ item.name || '—' }}</td>
                    <td class="muted">{{ item.source_name || item.source }}</td>
                    <td class="muted">{{ item.target_name || item.target }}</td>
                    <td class="muted">{{ item.cost ? Math.round(item.cost) : '—' }}</td>
                    <td class="cell-actions">
                      <button class="action-btn" title="Sửa" @click="openEdit(item)"><i class="fa-solid fa-pen"></i></button>
                      <button class="action-btn delete" title="Xóa" @click="deleteItem(item)"><i class="fa-solid fa-trash"></i></button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Empty state -->
            <div class="empty-state" v-if="!loading && paginatedData.length === 0">
              <i class="fa-solid fa-inbox"></i>
              <p>Không có dữ liệu</p>
            </div>

            <!-- Loading skeleton -->
            <div v-if="loading">
              <div class="skeleton-row" v-for="i in 5" :key="i">
                <div class="skeleton-bar" :style="{ width: '40px' }"></div>
                <div class="skeleton-bar" :style="{ width: '200px' }"></div>
                <div class="skeleton-bar" :style="{ width: '100px' }"></div>
                <div class="skeleton-bar" :style="{ width: '140px' }"></div>
              </div>
            </div>

            <!-- Pagination -->
            <div class="table-footer" v-if="currentData.length > 0">
              <span>Hiển thị {{ paginatedData.length }} / {{ currentData.length }} mục</span>
              <div class="pagination">
                <button class="page-btn" :disabled="currentPage <= 1" @click="currentPage--" id="page-prev">
                  <i class="fa-solid fa-chevron-left"></i>
                </button>
                <button v-for="p in totalPages" :key="p" class="page-btn" :class="{ active: p === currentPage }" @click="currentPage = p">
                  {{ p }}
                </button>
                <button class="page-btn" :disabled="currentPage >= totalPages" @click="currentPage++" id="page-next">
                  <i class="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Dashboard welcome -->
        <div class="empty-state" v-if="activeMenu === 'dashboard'" style="padding-top:40px">
          <i class="fa-solid fa-chart-line" style="color:var(--admin-accent)"></i>
          <p>Chọn một mục trong menu bên trái để quản lý dữ liệu</p>
        </div>
      </div>
    </div>

    <!-- ═══ MODAL ═══ -->
    <teleport to="body">
      <div class="modal-backdrop" v-if="showModal" @click.self="showModal = false">
        <div class="modal-box" :class="{ 'modal-wide': activeMenu === 'news' }">
          <div class="modal-header">
            <h3>{{ editingItem ? 'Chỉnh sửa' : 'Thêm mới' }} {{ tabs.find(t => t.key === activeMenu)?.label }}</h3>
            <button class="modal-close" @click="showModal = false" id="modal-close"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="modal-body">

            <!-- ═══ NEWS FORM ═══ -->
            <template v-if="activeMenu === 'news'">
              <!-- Tiêu đề -->
              <div class="form-group">
                <label>Tiêu đề <span style="color:var(--admin-danger)">*</span></label>
                <input class="form-control" type="text" v-model="newsForm.title" placeholder="Nhập tiêu đề tin tức..." id="news-title" />
              </div>

              <!-- Loại tin + Trạng thái -->
              <div class="form-row">
                <div class="form-group">
                  <label>Loại tin</label>
                  <select class="form-control" v-model="newsForm.type" id="news-type">
                    <option v-for="t in newsTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Trạng thái xuất bản</label>
                  <div class="radio-group">
                    <label class="radio-label" :class="{ active: newsForm.is_published === true }">
                      <input type="radio" :value="true" v-model="newsForm.is_published" name="is_published" />
                      <i class="fa-solid fa-circle-check"></i> Xuất bản
                    </label>
                    <label class="radio-label draft" :class="{ active: newsForm.is_published === false }">
                      <input type="radio" :value="false" v-model="newsForm.is_published" name="is_published" />
                      <i class="fa-solid fa-circle-pause"></i> Bản nháp
                    </label>
                  </div>
                </div>
              </div>

              <!-- Tóm tắt -->
              <div class="form-group">
                <label>Tóm tắt</label>
                <textarea class="form-control" v-model="newsForm.summary" placeholder="Tóm tắt ngắn gọn nội dung..." rows="2" id="news-summary"></textarea>
              </div>

              <!-- Ảnh đại diện -->
              <div class="form-group">
                <label>Ảnh đại diện</label>
                <div class="image-upload-area">
                  <div v-if="newsForm.imagePreview" class="image-preview-wrap">
                    <img :src="newsForm.imagePreview" class="image-preview" alt="Preview" />
                    <button class="image-remove-btn" @click="removeImage" title="Xóa ảnh">
                      <i class="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                  <label v-else class="image-upload-placeholder" for="news-image-input">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                    <span>Click để chọn ảnh</span>
                    <small>PNG, JPG, WEBP — tối đa 5MB</small>
                  </label>
                  <input type="file" accept="image/*" @change="onImageChange" id="news-image-input" class="hidden-file-input" />
                </div>
              </div>

              <!-- Địa điểm liên kết -->
              <div class="form-group">
                <label>Địa điểm liên kết</label>
                <select class="form-control" v-model="newsForm.landmark_id" id="news-landmark">
                  <option value="">— Không liên kết —</option>
                  <option v-for="lm in landmarks" :key="lm.id" :value="lm.id">{{ lm.name }}</option>
                </select>
              </div>

              <!-- Nội dung chi tiết (Quill) -->
              <div class="form-group">
                <label>Nội dung chi tiết</label>
                <div class="quill-wrapper">
                  <QuillEditor
                    theme="snow"
                    v-model:content="newsForm.content"
                    contentType="html"
                    :toolbar="quillToolbar"
                    placeholder="Viết nội dung tin tức chi tiết..."
                    id="news-content-editor"
                  />
                </div>
              </div>
            </template>

            <!-- ═══ GENERIC FORM (landmarks, roadnodes, roads) ═══ -->
            <template v-else>
              <template v-for="(field, idx) in formFields" :key="field.key">
                <!-- Start a form-row when field.half is true and next field is also half -->
                <div v-if="field.half && formFields[idx + 1]?.half" class="form-row">
                  <div class="form-group">
                    <label>{{ field.label }} <span v-if="field.required" style="color:var(--admin-danger)">*</span></label>
                    <input class="form-control" :type="field.type" v-model="form[field.key]" :placeholder="field.label" />
                  </div>
                  <div class="form-group">
                    <label>{{ formFields[idx + 1].label }}</label>
                    <input class="form-control" :type="formFields[idx + 1].type" v-model="form[formFields[idx + 1].key]" :placeholder="formFields[idx + 1].label" />
                  </div>
                </div>
                <!-- Skip the second half field (already rendered above) -->
                <template v-else-if="field.half && formFields[idx - 1]?.half"></template>
                <!-- Normal single field -->
                <div v-else class="form-group">
                  <label>{{ field.label }} <span v-if="field.required" style="color:var(--admin-danger)">*</span></label>
                  <textarea v-if="field.type === 'textarea'" class="form-control" v-model="form[field.key]" :placeholder="field.label"></textarea>
                  <input v-else class="form-control" :type="field.type" v-model="form[field.key]" :placeholder="field.label" />
                </div>
              </template>
            </template>

          </div>
          <div class="modal-footer">
            <button class="btn-admin outline" @click="showModal = false">Hủy</button>
            <button class="btn-admin primary" @click="saveForm" id="btn-save">
              <i class="fa-solid fa-check"></i> {{ editingItem ? 'Cập nhật' : 'Tạo mới' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

  </div>
</template>

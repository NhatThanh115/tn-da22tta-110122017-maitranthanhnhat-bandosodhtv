/**
 * Search.js – Composable tìm kiếm landmark
 * Dùng chung cho Mappage.vue và Homepage.vue
 *
 * Cách dùng:
 *   import { useSearch } from './utils/Search.js';
 *   const { searchQuery, activeChip, chips, filteredLocations, clearSearch } = useSearch(campusLocations);
 */

import { ref, computed, watch } from 'vue';

/* ─────────────────────────────────────────────────
   Danh sách chip / category
───────────────────────────────────────────────── */
export const CHIPS = [
  { id: 'all',      label: 'Tất cả',      icon: 'fa-solid fa-globe' },
  { id: 'lecture',  label: 'Giảng đường', icon: 'fa-solid fa-school' },
  { id: 'library',  label: 'Thư viện',    icon: 'fa-solid fa-book' },
  { id: 'canteen',  label: 'Căng-tin',    icon: 'fa-solid fa-utensils' },
  { id: 'parking',  label: 'Bãi xe',      icon: 'fa-solid fa-square-parking' },
  { id: 'office',   label: 'Hành chính',  icon: 'fa-solid fa-building' },
];

/* ─────────────────────────────────────────────────
   Debounce helper (tránh gọi filter liên tục)
───────────────────────────────────────────────── */
function debounce(fn, delay = 200) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ─────────────────────────────────────────────────
   Normalize chuỗi: bỏ dấu + lowercase
   Cho phép tìm "giang duong" ra "Giảng đường"
───────────────────────────────────────────────── */
function normalize(str = '') {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/* ─────────────────────────────────────────────────
   Hàm kiểm tra landmark có khớp query không
───────────────────────────────────────────────── */
function matchesQuery(loc, normalizedQ) {
  if (!normalizedQ) return true;
  return (
    normalize(loc.name).includes(normalizedQ) ||
    normalize(loc.description).includes(normalizedQ) ||
    normalize(loc.category).includes(normalizedQ)
  );
}

/* ─────────────────────────────────────────────────
   matchesRoom – kiểm tra room có khớp query không
───────────────────────────────────────────────── */
function matchesRoom(room, normalizedQ) {
  if (!normalizedQ) return true;
  return (
    normalize(room.room_name).includes(normalizedQ) ||
    normalize(room.description || '').includes(normalizedQ)
  );
}

/* ─────────────────────────────────────────────────
   useSearch – composable chính
   @param {Ref<Array>} campusLocations – danh sách landmark (ref)
   @returns object chứa state + computed + actions
───────────────────────────────────────────────── */
export function useSearch(campusLocations) {
  const searchQuery = ref('');
  const activeChip  = ref('all');
  const chips       = CHIPS;

  /* ── Kết quả lọc ── */
  const filteredLocations = computed(() => {
    let list = campusLocations.value ?? [];

    // 1. Lọc theo category chip
    if (activeChip.value !== 'all') {
      list = list.filter(loc =>
        normalize(loc.category || '').includes(activeChip.value)
      );
    }

    // 2. Lọc theo từ khóa (có bỏ dấu)
    const q = normalize(searchQuery.value);
    if (q) {
      list = list.filter(loc => matchesQuery(loc, q));
    }

    return list;
  });

  /* ── Tổng số kết quả ── */
  const resultCount = computed(() => filteredLocations.value.length);

  /* ── Có đang tìm kiếm không ── */
  const isSearching = computed(() =>
    searchQuery.value.trim().length > 0 || activeChip.value !== 'all'
  );

  /* ── Xóa tìm kiếm ── */
  function clearSearch() {
    searchQuery.value = '';
  }

  /* ── Reset cả bộ lọc ── */
  function resetFilter() {
    searchQuery.value = '';
    activeChip.value  = 'all';
  }

  /* ── Chọn chip ── */
  function selectChip(chipId) {
    activeChip.value = chipId;
  }

  /* ── Tìm kiếm theo tên chính xác (dùng khi chọn suggest) ── */
  function searchExact(name) {
    searchQuery.value = name;
    activeChip.value  = 'all';
  }

  /* ── Highlight text khớp query trong tên ── */
  function highlight(text = '') {
    const q = searchQuery.value.trim();
    if (!q) return text;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  return {
    /* State */
    searchQuery,
    activeChip,
    chips,

    /* Computed */
    filteredLocations,
    resultCount,
    isSearching,

    /* Actions */
    clearSearch,
    resetFilter,
    selectChip,
    searchExact,
    highlight,

    /* Helpers (xuất để dùng bên ngoài nếu cần) */
    normalize,
    matchesQuery,
    debounce,
  };
}

/* ─────────────────────────────────────────────────
   fetchLandmarks – fetch API /api/landmarks
   Có thể dùng standalone (không cần composable)
   @param {Ref<Array>} campusLocations – ref cần gán data
───────────────────────────────────────────────── */
export async function fetchLandmarks(campusLocations) {
  try {
    const res = await fetch('/api/landmarks');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();
    campusLocations.value = (result.data || []).map(loc => ({
      ...loc,
      image:      loc.image_url || loc.image || '',
      department: loc.category  || loc.department || '',
    }));
  } catch (err) {
    console.error('[Search.js] fetchLandmarks:', err);
  }
}

/* ─────────────────────────────────────────────────
   fetchRooms – fetch API /api/rooms?search=xxx
   Trả về danh sách rooms khớp keyword (hoặc tất cả khi rỗng)
───────────────────────────────────────────────── */
export async function fetchRooms(keyword = '') {
  try {
    const url = keyword.trim()
      ? `/api/rooms?search=${encodeURIComponent(keyword.trim())}`
      : '/api/rooms?limit=0'; // không cần load toàn bộ khi không có keyword
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();
    return (result.data || []).map(r => ({
      ...r,
      _type: 'room',          // phân biệt với landmark
      name:  r.room_name,    // alias để dùng chung với landmark UI
    }));
  } catch (err) {
    console.error('[Search.js] fetchRooms:', err);
    return [];
  }
}

/* ─────────────────────────────────────────────────
   useSearchWithRooms
   Mở rộng useSearch thêm tìm kiếm phòng học.
   @param {Ref<Array>} campusLocations – danh sách landmark (ref)
   @returns object giống useSearch + filteredRooms
───────────────────────────────────────────────── */
export function useSearchWithRooms(campusLocations) {
  const base = useSearch(campusLocations);
  const { searchQuery } = base;

  // Cache rooms đã fetch từ API
  const allRooms = ref([]);
  let roomFetchTimer = null;

  // Khi searchQuery thay đổi → debounce fetch rooms từ API
  watch(searchQuery, async (q) => {
    clearTimeout(roomFetchTimer);
    if (!q || !q.trim()) {
      allRooms.value = [];
      return;
    }
    roomFetchTimer = setTimeout(async () => {
      allRooms.value = await fetchRooms(q.trim());
    }, 250);
  });

  /* Danh sách rooms khớp query (đã có từ API) */
  const filteredRooms = computed(() => {
    if (!searchQuery.value || !searchQuery.value.trim()) return [];
    const q = normalize(searchQuery.value);
    return allRooms.value.filter(r => matchesRoom(r, q)).slice(0, 6);
  });

  return {
    ...base,
    allRooms,
    filteredRooms,
  };
}

// Re-export normalize + matchesRoom để dùng ở chỗ khác nếu cần
export { normalize, matchesRoom };

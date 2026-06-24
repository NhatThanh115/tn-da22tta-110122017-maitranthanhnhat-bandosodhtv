// routes/indexRoutes.js
import { createRouter, createWebHashHistory } from 'vue-router';
import { isMobile } from '@/utils/device';

// Định nghĩa các route của ứng dụng
const routes = [
  {
    path: '/',
    name: 'Homepage',       // Trang bản đồ đầy đủ dành cho PC
    component: () => import('@/Homepage.vue')
  },
  {
    path: '/map',
    name: 'Mappage',        // Trang bản đồ tối giản dành cho Mobile
    component: () => import('@/Mappage.vue')
  },
  {
    path: '/news',
    name: 'Newspage',       // Trang tin tức, thông báo, sự kiện
    component: () => import('@/Newspage.vue')
  },
  {
    path: '/news/:id',
    name: 'NewsDetailpage', // Trang đọc chi tiết bài viết
    component: () => import('@/NewsDetailpage.vue')
  },
  {
    path: '/admin/validate',
    name: 'Validate',       // Màn hình xác thực mật khẩu trước khi vào Admin
    component: () => import('@/Validate.vue')
  },
  {
    path: '/admin',
    name: 'Adminpage',      // Trang quản trị (yêu cầu xác thực qua Validate)
    component: () => import('@/Adminpage.vue'),
    meta: { requiresAdminAuth: true }
  },
  {
    path: '/landmarks',
    name: 'Landmarkpage',   // Trang danh sách tòa nhà
    component: () => import('@/Landmarkpage.vue')
  }
];

const router = createRouter({
  // Dùng Hash History để tương thích với hệ thống hash đầu cũ (#map, #admin)
  history: createWebHashHistory(),
  routes
});

// ============================================================
// NAVIGATION GUARD: Kiểm tra mọi lượt truy cập trước khi chuyển trang
// ============================================================
router.beforeEach((to, from, next) => {
  const userIsOnMobile = isMobile();

  // QUY TẮC 1: Mobile cố tình vào Homepage → Hủy và đẩy sang Mappage
  if (to.name === 'Homepage' && userIsOnMobile) {
    console.warn('[Router Guard] Mobile phát hiện! Chặn Homepage → điều hướng sang Mappage.');
    return next({ name: 'Mappage', replace: true });
  }

  // QUY TẮC 2: Truy cập Adminpage → phải qua xác thực mật khẩu trước
  if (to.meta.requiresAdminAuth) {
    const isAuthenticated = sessionStorage.getItem('admin_authenticated') === 'true';
    if (!isAuthenticated) {
      console.warn('[Router Guard] Chưa xác thực! Chặn /admin → điều hướng sang /admin/validate.');
      return next({ name: 'Validate', replace: true });
    }
  }

  // Mọi trường hợp còn lại → Cho phép đi tiếp bình thường
  next();
});

export default router;
// src/utils/device.js
// Phát hiện thiết bị Mobile bằng ba tiêu chí kết hợp:
//   1. User-Agent chứa chuỗi định danh mobile phổ biến
//   2. Thiết bị hỗ trợ màn hình cảm ứng (maxTouchPoints > 0)
//   3. Chiều rộng màn hình ≤ 1024px (ngưỡng tablet/mobile)
export const isMobile = () => {
  const hasMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  const hasTouchScreen = navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 1024;

  // Coi là Mobile khi thỏa MỌI điều kiện: UA mobile + cảm ứng + màn hình nhỏ
  return hasMobileUA && hasTouchScreen && isSmallScreen;
};
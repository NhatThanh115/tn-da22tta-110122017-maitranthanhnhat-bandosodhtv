<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router  = useRouter();
const password = ref('');
const error    = ref('');
const loading  = ref(false);
const showPass = ref(false);
const shake    = ref(false);

// Không còn lưu mật khẩu ở frontend.
// Xác thực được thực hiện qua API: POST /api/admin/config/verify

// Nếu phiên đã xác thực trước đó thì bỏ qua màn hình này
onMounted(() => {
  if (sessionStorage.getItem('admin_authenticated') === 'true') {
    router.replace({ name: 'Adminpage' });
  }
});

async function handleSubmit() {
  if (!password.value.trim()) {
    triggerError('Vui lòng nhập mật khẩu!');
    return;
  }

  loading.value = true;
  error.value   = '';

  try {
    const res = await fetch('/api/admin/config/verify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password: password.value }),
    });

    const json = await res.json();

    if (res.ok && json.authenticated) {
      sessionStorage.setItem('admin_authenticated', 'true');
      router.push({ name: 'Adminpage' });
    } else {
      loading.value = false;
      triggerError(json.message || 'Mật khẩu không chính xác. Vui lòng thử lại.');
      password.value = '';
    }
  } catch {
    loading.value = false;
    triggerError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối.');
  }
}

function triggerError(msg) {
  error.value = msg;
  shake.value = true;
  setTimeout(() => { shake.value = false; }, 600);
}

function goBack() {
  router.back();
}
</script>

<template>
  <div class="validate-page">
    <!-- Animated background -->
    <div class="validate-bg">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
      <div class="grid-overlay"></div>
    </div>

    <!-- Card -->
    <div class="validate-card" :class="{ shake: shake }">

      <!-- Logo / Icon -->
      <div class="card-icon">
        <div class="icon-ring">
          <i class="fa-solid fa-shield-halved"></i>
        </div>
      </div>

      <!-- Heading -->
      <div class="card-heading">
        <h1>Xác thực quản trị viên</h1>
        <p>Nhập mật khẩu để truy cập trang quản trị hệ thống</p>
      </div>

      <!-- Form -->
      <form class="validate-form" @submit.prevent="handleSubmit">

        <div class="input-group" :class="{ 'input-error': error }">
          <i class="fa-solid fa-lock input-icon"></i>
          <input
            id="admin-password"
            :type="showPass ? 'text' : 'password'"
            v-model="password"
            placeholder="Nhập mật khẩu..."
            autocomplete="current-password"
            :disabled="loading"
            @input="error = ''"
          />
          <button
            type="button"
            class="toggle-pass"
            @click="showPass = !showPass"
            :title="showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
          >
            <i class="fa-solid" :class="showPass ? 'fa-eye-slash' : 'fa-eye'"></i>
          </button>
        </div>

        <!-- Error message -->
        <transition name="slide-error">
          <div v-if="error" class="error-msg">
            <i class="fa-solid fa-triangle-exclamation"></i>
            {{ error }}
          </div>
        </transition>

        <!-- Submit button -->
        <button
          type="submit"
          class="btn-confirm"
          id="btn-admin-confirm"
          :disabled="loading"
        >
          <span v-if="!loading">
            <i class="fa-solid fa-arrow-right-to-bracket"></i>
            Xác nhận & Truy cập
          </span>
          <span v-else class="loading-dots">
            <i class="fa-solid fa-circle-notch fa-spin"></i>
            Đang xác thực...
          </span>
        </button>

      </form>

      <!-- Divider -->
      <div class="card-divider"></div>

      <!-- Back button -->
      <button class="btn-back" @click="goBack" id="btn-back-home">
        <i class="fa-solid fa-arrow-left"></i>
        Quay về trang trước
      </button>

      <!-- Footer badge -->
      <div class="card-footer">
        <i class="fa-solid fa-map-location-dot"></i>
        TVU Digital Map &mdash; Admin Portal
      </div>

    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

/* ─── Reset & Page Layout ─────────────────────────── */
.validate-page {
  font-family: 'Inter', sans-serif;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #080c18;
  position: relative;
  overflow: hidden;
  padding: 20px;
}

/* ─── Animated Background ─────────────────────────── */
.validate-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.35;
  animation: orbFloat 8s ease-in-out infinite;
}
.orb-1 {
  width: 500px; height: 500px;
  background: radial-gradient(circle, #1e40af, transparent);
  top: -100px; left: -100px;
  animation-delay: 0s;
}
.orb-2 {
  width: 400px; height: 400px;
  background: radial-gradient(circle, #7c3aed, transparent);
  bottom: -80px; right: -80px;
  animation-delay: -3s;
}
.orb-3 {
  width: 300px; height: 300px;
  background: radial-gradient(circle, #0e7490, transparent);
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  animation-delay: -5s;
}

@keyframes orbFloat {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%  { transform: translate(20px, -20px) scale(1.05); }
  66%  { transform: translate(-15px, 15px) scale(0.97); }
}

.grid-overlay {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 40px 40px;
}

/* ─── Card ────────────────────────────────────────── */
.validate-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 440px;
  background: rgba(15, 20, 40, 0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  padding: 48px 40px 36px;
  box-shadow:
    0 0 0 1px rgba(99, 102, 241, 0.15),
    0 25px 50px rgba(0, 0, 0, 0.6),
    0 0 80px rgba(99, 102, 241, 0.08);
  transition: box-shadow 0.3s;
}

.validate-card:focus-within {
  box-shadow:
    0 0 0 1px rgba(99, 102, 241, 0.4),
    0 25px 50px rgba(0, 0, 0, 0.6),
    0 0 100px rgba(99, 102, 241, 0.15);
}

/* Shake animation */
.shake {
  animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  15%  { transform: translateX(-8px); }
  30%  { transform: translateX(8px); }
  45%  { transform: translateX(-6px); }
  60%  { transform: translateX(6px); }
  75%  { transform: translateX(-3px); }
  90%  { transform: translateX(3px); }
}

/* ─── Icon ────────────────────────────────────────── */
.card-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 28px;
}
.icon-ring {
  width: 72px; height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: #fff;
  box-shadow: 0 0 0 12px rgba(99, 102, 241, 0.12), 0 8px 24px rgba(99, 102, 241, 0.4);
  animation: iconPulse 3s ease-in-out infinite;
}
@keyframes iconPulse {
  0%, 100% { box-shadow: 0 0 0 12px rgba(99, 102, 241, 0.12), 0 8px 24px rgba(99, 102, 241, 0.4); }
  50%       { box-shadow: 0 0 0 18px rgba(99, 102, 241, 0.06), 0 8px 32px rgba(99, 102, 241, 0.5); }
}

/* ─── Heading ─────────────────────────────────────── */
.card-heading {
  text-align: center;
  margin-bottom: 32px;
}
.card-heading h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #f0f4ff;
  margin: 0 0 8px;
  letter-spacing: -0.01em;
}
.card-heading p {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
  line-height: 1.5;
}

/* ─── Form ────────────────────────────────────────── */
.validate-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-group {
  position: relative;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  transition: border-color 0.25s, background 0.25s, box-shadow 0.25s;
}
.input-group:focus-within {
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.06);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}
.input-group.input-error {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.06);
}
.input-group.input-error:focus-within {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
}

.input-icon {
  padding: 0 14px;
  color: #6b7280;
  font-size: 15px;
  flex-shrink: 0;
}
.input-group input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #e2e8f0;
  font-size: 0.95rem;
  font-family: inherit;
  padding: 14px 0;
  letter-spacing: 0.01em;
}
.input-group input::placeholder {
  color: #4b5563;
}
.input-group input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-pass {
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 0 14px;
  font-size: 15px;
  transition: color 0.2s;
  flex-shrink: 0;
}
.toggle-pass:hover { color: #a5b4fc; }

/* ─── Error message ───────────────────────────────── */
.error-msg {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  color: #f87171;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  padding: 10px 14px;
}
.slide-error-enter-active,
.slide-error-leave-active {
  transition: all 0.25s ease;
}
.slide-error-enter-from,
.slide-error-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* ─── Confirm Button ──────────────────────────────── */
.btn-confirm {
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.35);
  margin-top: 4px;
}
.btn-confirm:hover:not(:disabled) {
  opacity: 0.92;
  transform: translateY(-1px);
  box-shadow: 0 6px 28px rgba(99, 102, 241, 0.5);
}
.btn-confirm:active:not(:disabled) {
  transform: translateY(0);
}
.btn-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ─── Divider ─────────────────────────────────────── */
.card-divider {
  margin: 28px 0 20px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent);
}

/* ─── Back Button ─────────────────────────────────── */
.btn-back {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 11px;
  border-radius: 10px;
  border: 1.5px solid rgba(255, 255, 255, 0.08);
  background: transparent;
  color: #9ca3af;
  font-size: 0.875rem;
  font-family: inherit;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
}
.btn-back:hover {
  color: #e2e8f0;
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.04);
}

/* ─── Footer ──────────────────────────────────────── */
.card-footer {
  text-align: center;
  margin-top: 20px;
  font-size: 0.78rem;
  color: #374151;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

/* ─── Responsive ──────────────────────────────────── */
@media (max-width: 480px) {
  .validate-card {
    padding: 36px 24px 28px;
    border-radius: 20px;
  }
  .card-heading h1 { font-size: 1.25rem; }
}
</style>

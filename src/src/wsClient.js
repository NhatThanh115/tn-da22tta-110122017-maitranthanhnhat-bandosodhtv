/**
 * wsClient.js – TVU Digital Map
 * Kết nối WebSocket tới backend, xử lý các sự kiện:
 *   • page-reload  → tải lại trang hiện tại
 *   • navigate     → chuyển tới hash mới (ví dụ #map, #admin)
 *   • notify       → hiển thị toast thông báo (tùy chọn)
 */

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  `ws://${window.location.hostname}:3000/ws`;

const RECONNECT_DELAY_MS = 3000;

let   ws           = null;
let   reconnectTimer = null;
let   toastEl      = null;

/* ──────────────────────────────────────────
   Toast UI (nhỏ, không phụ thuộc framework)
────────────────────────────────────────── */
function showToast(message, type = 'info') {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'ws-toast';
    Object.assign(toastEl.style, {
      position:     'fixed',
      bottom:       '24px',
      right:        '24px',
      zIndex:       '99999',
      display:      'flex',
      flexDirection:'column',
      gap:          '8px',
      pointerEvents:'none',
    });
    document.body.appendChild(toastEl);
  }

  const colors = {
    info:    { bg: '#1a73e8', icon: 'ℹ️' },
    success: { bg: '#34a853', icon: '✅' },
    warning: { bg: '#fbbc04', icon: '⚠️' },
    error:   { bg: '#ea4335', icon: '❌' },
  };
  const { bg, icon } = colors[type] || colors.info;

  const el = document.createElement('div');
  Object.assign(el.style, {
    padding:      '10px 16px',
    borderRadius: '10px',
    background:   bg,
    color:        '#fff',
    fontSize:     '0.875rem',
    fontFamily:   'Roboto, Inter, sans-serif',
    boxShadow:    '0 4px 14px rgba(0,0,0,.25)',
    opacity:      '0',
    transform:    'translateY(10px)',
    transition:   'opacity .3s, transform .3s',
    maxWidth:     '320px',
    lineHeight:   '1.4',
  });
  el.textContent = `${icon}  ${message}`;
  toastEl.appendChild(el);

  // Animate in
  requestAnimationFrame(() => {
    el.style.opacity   = '1';
    el.style.transform = 'translateY(0)';
  });

  // Auto remove after 4 s
  setTimeout(() => {
    el.style.opacity   = '0';
    el.style.transform = 'translateY(10px)';
    setTimeout(() => el.remove(), 350);
  }, 4000);
}

/* ──────────────────────────────────────────
   Handle messages from server
────────────────────────────────────────── */
function handleMessage(raw) {
  let msg;
  try { msg = JSON.parse(raw); }
  catch { return; }

  const { event, data = {} } = msg;

  switch (event) {
    /* Tải lại trang hiện tại */
    case 'page-reload':
      showToast(data.reason || 'Server yêu cầu tải lại trang...', 'info');
      setTimeout(() => window.location.reload(), data.delay ?? 1500);
      break;

    /* Chuyển trang qua hash (#map, #admin, #) */
    case 'navigate':
      if (data.hash !== undefined) {
        showToast(`Chuyển trang → ${data.hash || 'Trang chủ'}`, 'info');
        setTimeout(() => {
          window.location.hash = data.hash;
          window.location.reload();
        }, data.delay ?? 1200);
      }
      break;

    /* Thông báo đơn thuần */
    case 'notify':
      showToast(data.message || '', data.type || 'info');
      break;

    default:
      console.debug('[WS] Unknown event:', event);
  }
}

/* ──────────────────────────────────────────
   Connect / Reconnect
────────────────────────────────────────── */
function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  ws = new WebSocket(WS_URL);

  ws.addEventListener('open', () => {
    console.info('[WS] Kết nối thành công:', WS_URL);
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    // Gửi handshake
    ws.send(JSON.stringify({ event: 'hello', client: 'browser', hash: window.location.hash }));
  });

  ws.addEventListener('message', e => handleMessage(e.data));

  ws.addEventListener('close', () => {
    console.warn('[WS] Mất kết nối – thử lại sau', RECONNECT_DELAY_MS, 'ms');
    reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
  });

  ws.addEventListener('error', err => {
    console.error('[WS] Lỗi:', err);
    ws.close(); // sẽ kích hoạt 'close' → reconnect
  });
}

/* ──────────────────────────────────────────
   Public API – dùng từ component nếu cần
────────────────────────────────────────── */
export function send(event, data = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event, data }));
  }
}

export function initWebSocket() {
  connect();
}

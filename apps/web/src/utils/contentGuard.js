/**
 * Chặn thao tác lấy dữ liệu trên web: chuột phải, F12, xem nguồn, lưu trang.
 * Charles / proxy hệ thống không chặn được từ trình duyệt — khi phát hiện
 * DevTools thì dừng phát để hạn chế rip link.
 */

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isTypingTarget(el) {
  if (!el) return false;
  const n = el.tagName;
  return TYPING.has(n) || !!el.isContentEditable;
}

function isHotkey(e) {
  const k = e.key;
  const code = e.code;
  const ctrl = e.ctrlKey || e.metaKey;
  if (k === 'F12' || code === 'F12') return true;
  if (ctrl && e.shiftKey && /^(I|J|C|K)$/i.test(k)) return true;
  if (ctrl && !e.shiftKey && /^(U|S|P)$/i.test(k)) return true;
  if (e.metaKey && e.altKey && /^(I|J|C|U)$/i.test(k)) return true;
  return false;
}

function pauseMedia() {
  try {
    document.querySelectorAll('video, audio').forEach((el) => {
      try { el.pause(); } catch {}
    });
  } catch {}
}

let overlayEl = null;
function showBlock(on) {
  if (on) {
    pauseMedia();
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.setAttribute('data-chrtv-guard', '1');
      overlayEl.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:#07080c;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;font-family:Inter,system-ui,sans-serif;';
      overlayEl.innerHTML = '<p style="color:#fff;font-weight:900;font-size:18px;letter-spacing:.04em">playZ</p><p style="color:#a8a29a;font-size:13px">Không hỗ trợ công cụ nhà phát triển.</p>';
      document.documentElement.appendChild(overlayEl);
    }
  } else if (overlayEl) {
    try { overlayEl.remove(); } catch {}
    overlayEl = null;
  }
}

function looksLikeDevtools() {
  try {
    if (navigator.webdriver) return true;
  } catch {}
  try {
    if (window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized) return true;
  } catch {}
  try {
    if (window.self !== window.top) return false;
    const w = Math.abs((window.outerWidth || 0) - (window.innerWidth || 0));
    const h = Math.abs((window.outerHeight || 0) - (window.innerHeight || 0));
    if (w > 280 || h > 280) return true;
  } catch {}
  return false;
}

/**
 * Whether the guard runs at all.
 *
 * It used to run on every load. It no longer does, for one reason: the devtools
 * heuristic below compares window.outerWidth against innerWidth, and a browser
 * sidebar, a zoom level, a snapped window, or a preview pane can all push that
 * difference past the threshold. When it fires, the guard covers the entire
 * product with a near-black overlay — which is indistinguishable from the app
 * failing to start, and it also swallows F12, so the person looking at the black
 * screen cannot open the console to find out why.
 *
 * The guard is still here and still complete. It is opt-in now:
 *
 *   ?chrtv_guard=1                      one session
 *   localStorage.chrtv_content_guard = '1'   this browser
 *
 * Note that `?chrtv_debug=1` still disables it, so existing bookmarks that rely
 * on that keep working.
 */
function guardEnabled() {
  try {
    if (new URLSearchParams(window.location.search).get('chrtv_debug') === '1') return false;
    if (new URLSearchParams(window.location.search).get('chrtv_guard') === '1') return true;
    return localStorage.getItem('chrtv_content_guard') === '1';
  } catch {
    // Storage or URL unavailable: stay off. A protection feature must never be
    // the reason the product does not open.
    return false;
  }
}

export function installContentGuard() {
  if (typeof window === 'undefined') return;
  if (!guardEnabled()) return;

  const block = (e) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  document.addEventListener('contextmenu', block, true);
  document.addEventListener('dragstart', (e) => {
    if (isTypingTarget(e.target)) return;
    block(e);
  }, true);
  document.addEventListener('copy', (e) => {
    if (isTypingTarget(e.target)) return;
    block(e);
  }, true);
  document.addEventListener('cut', (e) => {
    if (isTypingTarget(e.target)) return;
    block(e);
  }, true);
  document.addEventListener('selectstart', (e) => {
    if (isTypingTarget(e.target)) return;
    block(e);
  }, true);

  window.addEventListener('keydown', (e) => {
    if (!isHotkey(e)) return;
    e.preventDefault();
    e.stopPropagation();
    pauseMedia();
  }, true);

  let flagged = false;
  const tick = () => {
    const open = looksLikeDevtools();
    if (open !== flagged) {
      flagged = open;
      showBlock(open);
    } else if (open) {
      pauseMedia();
    }
  };
  tick();
  setInterval(tick, 1200);
  window.addEventListener('resize', tick);
}

/**
 * playZ — admin application entry
 * ============================================================================
 * Phase 13 starts here. This scaffold establishes the structure, the
 * authorisation gate and the shell; the management surfaces are built on top
 * of it in the following commits.
 *
 * SECURITY NOTE — the check below is a user-experience gate, not a security
 * boundary. Anyone can edit client state. Every /admin/* endpoint must verify
 * the caller's role server-side, and that verification is what actually
 * protects these operations. The split onto a separate hostname means the
 * consumer origin cannot even reach the admin session, which is defence in
 * depth on top of the server check.
 */
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { API_BASE, apiUrl } from './api';
import AdminShell from './AdminShell';
import './styles.css';

function AdminApp() {
  const [state, setState] = useState({ status: 'checking', user: null, error: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      const token = localStorage.getItem('chrtv_token') || '';
      if (!token) {
        if (alive) setState({ status: 'signed-out', user: null, error: null });
        return;
      }
      try {
        const res = await fetch(apiUrl('/user/me'), {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const user = data.user || data;
        if (!user || user.role !== 'admin') {
          if (alive) setState({ status: 'forbidden', user: null, error: null });
          return;
        }
        if (alive) setState({ status: 'ready', user, error: null });
      } catch (e) {
        if (alive) setState({ status: 'error', user: null, error: e.message });
      }
    })();
    return () => { alive = false; };
  }, []);

  if (state.status === 'checking') return <Splash label="Đang kiểm tra quyền truy cập…" />;
  if (state.status === 'signed-out') return <SignIn />;
  if (state.status === 'forbidden') return <Splash label="Tài khoản này không có quyền quản trị." tone="warn" />;
  if (state.status === 'error') return <Splash label={`Không kiểm tra được quyền: ${state.error}`} tone="error" />;

  return <AdminShell user={state.user} />;
}

function Splash({ label, tone = 'neutral' }) {
  const colors = { neutral: '#8A8A99', warn: '#FFC53D', error: '#FF3B47' };
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, textAlign: 'center',
    }}>
      <img src="/brand/playz-symbol-dark.svg" alt="" width="44" height="44" />
      <p style={{ color: colors[tone], fontSize: 13.5, fontWeight: 600, maxWidth: 420, lineHeight: 1.6 }}>{label}</p>
    </div>
  );
}

function SignIn() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24, textAlign: 'center',
    }}>
      <img src="/brand/playz-logo-dark.svg" alt="playZ" width="170" />
      <div>
        <h1 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 8px' }}>Bảng điều khiển</h1>
        <p style={{ color: '#8A8A99', fontSize: 13, maxWidth: 380, lineHeight: 1.7, margin: 0 }}>
          Đăng nhập bằng tài khoản quản trị để tiếp tục. Phiên đăng nhập được dùng chung với
          ứng dụng người xem.
        </p>
      </div>
      <a
        href="https://thelac.dpdns.org/?tab=channels"
        style={{
          display: 'inline-block', padding: '11px 24px', borderRadius: 12,
          background: '#2F6BFF', color: '#fff', fontSize: 13.5, fontWeight: 700, textDecoration: 'none',
        }}
      >
        Đăng nhập trên playZ
      </a>
      <p style={{ color: '#55555F', fontSize: 11.5, maxWidth: 360, lineHeight: 1.6 }}>
        API: {API_BASE || 'cùng origin'}
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>
);

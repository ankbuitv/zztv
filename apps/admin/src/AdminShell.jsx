/**
 * playZ admin — application shell
 * ============================================================================
 * A real, independent admin frame: persistent sidebar, content header, and a
 * navigation registry that the management screens plug into.
 *
 * The navigation list below is the contract for phase 13. Entries are marked so
 * it is obvious what exists versus what is still to be built — an admin that
 * silently omits half its surfaces is worse than one that is honest about it.
 */
import React, { useMemo, useState } from 'react';
import { color as C, radius } from './api';

export const NAV = [
  { group: 'Tổng quan', items: [
    { id: 'dashboard', label: 'Dashboard', ready: false },
    { id: 'analytics', label: 'Thống kê', ready: false },
  ]},
  { group: 'Nội dung', items: [
    { id: 'homepage', label: 'Trang chủ', note: 'hero + rails', ready: false },
    { id: 'movies', label: 'Phim / TV Shows', ready: false },
    { id: 'livetv', label: 'Truyền hình', ready: false },
    { id: 'epg', label: 'EPG', ready: false },
    { id: 'sports', label: 'Thể thao', ready: false },
    { id: 'shorts', label: 'Shorts', ready: false },
  ]},
  { group: 'Cộng đồng', items: [
    { id: 'community', label: 'Bài viết & bình luận', ready: false },
    { id: 'chat', label: 'Kiểm duyệt chat', ready: false },
  ]},
  { group: 'Người dùng', items: [
    { id: 'users', label: 'Tài khoản', ready: false },
    { id: 'plans', label: 'Gói cước', ready: false },
    { id: 'payments', label: 'Thanh toán', ready: false },
  ]},
  { group: 'Hệ thống', items: [
    { id: 'notifications', label: 'Thông báo', ready: false },
    { id: 'branding', label: 'Nhận diện', ready: false },
    { id: 'navigation', label: 'Điều hướng', ready: false },
    { id: 'settings', label: 'Cài đặt', ready: false },
    { id: 'audit', label: 'Nhật ký thao tác', ready: false },
  ]},
];

function NavButton({ item, active, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button" onClick={onClick} aria-current={active ? 'page' : undefined}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', width: '100%',
        height: 36, padding: '0 12px', gap: 9, borderRadius: radius.sm,
        background: active ? 'rgba(47,107,255,.14)' : hover ? 'rgba(255,255,255,.05)' : 'transparent',
        color: active ? '#fff' : hover ? C.text : C.textMuted,
        border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 500,
        textAlign: 'left', transition: 'background 140ms ease, color 140ms ease',
      }}
    >
      {active && (
        <span aria-hidden="true" style={{
          position: 'absolute', left: 0, top: '22%', bottom: '22%', width: 3,
          borderRadius: radius.pill, background: C.blue,
        }} />
      )}
      <span style={{ flex: 1 }}>{item.label}</span>
      {!item.ready && (
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '.04em', color: C.textFaint,
          border: `1px solid ${C.line}`, borderRadius: radius.xs, padding: '1px 5px',
        }}>SOON</span>
      )}
    </button>
  );
}

export default function AdminShell({ user }) {
  const [active, setActive] = useState('dashboard');
  const flat = useMemo(() => NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group }))), []);
  const current = flat.find((i) => i.id === active);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 'var(--sidebar)', flexShrink: 0, background: C.bg,
        borderRight: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          height: 'var(--header)', display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 16px', borderBottom: `1px solid ${C.line}`, flexShrink: 0,
        }}>
          <img src="/brand/playz-symbol-dark.svg" alt="" width="26" height="26" />
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>playZ</div>
            <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: '.06em' }}>QUẢN TRỊ</div>
          </div>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
          {NAV.map((g) => (
            <div key={g.group} style={{ marginBottom: 16 }}>
              <p style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase',
                color: C.textFaint, padding: '0 12px', marginBottom: 6, margin: '0 0 6px',
              }}>{g.group}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {g.items.map((item) => (
                  <NavButton key={item.id} item={item} active={active === item.id} onClick={() => setActive(item.id)} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div style={{ padding: 12, borderTop: `1px solid ${C.line}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 4px' }}>
            <span style={{
              width: 30, height: 30, borderRadius: '50%', background: C.blue, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 800,
            }}>
              {(user.display_name || user.username || 'A').charAt(0).toUpperCase()}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.display_name || user.username}
              </div>
              <div style={{ fontSize: 10.5, color: C.textMuted }}>admin</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{
          height: 'var(--header)', flexShrink: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '0 22px',
          borderBottom: `1px solid ${C.line}`, background: 'rgba(8,8,10,.86)',
          backdropFilter: 'blur(12px)',
        }}>
          <div>
            <h1 style={{ fontSize: 15.5, fontWeight: 800, margin: 0 }}>{current?.label || 'Quản trị'}</h1>
            <p style={{ fontSize: 11, color: C.textMuted, margin: '2px 0 0' }}>{current?.group}</p>
          </div>
          <a
            href="https://thelac.dpdns.org"
            target="_blank" rel="noreferrer noopener"
            style={{
              fontSize: 12, fontWeight: 700, textDecoration: 'none', color: C.text,
              border: `1px solid ${C.lineStrong}`, borderRadius: radius.sm, padding: '7px 13px',
            }}
          >
            Mở ứng dụng ↗
          </a>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
          <div style={{
            border: `1px dashed ${C.lineStrong}`, borderRadius: radius.lg,
            padding: '48px 28px', textAlign: 'center', background: C.bgElevated,
          }}>
            <img src="/brand/playz-symbol-dark.svg" alt="" width="38" height="38" style={{ opacity: .5 }} />
            <h2 style={{ fontSize: 15.5, fontWeight: 800, margin: '16px 0 8px' }}>
              {current?.label}
            </h2>
            <p style={{ fontSize: 13, color: C.textMuted, maxWidth: 460, margin: '0 auto', lineHeight: 1.7 }}>
              Màn hình này chưa được xây dựng. Khung quản trị, xác thực quyền phía máy chủ và
              phân tách khỏi ứng dụng người xem đã sẵn sàng — các bề mặt quản lý sẽ được bổ sung
              theo từng đợt.
            </p>
            <p style={{ fontSize: 11.5, color: C.textFaint, margin: '18px 0 0', lineHeight: 1.6 }}>
              Ứng dụng quản trị chạy trên <b style={{ color: C.textMuted }}>admin.thelac.dpdns.org</b>,
              tách khỏi ứng dụng người xem.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

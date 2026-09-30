/**
 * playZ — application header
 * ============================================================================
 * Desktop order: menu · search · language · notifications · download app ·
 * subscription CTA · profile.
 *
 * The header is transparent while it sits over the cinematic hero and turns
 * into dark glass once the page scrolls, so the hero artwork is not boxed in.
 * Background and blur are animated; layout properties are not.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Search, Bell, Download, Globe, User, LogOut, Check, Crown, Settings as Cog, X,
} from 'lucide-react';
import { color as C, motion, radius, z, prefersReducedMotion } from './tokens';
import { PlayzLogo } from './Logo';
import { Button, IconButton, LiveDot } from './ui';
import { MenuButton } from './Sidebar';
import { API_BASE } from '../services/config';

const LANGS = [
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'fil', label: 'Filipino', flag: '🇵🇭' },
];

/** Dropdown that anchors to its trigger and closes on outside click / Escape. */
function Popover({ open, onClose, children, align = 'right', width = 240 }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      ref={ref} role="dialog"
      style={{
        position: 'absolute', top: 'calc(100% + 8px)', [align]: 0,
        width, background: C.bgElevated, border: `1px solid ${C.line}`,
        borderRadius: radius.lg, boxShadow: '0 20px 60px rgba(0,0,0,.7)',
        zIndex: z.dropdown, padding: 6, transformOrigin: align === 'right' ? 'top right' : 'top left',
        animation: prefersReducedMotion() ? 'none' : 'playzPopIn 160ms ' + motion.easeOut + ' both',
      }}
    >
      {children}
    </div>
  );
}

function MenuRow({ icon: Icon, label, onClick, tint, danger }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button" onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="flex items-center w-full"
      style={{
        padding: '9px 11px', gap: 10, borderRadius: radius.sm, border: 'none',
        background: hover ? 'rgba(255,255,255,.07)' : 'transparent',
        color: danger ? C.red : C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
      }}
    >
      {Icon && <Icon size={15} strokeWidth={2.2} style={{ color: tint || C.textMuted, flexShrink: 0 }} />}
      <span className="flex-1">{label}</span>
    </button>
  );
}

export default function PlayzHeader({
  scrolled, onToggleSidebar, sidebarExpanded,
  searchQuery, onSearchChange, onSearchSubmit,
  user, plan, onLogin, onOpenPlans, onOpenSettings,
  onOpenProfile, language, onLanguageChange,
  onDownloadApp, onOpenAdmin, isMobile,
}) {
  const [open, setOpen] = useState(null); // 'notif' | 'lang' | 'user' | null
  const [localQ, setLocalQ] = useState(searchQuery || '');
  const reduced = prefersReducedMotion();

  // --- notifications --------------------------------------------------------
  // Preserved from the CHRTV TopNav implementation, including the storage key.
  // `chrtv_notif_read` is deliberately NOT renamed: a new name would make every
  // existing user see every historical notification as unread.
  const [notifs, setNotifs] = useState([]);
  const [lastRead, setLastRead] = useState(() => {
    try { return parseInt(localStorage.getItem('chrtv_notif_read') || '0', 10); } catch { return 0; }
  });

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch(`${API_BASE}/api/notifications`, { headers: { Accept: 'application/json' } })
        .then((r) => r.json())
        .then((d) => { if (alive) setNotifs(d.notifications || []); })
        .catch(() => { /* offline — keep whatever is on screen */ });
    };
    load();
    // Refresh when the user returns to the tab, not on a tight interval.
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  const markAllRead = () => {
    const now = Date.now();
    try { localStorage.setItem('chrtv_notif_read', String(now)); } catch { /* quota */ }
    setLastRead(now);
  };

  const decorated = notifs.map((n) => ({
    ...n,
    read: lastRead > 0 && new Date(n.created_at || 0).getTime() < lastRead,
  }));
  const unread = decorated.filter((n) => !n.read).length;

  useEffect(() => { setLocalQ(searchQuery || ''); }, [searchQuery]);

  const toggle = (which) => setOpen((o) => (o === which ? null : which));
  const close = () => setOpen(null);

  const submitSearch = (e) => {
    e.preventDefault();
    onSearchSubmit && onSearchSubmit(localQ.trim());
  };

  const notifications = decorated;

  return (
    <header
      className="flex items-center shrink-0 sticky top-0"
      style={{
        height: 64, padding: isMobile ? '0 12px' : '0 20px', gap: isMobile ? 8 : 14,
        zIndex: z.stickyHeader,
        background: scrolled ? 'rgba(8,8,10,.86)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px) saturate(140%)' : 'none',
        borderBottom: `1px solid ${scrolled ? C.line : 'transparent'}`,
        transition: reduced ? 'none' : motion.t(motion.base, motion.ease, 'background,border-color'),
      }}
    >
      <MenuButton onClick={onToggleSidebar} expanded={sidebarExpanded} />

      {/* Logo appears in the header only when the rail is collapsed or on mobile,
          which keeps the two from competing for the same space. */}
      {(!sidebarExpanded || isMobile) && (
        <button
          type="button" onClick={() => onSearchSubmit && onSearchSubmit('')} aria-label="playZ — trang chủ"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <PlayzLogo size={isMobile ? 24 : 26} tint="#fff" showWordmark={!isMobile} />
        </button>
      )}

      {/* Search — a normal OTT search field, not a command palette. */}
      <form onSubmit={submitSearch} role="search" className="flex-1" style={{ maxWidth: 460, minWidth: 0 }}>
        <div
          className="flex items-center"
          style={{
            height: 38, padding: '0 12px', gap: 9, borderRadius: radius.md,
            background: 'rgba(255,255,255,.07)', border: `1px solid ${C.line}`,
          }}
        >
          <Search size={16} strokeWidth={2.4} style={{ color: C.textMuted, flexShrink: 0 }} />
          <input
            value={localQ}
            onChange={(e) => { setLocalQ(e.target.value); onSearchChange && onSearchChange(e.target.value); }}
            placeholder="Tìm phim, kênh, thể thao…"
            aria-label="Tìm kiếm"
            style={{
              flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
              color: C.text, fontSize: 13, fontWeight: 500,
            }}
          />
          {localQ && (
            <button
              type="button" aria-label="Xoá tìm kiếm"
              onClick={() => { setLocalQ(''); onSearchChange && onSearchChange(''); }}
              style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 0, display: 'flex' }}
            >
              <X size={14} strokeWidth={2.6} />
            </button>
          )}
        </div>
      </form>

      <div className="flex-1" />

      {/* Language */}
      <div style={{ position: 'relative' }}>
        <IconButton
          icon={Globe} label={`Ngôn ngữ: ${(LANGS.find((l) => l.code === language) || LANGS[0]).label}`}
          onClick={() => toggle('lang')} active={open === 'lang'}
        />
        <Popover open={open === 'lang'} onClose={close} width={188}>
          {LANGS.map((l) => (
            <button
              key={l.code} type="button"
              onClick={() => { onLanguageChange && onLanguageChange(l.code); close(); }}
              className="flex items-center w-full"
              style={{
                padding: '8px 11px', gap: 10, borderRadius: radius.sm, border: 'none',
                background: language === l.code ? 'rgba(47,107,255,.14)' : 'transparent',
                color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 15 }}>{l.flag}</span>
              <span className="flex-1">{l.label}</span>
              {language === l.code && <Check size={14} strokeWidth={3} style={{ color: C.blueSoft }} />}
            </button>
          ))}
        </Popover>
      </div>

      {/* Notifications */}
      <div style={{ position: 'relative' }}>
        <IconButton
          icon={Bell} label={unread ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
          badge={unread} onClick={() => toggle('notif')} active={open === 'notif'}
        />
        <Popover open={open === 'notif'} onClose={close} width={330}>
          <div className="flex items-center justify-between" style={{ padding: '9px 11px 7px' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>Thông báo</span>
            {unread > 0 && (
              <button
                type="button" onClick={markAllRead}
                style={{ background: 'none', border: 'none', color: C.blueSoft, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                Đánh dấu đã đọc
              </button>
            )}
          </div>
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <p style={{ padding: '22px 12px', textAlign: 'center', fontSize: 12, color: C.textMuted }}>
                {user ? 'Chưa có thông báo nào.' : 'Đăng nhập để nhận thông báo.'}
              </p>
            ) : notifications.slice(0, 20).map((n) => (
              <div
                key={n.id}
                style={{
                  padding: '10px 11px', borderRadius: radius.sm,
                  background: n.read ? 'transparent' : 'rgba(47,107,255,.07)',
                  borderLeft: n.read ? '2px solid transparent' : `2px solid ${C.blue}`,
                }}
              >
                <p style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 2 }}>{n.title}</p>
                {n.body && <p style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 1.5 }}>{n.body}</p>}
              </div>
            ))}
          </div>
        </Popover>
      </div>

      {/* Install / download app */}
      <IconButton icon={Download} label="Tải ứng dụng" onClick={onDownloadApp} />

      {/* Subscription CTA — the one orange control in the header. */}
      {!isMobile && (
        <Button variant="cta" size="sm" icon={Crown} onClick={onOpenPlans} title="Nâng cấp gói">
          {plan && plan !== 'standard' ? String(plan).toUpperCase() : 'Nâng cấp'}
        </Button>
      )}

      {/* Profile */}
      {user ? (
        <div style={{ position: 'relative' }}>
          <button
            type="button" onClick={() => toggle('user')} aria-label="Tài khoản" aria-expanded={open === 'user'}
            className="flex items-center justify-center"
            style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
              background: C.blue, color: '#fff', border: 'none',
              fontSize: 13.5, fontWeight: 800,
            }}
          >
            {(user.display_name || user.username || 'U').charAt(0).toUpperCase()}
          </button>
          <Popover open={open === 'user'} onClose={close} width={236}>
            <div style={{ padding: '9px 11px 7px', borderBottom: `1px solid ${C.line}`, marginBottom: 4 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
                {user.display_name || user.username}
              </p>
              <p style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                {plan ? String(plan).toUpperCase() : 'STANDARD'}
              </p>
            </div>
            <MenuRow icon={User} label="Hồ sơ" onClick={() => { close(); onOpenProfile && onOpenProfile(); }} />
            <MenuRow icon={Crown} label="Gói cước" onClick={() => { close(); onOpenPlans && onOpenPlans(); }} />
            <MenuRow icon={Cog} label="Cài đặt" onClick={() => { close(); onOpenSettings && onOpenSettings(); }} />
            {user.role === 'admin' && (
              <MenuRow icon={Check} label="Quản trị" tint={C.blueSoft} onClick={() => { close(); onOpenAdmin && onOpenAdmin(); }} />
            )}
            <div style={{ height: 1, background: C.line, margin: '4px 0' }} />
            <MenuRow icon={LogOut} label="Đăng xuất" danger onClick={() => { close(); onOpenProfile && onOpenProfile('logout'); }} />
          </Popover>
        </div>
      ) : (
        <Button variant="light" size="sm" onClick={onLogin}>Đăng nhập</Button>
      )}
    </header>
  );
}

export { LiveDot };

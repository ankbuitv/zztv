/**
 * playZ — Live TV
 * ============================================================================
 * Layout contract (spec §10):
 *
 *   ┌──────────────────────────────────┬──────────────────┐
 *   │                                  │                  │
 *   │        player (16:9, main)       │   EPG panel      │
 *   │                                  │   scrollable     │
 *   ├──────────────────────────────────┤   schedule       │
 *   │  now / next strip · channel info │   date nav       │
 *   └──────────────────────────────────┴──────────────────┘
 *   ┌───────────────────────────────────────────────────────┐
 *   │  categories · search · favourites · channel grid      │
 *   └───────────────────────────────────────────────────────┘
 *
 * Deliberate decisions:
 *
 *  - The EPG panel is a sibling of the player, not a separate page. Watching a
 *    channel and finding out what is on next are the same activity, so they
 *    share one screen, and the EPG nav entry was removed because it duplicated
 *    this data.
 *
 *  - There is NO scroll-away mini player. A floating player that follows the
 *    page is a persistent obstruction while browsing channels, which is exactly
 *    what this page is for. The player stays in its frame.
 *
 *  - Streaming is handled by TvPlayerCore, which is the same implementation the
 *    legacy page uses. No stream parsing, token rotation or fallback logic was
 *    reimplemented here.
 *
 *  - Categories come from the real group_title values in the playlist. Nothing
 *    is hardcoded, so when the owner adds a group it appears automatically.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Heart, Radio, Clock, RefreshCw, Tv, ChevronLeft, ChevronRight,
  LayoutGrid, List, X, CalendarDays,
} from 'lucide-react';
import { color as C, motion, radius, shadow, prefersReducedMotion } from './tokens';
import { Button, Chip, Badge, LiveDot, EmptyState, IconButton } from './ui';
import SimpleHlsPlayer from '../components/TvPlayerCore';
import { parseEpgDate } from '../utils/dateUtils';

const ALL = 'Tất Cả';
const FAVOURITES = 'Kênh yêu thích';

// ---------------------------------------------------------------------------
// EPG helpers
// ---------------------------------------------------------------------------
const toMs = (p) => {
  const s = p?._s ?? parseEpgDate(p?.start) ?? 0;
  return typeof s === 'number' ? s : 0;
};
const toEnd = (p) => {
  const e = p?._e ?? parseEpgDate(p?.stop) ?? 0;
  return typeof e === 'number' ? e : 0;
};

function progressOf(p, now) {
  const s = toMs(p); const e = toEnd(p);
  if (!s || !e || e <= s) return 0;
  return Math.max(0, Math.min(1, (now - s) / (e - s)));
}

function fmtTime(ms) {
  if (!ms) return '--:--';
  try {
    return new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  } catch { return '--:--'; }
}

function fmtDuration(p) {
  const s = toMs(p); const e = toEnd(p);
  if (!s || !e) return '';
  const mins = Math.round((e - s) / 60000);
  if (mins < 60) return `${mins} phút`;
  const h = Math.floor(mins / 60);
  return `${h}h${String(mins % 60).padStart(2, '0')}`;
}

const dayKey = (ms) => new Date(ms).toDateString();

function fmtDay(ms) {
  const d = new Date(ms);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(ms); that.setHours(0, 0, 0, 0);
  const diff = Math.round((that - today) / 86400000);
  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Ngày mai';
  if (diff === -1) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

// ---------------------------------------------------------------------------
// EPG panel — the right column
// ---------------------------------------------------------------------------
function EpgPanel({ channel, programmes, onPlayCatchup, canCatchup }) {
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [dayOffset, setDayOffset] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Reset to today whenever the channel changes.
  useEffect(() => { setDayOffset(0); }, [channel?.channel_id]);

  const days = useMemo(() => {
    const base = new Date(); base.setHours(0, 0, 0, 0);
    return [-1, 0, 1, 2].map((d) => new Date(base).getTime() + d * 86400000);
  }, []);

  const dayList = useMemo(() => {
    const target = dayKey(days[Math.max(0, Math.min(days.length - 1, dayOffset + 1))]);
    return (programmes || [])
      .filter((p) => { const s = toMs(p); return s && dayKey(s) === target; })
      .sort((a, b) => toMs(a) - toMs(b));
  }, [programmes, days, dayOffset]);

  const current = useMemo(
    () => (programmes || []).find((p) => toMs(p) <= nowTs && toEnd(p) > nowTs) || null,
    [programmes, nowTs]
  );

  // Bring the current programme into view when the schedule first renders.
  useEffect(() => {
    if (!current || !listRef.current) return;
    const el = listRef.current.querySelector('[data-current="1"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [current?.title, dayOffset]);

  if (!channel) {
    return (
      <div className="flex flex-col" style={{ width: '100%', background: C.bgElevated, border: `1px solid ${C.line}`, borderRadius: radius.lg }}>
        <EmptyState icon={CalendarDays} title="Chọn một kênh" description="Lịch phát sóng của kênh sẽ hiện ở đây." />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col"
      style={{
        width: '100%', background: C.bgElevated, border: `1px solid ${C.line}`,
        borderRadius: radius.lg, overflow: 'hidden', minHeight: 320,
      }}
    >
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between" style={{ marginBottom: current ? 10 : 0 }}>
          <div className="flex items-center" style={{ gap: 8, minWidth: 0 }}>
            <CalendarDays size={15} style={{ color: C.blueSoft, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Lịch phát sóng</span>
          </div>
          <div className="flex items-center" style={{ gap: 2 }}>
            <IconButton
              icon={ChevronLeft} label="Ngày trước" size={28} iconSize={15}
              onClick={() => setDayOffset((d) => Math.max(-1, d - 1))}
              style={{ opacity: dayOffset <= -1 ? 0.4 : 1 }}
            />
            <span style={{
              fontSize: 11.5, fontWeight: 700, color: C.textMuted,
              minWidth: 62, textAlign: 'center',
            }}>
              {fmtDay(days[Math.max(0, Math.min(days.length - 1, dayOffset + 1))])}
            </span>
            <IconButton
              icon={ChevronRight} label="Ngày sau" size={28} iconSize={15}
              onClick={() => setDayOffset((d) => Math.min(2, d + 1))}
              style={{ opacity: dayOffset >= 2 ? 0.4 : 1 }}
            />
          </div>
        </div>

        {/* Current programme, emphasised — this is the reference point. */}
        {current && (
          <div style={{ background: 'rgba(47,107,255,.12)', border: `1px solid rgba(47,107,255,.3)`, borderRadius: radius.md, padding: '10px 12px' }}>
            <div className="flex items-center" style={{ gap: 7, marginBottom: 5 }}>
              <LiveDot size={6} />
              <span style={{ fontSize: 10.5, fontWeight: 800, color: C.textMuted, letterSpacing: '.04em' }}>
                ĐANG PHÁT · {fmtTime(toMs(current))} – {fmtTime(toEnd(current))}
              </span>
            </div>
            <p style={{ fontSize: 13, fontWeight: 800, color: C.text, lineHeight: 1.4, marginBottom: 7 }}>
              {current.title || current.name || 'Không có tiêu đề'}
            </p>
            <div style={{ height: 3, borderRadius: radius.pill, background: 'rgba(255,255,255,.14)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', background: C.blue,
                width: `${Math.round(progressOf(current, nowTs) * 100)}%`,
                transition: prefersReducedMotion() ? 'none' : 'width 1s linear',
              }} />
            </div>
          </div>
        )}
      </div>

      {/* Schedule list */}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 8, maxHeight: 'min(48vh, 460px)' }} className="scrollbar-thin">
        {dayList.length === 0 ? (
          <EmptyState
            compact icon={Clock}
            title="Chưa có lịch phát sóng"
            description="Kênh này chưa có dữ liệu EPG cho ngày đã chọn."
          />
        ) : (
          <div className="flex flex-col" style={{ gap: 2 }}>
            {dayList.map((p, i) => {
              const isNow = current && p === current;
              const isPast = toEnd(p) <= nowTs;
              return (
                <div
                  key={`${toMs(p)}-${i}`}
                  data-current={isNow ? '1' : undefined}
                  className="flex items-start"
                  style={{
                    gap: 10, padding: '9px 10px', borderRadius: radius.sm,
                    background: isNow ? 'rgba(47,107,255,.1)' : 'transparent',
                    opacity: isPast && !isNow ? 0.5 : 1,
                    borderLeft: isNow ? `2px solid ${C.blue}` : '2px solid transparent',
                  }}
                >
                  <span style={{
                    fontSize: 11.5, fontWeight: 800, color: isNow ? C.blueSoft : C.textMuted,
                    minWidth: 42, paddingTop: 1, fontVariantNumeric: 'tabular-nums',
                  }}>
                    {fmtTime(toMs(p))}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 12.5, fontWeight: isNow ? 800 : 600, color: isNow ? C.text : C.textMuted,
                      lineHeight: 1.4,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {p.title || p.name || 'Không có tiêu đề'}
                    </p>
                    <p style={{ fontSize: 10.5, color: C.textFaint, marginTop: 3 }}>
                      {fmtDuration(p)}
                      {isPast && canCatchup ? ' · xem lại được' : ''}
                    </p>
                  </div>
                  {/* Catch-up is only offered when the source actually supports it. */}
                  {isPast && canCatchup && onPlayCatchup && (
                    <button
                      type="button"
                      onClick={() => onPlayCatchup(channel, p)}
                      style={{
                        alignSelf: 'center', flexShrink: 0, padding: '4px 9px',
                        borderRadius: radius.sm, background: 'rgba(255,255,255,.08)',
                        border: `1px solid ${C.line}`, color: C.text,
                        fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      Xem lại
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Channel card
// ---------------------------------------------------------------------------
function ChannelTile({ channel, active, favourite, onOpen, onToggleFavourite, compact }) {
  const [hover, setHover] = useState(false);
  const [imgOk, setImgOk] = useState(true);

  if (compact) {
    return (
      <button
        type="button" onClick={() => onOpen(channel)}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        className="flex items-center text-left w-full"
        style={{
          gap: 11, padding: '8px 10px', borderRadius: radius.md,
          background: active ? 'rgba(47,107,255,.14)' : hover ? 'rgba(255,255,255,.05)' : 'transparent',
          border: 'none', cursor: 'pointer',
          transition: prefersReducedMotion() ? 'none' : 'background 140ms ease',
        }}
      >
        <span className="flex items-center justify-center shrink-0" style={{
          width: 40, height: 40, borderRadius: radius.sm, overflow: 'hidden',
          background: 'rgba(255,255,255,.05)', padding: 3,
        }}>
          {channel.logo && imgOk
            ? <img src={channel.logo} alt="" loading="lazy" onError={() => setImgOk(false)}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            : <Tv size={16} style={{ color: C.textFaint }} />}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 12.5, fontWeight: active ? 800 : 600, color: active ? '#fff' : C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {channel.name}
          </span>
          <span style={{ display: 'block', fontSize: 10.5, color: C.textMuted, marginTop: 1 }}>
            {channel.group_title}
          </span>
        </span>
        {favourite && <Heart size={12} fill={C.red} strokeWidth={0} style={{ flexShrink: 0 }} />}
      </button>
    );
  }

  return (
    <button
      type="button" onClick={() => onOpen(channel)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="relative flex flex-col"
      style={{
        padding: 12, gap: 9, textAlign: 'left',
        borderRadius: radius.lg,
        background: active ? 'rgba(47,107,255,.12)' : C.card,
        border: `1px solid ${active ? 'rgba(47,107,255,.4)' : hover ? C.lineStrong : C.line}`,
        cursor: 'pointer',
        transform: hover ? 'translateY(-3px)' : 'none',
        boxShadow: hover ? shadow.cardHover : 'none',
        transition: prefersReducedMotion() ? 'none' : motion.t(motion.fast, motion.easeOut),
      }}
    >
      {active && (
        <span style={{ position: 'absolute', top: 9, right: 9 }}>
          <Badge tone="red"><LiveDot showLabel={false} size={6} />ĐANG XEM</Badge>
        </span>
      )}
      <span className="flex items-center justify-center" style={{
        height: 62, borderRadius: radius.md, background: 'rgba(255,255,255,.05)', padding: 8,
      }}>
        {channel.logo && imgOk
          ? <img src={channel.logo} alt="" loading="lazy" onError={() => setImgOk(false)}
              style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
          : <Tv size={22} style={{ color: C.textFaint }} />}
      </span>
      <span>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: C.text, lineHeight: 1.35,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {channel.name}
        </span>
        <span style={{ display: 'block', fontSize: 10.5, color: C.textMuted, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {channel.group_title}
        </span>
      </span>
      {onToggleFavourite && (
        <span
          role="button" tabIndex={0} aria-label={favourite ? 'Bỏ yêu thích' : 'Thêm yêu thích'}
          onClick={(e) => { e.stopPropagation(); onToggleFavourite(channel); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onToggleFavourite(channel); } }}
          style={{
            position: 'absolute', bottom: 10, right: 10, width: 26, height: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', background: 'rgba(0,0,0,.5)', cursor: 'pointer',
          }}
        >
          <Heart size={13} fill={favourite ? C.red : 'none'} strokeWidth={favourite ? 0 : 2.2}
            style={{ color: favourite ? C.red : C.textMuted }} />
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function PlayzTVPage({
  channels = [],
  epgData,
  tvChannel,
  tvStreamUrl,
  tvLoading,
  onOpenTvChannel,
  onPlayCatchup,
  onToggleFavorite,
  favorites = [],
  onNextTv,
  onPrevTv,
  onCloseTv,
  userName,
  getEpgForChannel,
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL);
  const [favOnly, setFavOnly] = useState(false);
  const [view, setView] = useState('grid');
  const [retryKey, setRetryKey] = useState(0);

  const favSet = useMemo(() => new Set(favorites || []), [favorites]);

  // Categories come from the data — never a hardcoded list.
  const categories = useMemo(() => {
    const counts = new Map();
    for (const c of channels) {
      const g = c.group_title || 'Khác';
      counts.set(g, (counts.get(g) || 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
    return [ALL, ...(favorites.length ? [FAVOURITES] : []), ...sorted];
  }, [channels, favorites.length]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return channels.filter((c) => {
      if (favOnly && !favSet.has(c.channel_id)) return false;
      if (category === FAVOURITES && !favSet.has(c.channel_id)) return false;
      if (category !== ALL && category !== FAVOURITES && (c.group_title || 'Khác') !== category) return false;
      if (q && !String(c.name || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [channels, query, category, favOnly, favSet]);

  const epgForChannel = useMemo(
    () => (getEpgForChannel && tvChannel ? getEpgForChannel(tvChannel.channel_id) : { now: null, next: null }),
    [getEpgForChannel, tvChannel]
  );

  const channelProgrammes = useMemo(() => {
    if (!tvChannel || !epgData) return [];
    const all = epgData.programmes || [];
    return all.filter((p) => p.channel === tvChannel.channel_id || p.channel_id === tvChannel.channel_id);
  }, [epgData, tvChannel]);

  // Catch-up is a property of the source, not a UI preference.
  const canCatchup = !!(tvChannel && (tvChannel.catchup_type || Number(tvChannel.catchup_days) > 0));

  const now = epgForChannel.now;
  const next = epgForChannel.next;

  return (
    <div style={{ padding: '0 clamp(14px,2.6vw,40px) 40px', maxWidth: 1680, margin: '0 auto' }}>
      {/* ── Player + EPG ─────────────────────────────────────────────────── */}
      <div className="playz-split playz-split--aside" style={{ gap: 16, marginTop: 14 }}>
        <div className="playz-aside">
          <div style={{
            position: 'relative', width: '100%', aspectRatio: '16 / 9',
            background: '#000', borderRadius: radius.lg, overflow: 'hidden',
            border: `1px solid ${C.line}`, boxShadow: shadow.card,
          }}>
            {tvChannel && tvStreamUrl && !tvLoading ? (
              <SimpleHlsPlayer
                key={`${tvChannel.channel_id}-${retryKey}-${tvStreamUrl}`}
                streamUrl={tvStreamUrl}
                channel={tvChannel}
                onRetry={() => setRetryKey((k) => k + 1)}
              />
            ) : tvLoading ? (
              <div className="flex flex-col items-center justify-center" style={{ height: '100%', gap: 14 }}>
                <RefreshCw size={26} style={{ color: C.blueSoft, animation: prefersReducedMotion() ? 'none' : 'playzSpin 1s linear infinite' }} />
                <p style={{ fontSize: 13, color: C.textMuted }}>Đang kết nối kênh…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center" style={{ height: '100%' }}>
                <EmptyState
                  icon={Tv}
                  title="Chọn một kênh để bắt đầu xem"
                  description="Chọn kênh ở danh sách bên dưới. Lịch phát sóng và chương trình đang chiếu sẽ hiện ngay bên cạnh."
                />
              </div>
            )}
          </div>

          {/* Now / next strip — the player's own identity line. */}
          {tvChannel && (
            <div
              className="flex items-center flex-wrap"
              style={{ gap: 12, marginTop: 12, padding: '11px 14px', background: C.card, border: `1px solid ${C.line}`, borderRadius: radius.md }}
            >
              {tvChannel.logo && (
                <img src={tvChannel.logo} alt="" style={{ height: 30, width: 'auto', maxWidth: 64, objectFit: 'contain', flexShrink: 0 }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              )}
              <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                <div className="flex items-center" style={{ gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{tvChannel.name}</span>
                  <Badge tone="neutral">{tvChannel.group_title || 'Khác'}</Badge>
                </div>
                {now && (
                  <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ color: C.blueSoft, fontWeight: 700 }}>Đang chiếu:</span> {now.title || now.name}
                    {next ? ` · Tiếp theo: ${next.title || next.name} (${fmtTime(toMs(next))})` : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center" style={{ gap: 6, marginLeft: 'auto' }}>
                {onPrevTv && <Button variant="subtle" size="sm" onClick={onPrevTv}>Kênh trước</Button>}
                {onNextTv && <Button variant="subtle" size="sm" onClick={onNextTv}>Kênh sau</Button>}
                {onToggleFavorite && (
                  <IconButton
                    icon={Heart} label={favSet.has(tvChannel.channel_id) ? 'Bỏ yêu thích' : 'Thêm yêu thích'}
                    size={34} iconSize={15}
                    onClick={() => onToggleFavorite(tvChannel)}
                    style={{ color: favSet.has(tvChannel.channel_id) ? C.red : C.textMuted }}
                  />
                )}
                {onCloseTv && <IconButton icon={X} label="Đóng kênh" size={34} iconSize={15} onClick={onCloseTv} />}
              </div>
            </div>
          )}
        </div>

        {/* EPG — beside the player on desktop, below it on mobile. */}
        <div className="playz-aside">
          <EpgPanel
            channel={tvChannel}
            programmes={channelProgrammes}
            onPlayCatchup={onPlayCatchup}
            canCatchup={canCatchup}
          />
        </div>
      </div>

      {/* ── Channel browser ─────────────────────────────────────────────── */}
      <div style={{ marginTop: 26 }}>
        <div className="flex items-center flex-wrap" style={{ gap: 10, marginBottom: 14 }}>
          <div className="flex items-center" style={{ gap: 9 }}>
            <Radio size={17} style={{ color: C.blueSoft }} />
            <h2 style={{ fontSize: 16.5, fontWeight: 800, color: C.text }}>
              Danh sách kênh
              <span style={{ fontSize: 12.5, fontWeight: 600, color: C.textMuted, marginLeft: 8 }}>
                {visible.length}/{channels.length}
              </span>
            </h2>
          </div>

          <div className="flex items-center" style={{ marginLeft: 'auto', gap: 8 }}>
            <div className="flex items-center" style={{
              height: 34, padding: '0 11px', gap: 8, borderRadius: radius.md,
              background: 'rgba(255,255,255,.06)', border: `1px solid ${C.line}`, minWidth: 180,
            }}>
              <Search size={15} style={{ color: C.textMuted, flexShrink: 0 }} />
              <input
                value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm kênh…" aria-label="Tìm kênh"
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: C.text, fontSize: 12.5 }}
              />
              {query && (
                <button type="button" aria-label="Xoá tìm kiếm" onClick={() => setQuery('')}
                  style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 0, display: 'flex' }}>
                  <X size={13} strokeWidth={2.6} />
                </button>
              )}
            </div>

            <IconButton
              icon={Heart} label="Chỉ kênh yêu thích" size={34} iconSize={15}
              active={favOnly} onClick={() => setFavOnly((v) => !v)}
              style={{ color: favOnly ? C.red : C.textMuted }}
            />
            <IconButton
              icon={view === 'grid' ? List : LayoutGrid}
              label={view === 'grid' ? 'Xem dạng danh sách' : 'Xem dạng lưới'}
              size={34} iconSize={15}
              onClick={() => setView((v) => (v === 'grid' ? 'list' : 'grid'))}
            />
          </div>
        </div>

        {/* Category chips — derived from real group titles */}
        <div className="scrollbar-none flex items-center" style={{ gap: 7, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
          {categories.map((cat) => (
            <Chip
              key={cat} size="sm" active={category === cat}
              onClick={() => { setCategory(cat); if (cat !== FAVOURITES) setFavOnly(false); }}
              icon={cat === ALL ? Tv : cat === FAVOURITES ? Heart : undefined}
            >
              {cat}
            </Chip>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Không tìm thấy kênh nào"
            description="Thử từ khoá khác, hoặc bỏ lọc danh mục và yêu thích."
            action={<Button variant="subtle" size="sm" onClick={() => { setQuery(''); setCategory(ALL); setFavOnly(false); }}>Xoá bộ lọc</Button>}
          />
        ) : view === 'grid' ? (
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(158px, 1fr))', gap: 12 }}
          >
            {visible.map((ch) => (
              <ChannelTile
                key={ch.channel_id} channel={ch}
                active={tvChannel?.channel_id === ch.channel_id}
                favourite={favSet.has(ch.channel_id)}
                onOpen={onOpenTvChannel} onToggleFavourite={onToggleFavorite}
              />
            ))}
          </div>
        ) : (
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 4 }}
          >
            {visible.map((ch) => (
              <ChannelTile
                key={ch.channel_id} channel={ch} compact
                active={tvChannel?.channel_id === ch.channel_id}
                favourite={favSet.has(ch.channel_id)}
                onOpen={onOpenTvChannel} onToggleFavourite={onToggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * playZ — home
 * ============================================================================
 * Cinematic hero followed by rails.
 *
 * The section list is data, not markup, so an administrator can reorder,
 * rename, disable or reschedule any rail without a code change (see
 * `DEFAULT_SECTIONS` and the override read from `playz_home_sections`).
 *
 * Data comes from the existing CHRTV integrations — the TMDB service and the
 * channel list — rather than a new backend. Rails render skeletons while
 * loading and a real empty/error state instead of a blank box.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Flame, Clapperboard, Tv, Trophy, PlaySquare, History, Sparkles } from 'lucide-react';
import { color as C, radius } from './tokens';
import { EmptyState, Button } from './ui';
import Hero from './Hero';
import Rail, { Top10Rail } from './Rail';
import {
  getTrending, getNowPlaying, getPopularTV, getMonthlyTop, getTopRated, imgPath, bgPath,
} from '../services/tmdb';
import { getMovieHistory } from '../services/movieList';

// ---------------------------------------------------------------------------
// Section registry.
// Each entry describes one rail. `source` is a key into the loaded data map.
// The administrator-facing override is stored as an ordered list of ids.
// ---------------------------------------------------------------------------
export const DEFAULT_SECTIONS = [
  { id: 'continue', title: 'Xem tiếp', subtitle: 'Tiếp tục từ nơi bạn dừng lại', source: 'continue', icon: History, ratio: 16 / 9, cardWidth: 260, enabled: true, authOnly: true },
  { id: 'trending', title: 'Đang thịnh hành', subtitle: 'Xu hướng hôm nay', source: 'trending', icon: Flame, action: 'movies', enabled: true },
  { id: 'top10', title: 'Top 10 tháng này', subtitle: 'Xếp hạng theo mức độ quan tâm', source: 'top10', top10: true, action: 'movies', enabled: true },
  { id: 'nowplaying', title: 'Đang chiếu rạp', subtitle: 'Phim mới ngoài rạp', source: 'nowPlaying', icon: Clapperboard, action: 'movies', enabled: true },
  { id: 'live', title: 'Truyền hình trực tiếp', subtitle: 'Kênh đang phát', source: 'channels', icon: Tv, ratio: 16 / 9, cardWidth: 232, action: 'tv', enabled: true },
  { id: 'toprated', title: 'Được đánh giá cao', subtitle: 'Điểm cao từ cộng đồng', source: 'topRated', icon: Sparkles, action: 'movies', enabled: true },
  { id: 'tvshows', title: 'TV Shows', subtitle: 'Series đang được xem nhiều', source: 'tvShows', icon: Tv, action: 'movies', enabled: true },
  { id: 'shorts', title: 'Shorts', subtitle: 'Video ngắn nổi bật', source: 'shorts', icon: PlaySquare, ratio: 9 / 16, cardWidth: 148, action: 'shorts', enabled: true },
  { id: 'sports', title: 'Thể thao', subtitle: 'Trận đấu & giải đấu', source: 'sports', icon: Trophy, action: 'sports', enabled: true },
];

/** Read an admin override from localStorage. Malformed data falls back safely. */
function readSectionOverride() {
  try {
    const raw = localStorage.getItem('playz_home_sections');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch { return null; }
}

export default function Home({
  channels = [], onOpenMovie, onOpenChannel, onNavigate, onRequireLogin,
  user, watchlistVersion, onToggleWatchlist, isInWatchlist,
}) {
  const [data, setData] = useState({
    trending: [], nowPlaying: [], tvShows: [], top10: [], topRated: [], continue: [], chapters: [],
  });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  // --- load ---------------------------------------------------------------
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setFailed(false);
      try {
        // Fire in parallel; a single failing rail must not blank the page.
        const settle = await Promise.allSettled([
          getTrending('week'), getNowPlaying(), getPopularTV(), getMonthlyTop(), getTopRated(),
        ]);
        if (!alive) return;

        const pick = (r) => (r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : []);
        const [trending, nowPlaying, tvShows, top10, topRated] = settle.map(pick);

        if (trending.length === 0 && nowPlaying.length === 0) setFailed(true);

        const decorate = (arr, kind) => arr
          .filter((m) => m && (m.poster_path || m.backdrop_path))
          .map((m) => ({
            ...m,
            __kind: m.__kind || kind,
            __image: imgPath(m.poster_path, 'w342'),
            __backdrop: bgPath(m.backdrop_path || m.poster_path),
            overview: m.overview,
          }));

        setData({
          trending: decorate(trending, 'movie'),
          nowPlaying: decorate(nowPlaying, 'movie'),
          tvShows: decorate(tvShows, 'tv'),
          top10: decorate(top10, 'movie'),
          topRated: decorate(topRated, 'movie'),
          continue: [],
        });
      } catch {
        if (alive) setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [retry]);

  // Continue-watching is local-first, so it never blocks the network rails.
  const continueItems = useMemo(() => {
    try {
      const h = getMovieHistory() || [];
      return h.slice(0, 12).map((m) => ({
        ...m,
        __image: m.poster_path ? imgPath(m.poster_path, 'w342') : m.poster,
        __backdrop: bgPath(m.backdrop_path || m.poster_path),
        __sub: m.progress > 0 ? `Đã xem ${Math.round(m.progress)}%` : undefined,
      }));
    } catch { return []; }
  }, [watchlistVersion, loading]);

  // Channels for the live rail — decorated for the shared card component.
  const channelItems = useMemo(
    () => (channels || []).slice(0, 30).map((ch) => ({
      ...ch,
      __type: 'channel',
      __image: ch.logo,
      __sub: ch.group_title,
    })),
    [channels]
  );

  const heroItems = useMemo(() => {
    const pool = data.trending.length ? data.trending : data.nowPlaying;
    return pool.filter((m) => m.__backdrop).slice(0, 6);
  }, [data]);

  const sources = {
    ...data,
    continue: continueItems,
    channels: channelItems,
    shorts: [],
    sports: [],
  };

  // Section order: admin override first, then registry defaults.
  const sections = useMemo(() => {
    const override = readSectionOverride();
    if (!override) return DEFAULT_SECTIONS.filter((s) => s.enabled);
    const byId = new Map(DEFAULT_SECTIONS.map((s) => [s.id, s]));
    const ordered = override
      .map((o) => {
        const base = byId.get(o.id || o);
        return base ? { ...base, ...(typeof o === 'object' ? o : {}), enabled: o.enabled !== false } : null;
      })
      .filter(Boolean);
    // Append any default section the override omitted, so new rails ship.
    const shown = new Set(ordered.map((s) => s.id));
    return ordered.concat(DEFAULT_SECTIONS.filter((s) => s.enabled && !shown.has(s.id)));
  }, []);

  const handleOpen = (item) => {
    if (item.__type === 'channel' || item.channel_id) onOpenChannel && onOpenChannel(item);
    else {
      if (!user && onRequireLogin) { onRequireLogin(); return; }
      onOpenMovie && onOpenMovie(item);
    }
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      <Hero
        items={heroItems}
        loading={loading && heroItems.length === 0}
        onPlay={handleOpen}
        onOpenDetail={(m) => { if (!user && onRequireLogin) return onRequireLogin(); onOpenMovie && onOpenMovie(m); }}
        onToggleWatchlist={onToggleWatchlist}
        isInWatchlist={isInWatchlist}
      />

      <div style={{ padding: '0 clamp(16px,3.2vw,48px)', marginTop: 30, maxWidth: 1680, margin: '30px auto 0' }}>
        {failed && (
          <div style={{ marginBottom: 24, background: C.card, border: `1px solid ${C.line}`, borderRadius: radius.lg }}>
            <EmptyState
              icon={Flame}
              tone="warn"
              title="Không tải được kho phim"
              description="Phần phim & TV Shows đang tạm không kết nối được. Truyền hình trực tiếp vẫn xem bình thường."
              action={<Button variant="subtle" size="sm" onClick={() => setRetry((r) => r + 1)}>Thử lại</Button>}
            />
          </div>
        )}

        {sections.map((s) => {
          if (s.authOnly && !user) return null;
          const items = sources[s.source] || [];
          const common = {
            title: s.title, subtitle: s.subtitle, items,
            onOpen: handleOpen,
            onSeeAll: s.action && onNavigate ? () => onNavigate(s.action) : null,
          };
          if (s.top10) {
            return <Top10Rail key={s.id} {...common} loading={loading && items.length === 0} />;
          }
          return (
            <Rail
              key={s.id} {...common}
              ratio={s.ratio || 2 / 3}
              cardWidth={s.cardWidth || 190}
              loading={loading && items.length === 0}
              emptyText={s.source === 'channels' ? 'Đang tải danh sách kênh…' : 'Chưa có nội dung.'}
            />
          );
        })}
      </div>
    </div>
  );
}

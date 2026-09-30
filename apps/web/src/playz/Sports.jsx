/**
 * playZ — Sports
 * ============================================================================
 * This is a re-skin of the legacy SportsScreen, not a rewrite. Everything the
 * old page could do it still does, because the sports screen is the densest and
 * most load-bearing part of the product:
 *
 *   - league chips (LEAGUES), fixtures, results, standings
 *   - the all-sports explorer for anything outside the pinned league list
 *   - the racing section, video clips, match detail and team detail modals
 *   - the strip of newest scores across every league, refreshed on a timer
 *   - channels matched as sports channels, so you can jump straight to a stream
 *
 * What changed is presentation only: OLED surfaces, one accent per meaning, a
 * two-column fixtures/standings layout, and live state shown with a single
 * restrained red pulse instead of the legacy animated gradient badge.
 *
 * Deliberate: nothing here assumes football. The sport list, the explorer, the
 * icons and the score formatting are all driven by the data, so a basketball or
 * motorsport league renders correctly without a code change. Football merely
 * happens to be what most of the pinned leagues are.
 *
 * All data comes from services/sports — no fetch logic lives in this file.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Trophy, CalendarDays, ListOrdered, Clapperboard, Play, Radio, X, ChevronRight,
  RefreshCw, Zap, Globe, Search, Tv,
} from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import {
  LEAGUES, resolveLeagues, fetchLeague, fetchLatestScoresAll, fetchSportsIndex,
  fetchSportsVideos, parseVideoUrl,
} from '../services/sports';
import ScrollRow from '../components/ScrollRow';
import RacingSection from '../components/RacingSection';
import MatchDetailModal from '../components/MatchDetailModal';
import TeamDetailModal from '../components/TeamDetailModal';
import { color as C, radius, motion, prefersReducedMotion } from './tokens';
import { Chip, Badge, LiveDot, EmptyState, Skeleton, IconButton, Modal } from './ui';

// A channel is a sports channel if it says so anywhere in its identity. Kept
// from the legacy screen: the playlist has no dedicated "sports" field, and
// guessing from a curated list would go stale every time the owner edits it.
const SPORT_RE = /sport|thể thao|the thao|espn|bein|k\+|onsport|fpt.*sport|bóng đá|bong da|star sport|golf|tennis|bóng rổ|bong ro|basket|baseball|bóng chày|cầu lông|cau long|badminton|bơi|swim|olympic|esport|e-sport|đua xe|dua xe|racing|boxing|wwe|wimbledon|roland|nba|f1\b/i;

const LIVE_EXCLUDED = ['NS', 'FT', 'AOT', 'POSTPONED', 'CANCELLED', 'CANCELED', 'ABANDONED', ''];

function eventIsLive(ev) {
  const s = String(ev?.strStatus || '').toUpperCase();
  return s !== '' && !LIVE_EXCLUDED.includes(s) && ev?.strPostponed !== 'yes';
}

function eventIsPostponed(ev) {
  return ev?.strPostponed === 'yes' || /postpon|cancel/i.test(String(ev?.strStatus || ''));
}

function tsOf(ev) {
  try {
    const raw = ev?.strTimestamp;
    if (raw) return new Date(/z$/i.test(raw) ? raw : `${raw}Z`).getTime() || 0;
    if (ev?.dateEvent) return new Date(`${ev.dateEvent}T${ev.strTime || '00:00:00'}Z`).getTime() || 0;
  } catch { /* fall through */ }
  return 0;
}

/** Kick-off, in the compact form a schedule needs: day then time. */
function fmtKickoff(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtTimeShort(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

function TeamBadge({ src, name, size = 26 }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <span
        aria-hidden="true"
        style={{
          width: size, height: size, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(255,255,255,.07)', border: `1px solid ${C.line}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: Math.round(size * 0.42), fontWeight: 800, color: C.textMuted,
        }}
      >
        {String(name || '?').slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={src} alt="" loading="lazy" onError={() => setErr(true)}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}

/**
 * Channel logo with a fallback. The playlist carries stale logo URLs often
 * enough that a bare <img> leaves holes in the rail.
 */
function ChannelLogo({ channel }) {
  const [err, setErr] = useState(false);
  if (!channel?.logo || err) {
    return <Tv size={18} style={{ color: C.textFaint }} />;
  }
  return (
    <img
      src={channel.logo} alt="" loading="lazy" onError={() => setErr(true)}
      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
    />
  );
}

// ---------------------------------------------------------------------------
// Match card
// ---------------------------------------------------------------------------
function MatchCard({ ev, showScore, onOpen, onTeam }) {
  const live = eventIsLive(ev);
  const postponed = eventIsPostponed(ev);
  const finished = String(ev.strStatus || '').toUpperCase() === 'FT';
  const [hover, setHover] = useState(false);
  const ts = tsOf(ev);

  const rows = [
    { name: ev.strHomeTeam, id: ev.idHomeTeam, badge: ev.strHomeTeamBadge, score: ev.intHomeScore },
    { name: ev.strAwayTeam, id: ev.idAwayTeam, badge: ev.strAwayTeamBadge, score: ev.intAwayScore },
  ];
  const hs = Number(ev.intHomeScore);
  const as = Number(ev.intAwayScore);
  const decided = showScore && Number.isFinite(hs) && Number.isFinite(as) && hs !== as;

  return (
    <div
      role="button" tabIndex={0}
      onClick={() => onOpen && onOpen(ev)}
      onKeyDown={(e) => { if (e.key === 'Enter' && onOpen) onOpen(ev); }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        padding: 12, borderRadius: radius.md,
        background: hover ? C.cardHover : C.card,
        border: `1px solid ${live ? 'rgba(255,59,71,.34)' : C.line}`,
        cursor: 'pointer',
        transition: prefersReducedMotion() ? 'none' : motion.t(motion.fast, motion.easeOut),
      }}
    >
      {/* status line */}
      <div className="flex items-center" style={{ gap: 8, marginBottom: 9 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: C.textFaint, fontVariantNumeric: 'tabular-nums' }}>
          {fmtKickoff(ts)}
        </span>
        <span style={{ marginLeft: 'auto' }}>
          {live ? (
            <Badge tone="red"><LiveDot showLabel={false} size={6} />{String(ev.strStatus || 'LIVE').toUpperCase()}</Badge>
          ) : postponed ? (
            <Badge tone="neutral">Hoãn</Badge>
          ) : finished ? (
            <Badge tone="neutral">FT</Badge>
          ) : (
            <Badge tone="neutral">{ev.intRound ? `Vòng ${ev.intRound}` : 'Sắp diễn ra'}</Badge>
          )}
        </span>
      </div>

      {/* teams */}
      <div className="flex flex-col" style={{ gap: 7 }}>
        {rows.map((r, i) => (
          <div key={i} className="flex items-center" style={{ gap: 9 }}>
            <TeamBadge src={r.badge} name={r.name} />
            <span
              role={onTeam ? 'link' : undefined}
              onClick={(e) => { if (onTeam) { e.stopPropagation(); onTeam({ name: r.name, id: r.id }); } }}
              style={{
                flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: C.text,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                cursor: onTeam ? 'pointer' : 'default',
              }}
            >
              {r.name || '—'}
            </span>
            {showScore && (
              <span style={{
                fontSize: 14, fontVariantNumeric: 'tabular-nums',
                fontWeight: decided && ((i === 0 && hs > as) || (i === 1 && as > hs)) ? 900 : 700,
                color: decided && ((i === 0 && hs > as) || (i === 1 && as > hs)) ? C.text : C.textMuted,
              }}>
                {r.score === '' || r.score == null ? '-' : r.score}
              </span>
            )}
          </div>
        ))}
      </div>

      {ev.strVenue && (
        <p style={{
          fontSize: 10.5, color: C.textFaint, marginTop: 9,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {ev.strVenue}
        </p>
      )}
    </div>
  );
}

function MatchGrid({ events, showScore, onOpen, onTeam, emptyText }) {
  if (!events || events.length === 0) {
    return <EmptyState compact icon={CalendarDays} title={emptyText || 'Không có dữ liệu'} />;
  }
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(258px, 1fr))', gap: 12 }}>
      {events.map((ev) => (
        <MatchCard key={ev.idEvent} ev={ev} showScore={showScore} onOpen={onOpen} onTeam={onTeam} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------
function Standings({ table }) {
  const { t } = useI18n();
  if (!table || table.length === 0) return null;

  const cols = [
    { key: 'intPlayed', label: t('sports.th_p'), hide: false },
    { key: 'intWin', label: t('sports.th_w'), hide: true },
    { key: 'intDraw', label: t('sports.th_d'), hide: true },
    { key: 'intLoss', label: t('sports.th_l'), hide: true },
  ];

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: radius.lg, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.line}` }} className="flex items-center" >
        <ListOrdered size={15} style={{ color: C.blueSoft, marginRight: 8 }} />
        <h3 style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>{t('sports.table')}</h3>
      </div>
      <div style={{ overflowX: 'auto' }} className="scrollbar-thin">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: C.textFaint }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 800, fontSize: 10.5 }}>{t('sports.th_team')}</th>
              {cols.map((c) => (
                <th
                  key={c.key} className={c.hide ? 'hidden sm:table-cell' : ''}
                  style={{ padding: '8px 6px', fontWeight: 800, fontSize: 10.5, width: 34, textAlign: 'center' }}
                >
                  {c.label}
                </th>
              ))}
              <th style={{ padding: '8px 12px', fontWeight: 800, fontSize: 10.5, width: 40, textAlign: 'right' }}>
                {t('sports.th_pts')}
              </th>
            </tr>
          </thead>
          <tbody>
            {table.map((r, i) => {
              const rank = Number(r.intRank) || i + 1;
              // Top four and the drop zone — the two boundaries anyone actually
              // looks for in a table.
              const marker = rank <= 4 ? C.blue : rank >= table.length - 2 ? C.red : 'transparent';
              return (
                <tr key={r.idTeam || r.strTeam} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td style={{ padding: '8px 12px' }}>
                    <span className="flex items-center" style={{ gap: 9, minWidth: 0 }}>
                      <span style={{ width: 3, height: 18, borderRadius: 2, background: marker, flexShrink: 0 }} />
                      <span style={{ fontSize: 10.5, color: C.textFaint, width: 16, fontVariantNumeric: 'tabular-nums' }}>{rank}</span>
                      <TeamBadge src={r.strTeamBadge} name={r.strTeam} size={20} />
                      <span style={{
                        fontSize: 12, fontWeight: 600, color: C.text,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {r.strTeam}
                      </span>
                    </span>
                  </td>
                  {cols.map((c) => (
                    <td key={c.key} className={c.hide ? 'hidden sm:table-cell' : ''}
                      style={{ padding: '8px 6px', textAlign: 'center', color: C.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                      {r[c.key]}
                    </td>
                  ))}
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                    {r.intPoints}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function PlayzSports({ channels = [], onSelectChannel }) {
  const { t } = useI18n();

  const [leagueId, setLeagueId] = useState(LEAGUES[0]?.id);
  // Leagues on offer: the pinned famous ones, then whatever is actually being
  // played. Resolved rather than hardcoded, so a league nobody pinned still
  // shows up while it has fixtures.
  const [leagueSet, setLeagueSet] = useState({ featured: LEAGUES, recent: [] });
  const [data, setData] = useState({ next: [], past: [], table: [] });
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState([]);
  const [playing, setPlaying] = useState(null);
  const [sportTab, setSportTab] = useState('football'); // football | racing
  const [selMatch, setSelMatch] = useState(null);
  const [selTeam, setSelTeam] = useState(null);
  const [custom, setCustom] = useState(null);        // league picked from the explorer
  const [showExplorer, setShowExplorer] = useState(false);
  const [sportsIdx, setSportsIdx] = useState(null);
  const [explorerSport, setExplorerSport] = useState('');
  const [explorerQuery, setExplorerQuery] = useState('');
  const [latest, setLatest] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [resultView, setResultView] = useState('next'); // next | past
  const refreshRef = useRef(null);

  const league = (custom && custom.id === leagueId)
    ? custom
    : (LEAGUES.find((l) => l.id === leagueId) || LEAGUES[0]);

  // --- fixtures / results / table -----------------------------------------
  const load = useCallback(async (fresh = false) => {
    if (!league) return;
    if (fresh) setRefreshing(true);
    else setLoading(true);
    try {
      const d = await fetchLeague(league, { fresh });
      setData(d && typeof d === 'object' ? { next: d.next || [], past: d.past || [], table: d.table || [] } : { next: [], past: [], table: [] });
      setUpdatedAt(Date.now());
    } catch {
      setData({ next: [], past: [], table: [] });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [league]);

  useEffect(() => { load(false); }, [load]);

  // Auto-refresh while a match is in progress — scores are the whole point of
  // this screen, and a stale scoreline is worse than a slightly busier timer.
  useEffect(() => {
    const id = setInterval(() => {
      const live = (data.next || []).some(eventIsLive);
      if (live) load(true);
    }, 60 * 1000);
    return () => clearInterval(id);
  }, [data.next, load]);

  const onRefresh = () => {
    if (refreshRef.current) clearTimeout(refreshRef.current);
    refreshRef.current = setTimeout(() => load(true), 120);
  };
  useEffect(() => () => { if (refreshRef.current) clearTimeout(refreshRef.current); }, []);

  // --- newest scores across every league ----------------------------------
  const loadLatest = useCallback(async () => {
    try {
      const rows = await fetchLatestScoresAll(10);
      setLatest(Array.isArray(rows) ? rows : []);
    } catch { setLatest([]); }
  }, []);

  useEffect(() => {
    if (sportTab !== 'football') return undefined;
    loadLatest();
    const id = setInterval(loadLatest, 60 * 1000);
    return () => clearInterval(id);
  }, [loadLatest, sportTab]);

  // --- which leagues to show ----------------------------------------------
  useEffect(() => {
    let cancelled = false;
    resolveLeagues()
      .then((r) => { if (!cancelled && r) setLeagueSet({ featured: r.featured || LEAGUES, recent: r.recent || [] }); })
      .catch(() => { if (!cancelled) setLeagueSet({ featured: LEAGUES, recent: [] }); });
    return () => { cancelled = true; };
  }, []);

  // --- clips ---------------------------------------------------------------
  useEffect(() => {
    fetchSportsVideos().then((v) => setVideos(Array.isArray(v) ? v : [])).catch(() => setVideos([]));
  }, []);

  // --- sports index (explorer) --------------------------------------------
  useEffect(() => {
    if (!showExplorer || sportsIdx) return;
    fetchSportsIndex().then((d) => setSportsIdx(d || { sports: [] })).catch(() => setSportsIdx({ sports: [] }));
  }, [showExplorer, sportsIdx]);

  const sportsChannels = useMemo(
    () => (channels || []).filter((ch) => SPORT_RE.test(`${ch.channel_id || ''} ${ch.name || ''} ${ch.group_title || ''}`)),
    [channels]
  );

  const liveNow = useMemo(() => (data.next || []).filter(eventIsLive), [data.next]);

  const explorerSports = useMemo(() => (sportsIdx?.sports || []), [sportsIdx]);
  const explorerLeagues = useMemo(() => {
    if (!explorerSport) return [];
    const sport = explorerSports.find((s) => s.name === explorerSport);
    const list = sport?.leagues || [];
    const q = explorerQuery.trim().toLowerCase();
    return q ? list.filter((l) => `${l.name} ${l.country}`.toLowerCase().includes(q)) : list;
  }, [explorerSports, explorerSport, explorerQuery]);

  const pickExplorerLeague = (l) => {
    setCustom({ id: `tsdb_${l.tsdb}`, name: l.name, short: l.name, tsdb: l.tsdb, logo: l.badge, country: l.country });
    setLeagueId(`tsdb_${l.tsdb}`);
    setShowExplorer(false);
    setSportTab('football');
  };

  const tabs = [
    { id: 'football', label: t('sports.football'), icon: Trophy },
    { id: 'racing', label: t('sports.racing'), icon: Zap },
    { id: 'more', label: t('sports.more'), icon: Globe },
  ];

  return (
    <div style={{ padding: '0 clamp(14px,2.6vw,40px) 40px', maxWidth: 1680, margin: '0 auto' }}>
      {/* ── Head ───────────────────────────────────────────────────────── */}
      <div className="flex items-center flex-wrap" style={{ gap: 12, marginTop: 16, marginBottom: 16 }}>
        <div className="flex items-center" style={{ gap: 10 }}>
          <Trophy size={21} style={{ color: C.blueSoft }} />
          <h1 style={{ fontSize: 21, fontWeight: 900, color: C.text, letterSpacing: '-.01em' }}>{t('sports.title')}</h1>
          {liveNow.length > 0 && (
            <Badge tone="red"><LiveDot showLabel={false} size={6} />{liveNow.length} trực tiếp</Badge>
          )}
        </div>
        <div className="flex items-center" style={{ marginLeft: 'auto', gap: 8 }}>
          {updatedAt > 0 && (
            <span style={{ fontSize: 11, color: C.textFaint, fontVariantNumeric: 'tabular-nums' }}>
              {t('sports.auto')} · {fmtTimeShort(updatedAt)}
            </span>
          )}
          <IconButton
            icon={RefreshCw} label={t('sports.refresh')} size={34} iconSize={15}
            active={refreshing} onClick={onRefresh}
            style={{ color: refreshing ? C.blueSoft : C.textMuted }}
          />
        </div>
      </div>

      {/* ── Sports tabs ────────────────────────────────────────────────── */}
      <div className="flex items-center" style={{ gap: 7, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <Chip
            key={id} size="sm" icon={Icon}
            active={id === 'more' ? showExplorer : (!showExplorer && sportTab === id)}
            onClick={() => {
              if (id === 'more') { setShowExplorer(true); return; }
              setShowExplorer(false);
              setSportTab(id);
            }}
          >
            {label}
          </Chip>
        ))}
      </div>

      {showExplorer ? (
        /* ── Explorer: every sport TheSportsDB knows about ───────────── */
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: radius.lg, padding: 16 }}>
          <div className="flex items-center flex-wrap" style={{ gap: 10, marginBottom: 14 }}>
            <Globe size={16} style={{ color: C.blueSoft }} />
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{t('sports.more_title')}</h2>
            <span style={{ fontSize: 11.5, color: C.textMuted }}>{t('sports.more_hint')}</span>
            <div className="flex items-center" style={{
              marginLeft: 'auto', height: 32, padding: '0 10px', gap: 7,
              borderRadius: radius.md, background: 'rgba(255,255,255,.06)', border: `1px solid ${C.line}`,
            }}>
              <Search size={14} style={{ color: C.textMuted }} />
              <input
                value={explorerQuery} onChange={(e) => setExplorerQuery(e.target.value)}
                placeholder="Tìm giải đấu…" aria-label="Tìm giải đấu"
                style={{ width: 165, background: 'transparent', border: 'none', outline: 'none', color: C.text, fontSize: 12 }}
              />
            </div>
            <IconButton icon={X} label="Đóng" size={32} iconSize={15} onClick={() => setShowExplorer(false)} />
          </div>

          {!sportsIdx ? (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} h={42} r={radius.md} />)}
            </div>
          ) : (
            <>
              <div className="flex items-center" style={{ gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
                {explorerSports.map((s) => (
                  <Chip
                    key={s.name} size="sm"
                    active={explorerSport === s.name}
                    onClick={() => setExplorerSport(explorerSport === s.name ? '' : s.name)}
                  >
                    <span style={{ marginRight: 5 }}>{s.icon}</span>
                    {s.name}
                    <span style={{ color: C.textFaint, marginLeft: 5 }}>{s.count}</span>
                  </Chip>
                ))}
              </div>

              {explorerSport ? (
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))', gap: 10 }}>
                  {explorerLeagues.map((l) => (
                    <button
                      key={l.tsdb} type="button" onClick={() => pickExplorerLeague(l)}
                      className="flex items-center text-left" style={{
                        gap: 10, padding: '10px 12px', borderRadius: radius.md,
                        background: C.cardHover, border: `1px solid ${C.line}`, cursor: 'pointer',
                      }}
                    >
                      <TeamBadge src={l.badge} name={l.name} size={24} />
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {l.name}
                        </span>
                        {l.country && <span style={{ display: 'block', fontSize: 10.5, color: C.textMuted }}>{l.country}</span>}
                      </span>
                      <ChevronRight size={14} style={{ color: C.textFaint, flexShrink: 0 }} />
                    </button>
                  ))}
                  {explorerLeagues.length === 0 && (
                    <p style={{ fontSize: 12, color: C.textMuted, gridColumn: '1/-1' }}>{t('sports.no_data')}</p>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 12.5, color: C.textMuted }}>Chọn một môn để xem danh sách giải đấu.</p>
              )}
            </>
          )}
        </div>
      ) : sportTab === 'racing' ? (
        <RacingSection />
      ) : (
        <>
          {/* ── Latest scores strip ────────────────────────────────────── */}
          {latest.length > 0 && (
            <section style={{ marginBottom: 22 }}>
              <div className="flex items-center" style={{ gap: 8, marginBottom: 10 }}>
                <Radio size={15} style={{ color: C.red }} />
                <h2 style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Tỉ số mới nhất</h2>
              </div>
              <div className="scrollbar-none flex" style={{ gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                {latest.map(({ ev, league: lg, live }) => (
                  <button
                    key={ev.idEvent} type="button" onClick={() => setSelMatch(ev)}
                    style={{
                      flexShrink: 0, width: 232, textAlign: 'left', cursor: 'pointer',
                      padding: 11, borderRadius: radius.md,
                      background: C.card,
                      border: `1px solid ${live ? 'rgba(255,59,71,.34)' : C.line}`,
                    }}
                  >
                    <div className="flex items-center" style={{ gap: 7, marginBottom: 7 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: C.textFaint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {lg?.short || lg?.name}
                      </span>
                      <span style={{ marginLeft: 'auto', flexShrink: 0 }}>
                        {live ? <LiveDot size={6} label={String(ev.strStatus || 'LIVE').toUpperCase()} /> : <span style={{ fontSize: 9.5, fontWeight: 800, color: C.textFaint }}>FT</span>}
                      </span>
                    </div>
                    {[[ev.strHomeTeam, ev.intHomeScore], [ev.strAwayTeam, ev.intAwayScore]].map(([n, s], i) => (
                      <div key={i} className="flex items-center" style={{ gap: 8, marginTop: i ? 4 : 0 }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{s === '' || s == null ? '-' : s}</span>
                      </div>
                    ))}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── League chips ───────────────────────────────────────────── */}
          <div className="scrollbar-none flex items-center" style={{ gap: 7, overflowX: 'auto', paddingBottom: 4, marginBottom: 18 }}>
            {custom && (
              <Chip size="sm" active={leagueId === custom.id} onClick={() => setLeagueId(custom.id)}>
                <span style={{ marginRight: 5 }}>🌍</span>{custom.name}
              </Chip>
            )}
            {leagueSet.featured.map((l) => (
              <Chip key={l.id} size="sm" active={leagueId === l.id} onClick={() => { setCustom(null); setLeagueId(l.id); }}>
                <span style={{ marginRight: 5 }}>{l.flag}</span>{l.short}
              </Chip>
            ))}

            {/* Discovered from the schedule — a league appears here while it has
                matches on, and drops off when the season ends. No curation. */}
            {leagueSet.recent.length > 0 && (
              <span aria-hidden="true" style={{ width: 1, height: 20, background: C.line, flexShrink: 0, margin: '0 3px' }} />
            )}
            {leagueSet.recent.map((l) => (
              <Chip
                key={l.id} size="sm"
                active={leagueId === l.id}
                onClick={() => { setCustom(l); setLeagueId(l.id); }}
              >
                {l.live && <LiveDot showLabel={false} size={5} />}
                <span style={{ marginLeft: l.live ? 6 : 0 }}>{l.short}</span>
                {l.matches > 2 && <span style={{ color: C.textFaint, marginLeft: 6 }}>{l.matches}</span>}
              </Chip>
            ))}
          </div>

          {/* ── League header ──────────────────────────────────────────── */}
          <div className="flex items-center flex-wrap" style={{ gap: 10, marginBottom: 16 }}>
            {league?.logo && <TeamBadge src={league.logo} name={league.name} size={32} />}
            <h2 style={{ fontSize: 17, fontWeight: 900, color: C.text }}>{league?.name}</h2>
            {loading && <RefreshCw size={14} style={{ color: C.textMuted, animation: prefersReducedMotion() ? 'none' : 'playzSpin 1s linear infinite' }} />}
          </div>

          {loading ? (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(258px, 1fr))', gap: 12, marginBottom: 26 }}>
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={104} r={radius.md} />)}
            </div>
          ) : (
            <div
              className={`playz-split ${data.table?.length ? 'playz-split--aside' : ''}`}
              style={{ gap: 18, marginBottom: 28 }}
            >
              {/* Fixtures / results */}
              <div>
                <div className="flex items-center" style={{ gap: 8, marginBottom: 12 }}>
                  <Chip size="sm" active={resultView === 'next'} onClick={() => setResultView('next')}>
                    {t('sports.fixtures')} {data.next?.length ? `(${data.next.length})` : ''}
                  </Chip>
                  <Chip size="sm" active={resultView === 'past'} onClick={() => setResultView('past')}>
                    {t('sports.results')} {data.past?.length ? `(${data.past.length})` : ''}
                  </Chip>
                  <span className="hidden sm:inline" style={{ fontSize: 11, color: C.textFaint, marginLeft: 4 }}>{t('sports.window')}</span>
                </div>
                <MatchGrid
                  events={resultView === 'next' ? data.next : data.past}
                  showScore={resultView === 'past'}
                  onOpen={setSelMatch}
                  onTeam={setSelTeam}
                  emptyText={t('sports.no_data')}
                />
              </div>

              {/* Standings */}
              {data.table?.length ? (
                <div className="lg:sticky" style={{ top: 84 }}>
                  <Standings table={data.table} />
                </div>
              ) : null}
            </div>
          )}
        </>
      )}

      {/* ── Sports channels ────────────────────────────────────────────── */}
      {sportsChannels.length > 0 && (
        <section style={{ marginTop: 8, marginBottom: 30 }}>
          <div className="flex items-center" style={{ gap: 8, marginBottom: 12 }}>
            <Radio size={16} style={{ color: C.blueSoft }} />
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{t('sports.channels')}</h2>
            <span style={{ fontSize: 11.5, color: C.textMuted }}>{sportsChannels.length}</span>
          </div>
          {/* ScrollRow carries the left/right paddles and the D-pad focusable
              buttons, which matters on TV remotes. */}
          <ScrollRow>
            {sportsChannels.map((ch) => (
              <button
                key={ch.channel_id} type="button"
                onClick={() => onSelectChannel && onSelectChannel(ch)}
                style={{
                  flexShrink: 0, width: 148, textAlign: 'left', cursor: 'pointer',
                  padding: 10, borderRadius: radius.md,
                  background: C.card, border: `1px solid ${C.line}`,
                }}
              >
                <span className="flex items-center justify-center" style={{
                  height: 58, borderRadius: radius.sm, background: 'rgba(255,255,255,.05)', padding: 7, marginBottom: 8,
                }}>
                  <ChannelLogo channel={ch} />
                </span>
                <span style={{
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  fontSize: 12, fontWeight: 700, color: C.text, lineHeight: 1.35,
                }}>
                  {ch.name}
                </span>
                {ch.group_title && (
                  <span style={{ display: 'block', fontSize: 10, color: C.textMuted, marginTop: 3 }}>{ch.group_title}</span>
                )}
              </button>
            ))}
          </ScrollRow>
        </section>
      )}

      {/* ── Clips ──────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 30 }}>
        <div className="flex items-center" style={{ gap: 8, marginBottom: 12 }}>
          <Clapperboard size={16} style={{ color: C.blueSoft }} />
          <h2 style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{t('sports.videos')}</h2>
        </div>
        {videos.length === 0 ? (
          <EmptyState compact icon={Clapperboard} title={t('sports.no_videos')} />
        ) : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(212px, 1fr))', gap: 12 }}>
            {videos.map((v) => (
              <button
                key={v.idVideo} type="button" onClick={() => setPlaying(v)}
                style={{ textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <span style={{
                  display: 'block', position: 'relative', width: '100%', aspectRatio: '16 / 9',
                  borderRadius: radius.md, overflow: 'hidden', background: C.card, border: `1px solid ${C.line}`,
                }}>
                  {v.strThumb && (
                    <img src={v.strThumb} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                  <span style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,.18)',
                  }}>
                    <span style={{
                      width: 38, height: 38, borderRadius: '50%',
                      background: 'rgba(8,8,10,.72)', border: '1px solid rgba(255,255,255,.24)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Play size={16} fill="#fff" strokeWidth={0} style={{ marginLeft: 2 }} />
                    </span>
                  </span>
                  {v.strDuration && (
                    <span style={{
                      position: 'absolute', bottom: 7, right: 7, padding: '2px 6px',
                      borderRadius: radius.xs, background: 'rgba(8,8,10,.82)',
                      fontSize: 10, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums',
                    }}>
                      {v.strDuration}
                    </span>
                  )}
                </span>
                <span style={{
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  fontSize: 12.5, fontWeight: 700, color: C.text, lineHeight: 1.4, marginTop: 8,
                }}>
                  {v.strTitle}
                </span>
                {v.strLeague && (
                  <span style={{ display: 'block', fontSize: 10.5, color: C.textMuted, marginTop: 3 }}>{v.strLeague}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Modals (kept from the legacy screen) ───────────────────────── */}
      {playing && (
        <Modal open onClose={() => setPlaying(null)} title={playing.strTitle} width={880}>
          <div style={{ aspectRatio: '16 / 9', background: '#000', borderRadius: radius.md, overflow: 'hidden' }}>
            {(() => {
              const parsed = parseVideoUrl(playing.strVideo);
              if (parsed?.type === 'iframe' || parsed?.embed) {
                return (
                  <iframe
                    src={parsed.embed || parsed.url} title={playing.strTitle}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                    allowFullScreen style={{ width: '100%', height: '100%', border: 0 }}
                  />
                );
              }
              if (parsed?.url) {
                return <video src={parsed.url} controls autoPlay style={{ width: '100%', height: '100%' }} />;
              }
              return <EmptyState icon={Clapperboard} title="Không phát được clip này" description={playing.strVideo} />;
            })()}
          </div>
        </Modal>
      )}

      {selMatch && (
        <MatchDetailModal
          ev={selMatch}
          leagueName={!showExplorer && sportTab === 'football' ? league?.name : ''}
          onClose={() => setSelMatch(null)}
          onTeam={setSelTeam}
        />
      )}

      {selTeam && (
        <TeamDetailModal team={selTeam} onClose={() => setSelTeam(null)} />
      )}
    </div>
  );
}

#!/usr/bin/env node
/**
 * playZ — local fixture API (development only)
 * ============================================================================
 *   node tools/dev-api.mjs              # listens on 127.0.0.1:8788
 *
 * Runs the handful of endpoints the app needs so the interface can be reviewed
 * and developed without a live Cloudflare Worker or internet access:
 *
 *   GET /api/playlist       real channels, parsed from playlists/tv.m3u
 *   GET /api/epg            schedule generated for those channels
 *   GET /api/notifications  empty set (the header shows its real empty state)
 *   GET /api/movie/sources  empty set (cards fall back to detail view)
 *   GET /api/tmdb?path=…    catalogue in TMDB response shape
 *   GET /img/<size>/<id>    generated poster/backdrop artwork
 *
 * NOT PRODUCT CODE
 * ----------------
 * This file is a development tool. It is never deployed, never imported by the
 * app, and generates its own abstract artwork rather than using any third-party
 * image. Real deployments talk to the Worker and to TMDB's CDN.
 *
 * Artwork is generated on demand and memoised in memory, so there are no large
 * fixture files on disk.
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSports } from './sports-fixture.mjs';
import { createCommunity } from './community-fixture.mjs';
import { createAdmin } from './admin-fixture.mjs';
import { createShorts } from './shorts-fixture.mjs';
import { Resvg } from '@resvg/resvg-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.FIXTURE_PORT || 8788);
const HOST = process.env.FIXTURE_HOST || '0.0.0.0';

// ============================================================================
// Artwork — deterministic abstract gradients
// ============================================================================
const PALETTES = [
  ['#0B1E4B', '#2F6BFF', '#7FB0FF'],
  ['#2A1206', '#FF6B2C', '#FFB08A'],
  ['#1A1030', '#7C4DFF', '#C4A8FF'],
  ['#04231C', '#12B886', '#7BE0BF'],
  ['#2B0713', '#FF3B47', '#FF9AA2'],
  ['#1E1A03', '#FFC53D', '#FFE79A'],
  ['#041B2B', '#0EA5E9', '#8BD8F5'],
  ['#241018', '#E05299', '#F5A3C7'],
  ['#101418', '#8A8A99', '#D6D6DE'],
  ['#0A2010', '#3FA34D', '#9BE0A3'],
];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// The app requests named sizes; map them to real pixel widths.
const sports = createSports(hash);
const community = createCommunity();

const SIZE_W = { w92: 92, w154: 154, w185: 185, w300: 300, w342: 342, w500: 500, w780: 780, w1280: 1280 };

function artwork(seed, width, height) {
  const n = hash(seed);
  const [bg, mid, light] = PALETTES[n % PALETTES.length];
  const angle = (n % 60) - 30;
  const cx = 30 + (n % 45);
  const cy = 22 + ((n >> 3) % 50);
  const r1 = 45 + ((n >> 5) % 35);
  const r2 = 30 + ((n >> 7) % 30);
  const streak = ((n >> 9) % 40) - 20;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${angle} .5 .5)">
      <stop offset="0%" stop-color="${bg}"/><stop offset="55%" stop-color="${mid}"/><stop offset="100%" stop-color="${light}"/>
    </linearGradient>
    <radialGradient id="v" cx="50%" cy="45%" r="72%">
      <stop offset="50%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".62"/>
    </radialGradient>
    <linearGradient id="s" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff" stop-opacity="0"/><stop offset="50%" stop-color="#fff" stop-opacity=".12"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
  <circle cx="${(cx / 100) * width}" cy="${(cy / 100) * height}" r="${(r1 / 100) * width}" fill="#fff" fill-opacity=".05"/>
  <circle cx="${((cx + 26) / 100) * width}" cy="${((cy + 30) / 100) * height}" r="${(r2 / 100) * width}" fill="#000" fill-opacity=".14"/>
  <rect x="${-width * 0.3 + (streak / 100) * width}" y="${-height * 0.2}" width="${width * 0.34}" height="${height * 1.5}"
        fill="url(#s)" transform="rotate(${22 + (n % 18)} ${width / 2} ${height / 2})"/>
  <rect width="${width}" height="${height}" fill="url(#v)"/>
</svg>`;

  return Buffer.from(
    new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: false } })
      .render()
      .asPng()
  );
}

const artCache = new Map();
function art(seed, w, h) {
  const key = `${seed}|${w}x${h}`;
  let buf = artCache.get(key);
  if (!buf) {
    buf = artwork(seed, w, h);
    // Bounded memo: a long dev session must not grow without limit.
    if (artCache.size > 400) artCache.clear();
    artCache.set(key, buf);
  }
  return buf;
}

// ============================================================================
// Catalogue — metadata only. Titles, years and ratings are factual; the
// images are generated stand-ins, not the real posters.
// ============================================================================
const CATALOG = [
  { id: 76600, title: 'Avatar: The Way of Water', year: '2022', vote: 7.7, kind: 'movie', overview: 'Jake Sully và gia đình chuyển tới Pandora, đối mặt với mối đe doạ mới với sự sống của hành tinh.' },
  { id: 872585, title: 'Oppenheimer', year: '2023', vote: 8.3, kind: 'movie', overview: 'Câu chuyện về J. Robert Oppenheimer và vai trò của ông trong việc phát triển bom nguyên tử.' },
  { id: 693134, title: 'Dune: Part Two', year: '2024', vote: 8.0, kind: 'movie', overview: 'Paul Atreides hợp nhất với người Fremen để trả thù những kẻ đã hủy diệt gia đình mình.' },
  { id: 414906, title: 'The Batman', year: '2022', vote: 7.7, kind: 'movie', overview: 'Bruce Wayne truy tìm Riddler, kẻ đang gieo rắc kinh hoàng khắp Gotham.' },
  { id: 361743, title: 'Top Gun: Maverick', year: '2022', vote: 8.2, kind: 'movie', overview: 'Sau hơn 30 năm, Maverick vẫn bay ở vị trí phi công thử nghiệm và phải huấn luyện thế hệ kế tiếp.' },
  { id: 603692, title: 'John Wick: Chapter 4', year: '2023', vote: 7.7, kind: 'movie', overview: 'John Wick đối đầu với High Table và tìm cách giành lại tự do.' },
  { id: 569094, title: 'Spider-Man: Across the Spider-Verse', year: '2023', vote: 8.3, kind: 'movie', overview: 'Miles Morales du hành qua đa vũ trụ và gặp đội quân Người Nhện.' },
  { id: 346698, title: 'Barbie', year: '2023', vote: 6.8, kind: 'movie', overview: 'Barbie và Ken rời Barbie Land để khám phá thế giới thực.' },
  { id: 157336, title: 'Interstellar', year: '2014', vote: 8.4, kind: 'movie', overview: 'Một nhóm phi hành gia du hành qua hố đen để tìm nơi ở mới cho nhân loại.' },
  { id: 27205, title: 'Inception', year: '2010', vote: 8.4, kind: 'movie', overview: 'Một tên trộm chuyên xâm nhập giấc mơ được giao nhiệm vụ cấy ghép một ý tưởng.' },
  { id: 155, title: 'The Dark Knight', year: '2008', vote: 8.5, kind: 'movie', overview: 'Batman đối đầu Joker, kẻ muốn đẩy Gotham vào hỗn loạn.' },
  { id: 68718, title: 'Django Unchained', year: '2012', vote: 8.2, kind: 'movie', overview: 'Một người nô lệ tự do tìm cách giải cứu vợ mình khỏi một trang trại miền Nam.' },
  { id: 1396, title: 'Breaking Bad', year: '2008', vote: 8.9, kind: 'tv', overview: 'Một giáo viên hoá học mắc bệnh hiểm nghèo chuyển sang sản xuất ma tuý để lo cho gia đình.' },
  { id: 1399, title: 'Game of Thrones', year: '2011', vote: 8.4, kind: 'tv', overview: 'Chín dòng họ quý tộc tranh giành ngai sắt của Westeros.' },
  { id: 66732, title: 'Stranger Things', year: '2016', vote: 8.6, kind: 'tv', overview: 'Một nhóm thiếu niên khám phá bí ẩn siêu nhiên tại thị trấn nhỏ Hawkins.' },
  { id: 94605, title: 'Arcane', year: '2021', vote: 8.7, kind: 'tv', overview: 'Hai chị em đứng ở hai phía của cuộc chiến giữa Piltover và Zaun.' },
  { id: 71446, title: 'Money Heist', year: '2017', vote: 8.2, kind: 'tv', overview: 'Một thiên tài bí ẩn lên kế hoạch cho vụ cướp lớn nhất lịch sử Tây Ban Nha.' },
  { id: 82856, title: 'The Mandalorian', year: '2019', vote: 8.4, kind: 'tv', overview: 'Một thợ săn tiền thưởng đơn độc bảo vệ một đứa trẻ bí ẩn.' },
  { id: 60625, title: 'Rick and Morty', year: '2013', vote: 8.7, kind: 'tv', overview: 'Nhà khoa học lập dị và cháu trai phiêu lưu qua các chiều không gian.' },
  { id: 63174, title: 'Lucifer', year: '2016', vote: 8.5, kind: 'tv', overview: 'Quỷ dữ rời địa ngục tới Los Angeles và điều hành một hộp đêm.' },
];

// TMDB-shaped entry. The app reads poster_path/backdrop_path and builds the URL
// from VITE_TMDB_IMG_BASE, so the fixture only supplies the path fragment.
const asTmdb = (item) => ({
  id: item.id,
  media_type: item.kind,
  title: item.kind === 'movie' ? item.title : undefined,
  name: item.kind === 'tv' ? item.title : undefined,
  overview: item.overview,
  vote_average: item.vote,
  vote_count: 1200 + item.id % 8000,
  release_date: item.kind === 'movie' ? `${item.year}-01-01` : undefined,
  first_air_date: item.kind === 'tv' ? `${item.year}-01-01` : undefined,
  poster_path: `/p${item.id}.png`,
  backdrop_path: `/b${item.id}.png`,
  genre_ids: [18, 28],
  original_language: 'en',
  popularity: 1000 - item.id % 400,
});

const MOVIES = CATALOG.filter((c) => c.kind === 'movie').map(asTmdb);
const TV = CATALOG.filter((c) => c.kind === 'tv').map(asTmdb);
const ALL = CATALOG.map(asTmdb);

// ============================================================================
// Channel list — parsed from the repository's own playlist (real data)
// ============================================================================
function loadChannels() {
  const file = join(ROOT, 'playlists/tv.m3u');
  if (!existsSync(file)) return [];
  const text = readFileSync(file, 'utf8');
  const out = [];
  let pending = null;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('#EXTINF')) {
      const name = (line.split(',').pop() || '').trim();
      const group = (line.match(/group-title="([^"]*)"/) || [, 'Khác'])[1];
      const logo = (line.match(/tvg-logo="([^"]*)"/) || [, ''])[1];
      const id = (line.match(/tvg-id="([^"]*)"/) || [, ''])[1];
      pending = {
        channel_id: id || `ch${out.length + 1}`,
        name,
        group_title: group,
        // Upstream logos are on hosts that may be unreachable; the card falls
        // back cleanly when an image fails, which is itself worth reviewing.
        logo,
      };
    } else if (line && !line.startsWith('#') && pending) {
      pending.played = 0;
      out.push(pending);
      pending = null;
    }
  }
  return out;
}

const CHANNELS = loadChannels();

// Needs the parsed channel list, so it is created here rather than with the
// other fixture modules near the top.
const admin = createAdmin({ channels: CHANNELS, hash });
const shorts = createShorts();

// ============================================================================
// EPG — a plausible schedule derived from the real channel list
// ============================================================================
const SHOW_NAMES = [
  'Bản tin thời sự', 'Chương trình sáng', 'Phim truyện Việt Nam', 'Talkshow cuối tuần',
  'Bản tin thể thao', 'Ký sự khám phá', 'Ca nhạc tổng hợp', 'Thời sự quốc tế',
  'Phim tài liệu', 'Gameshow giải trí', 'Dự báo thời tiết', 'Nhịp sống đô thị',
];

function buildEpg() {
  const now = Date.now();
  const programmes = [];
  const slot = 45 * 60 * 1000; // 45-minute blocks

  CHANNELS.forEach((ch, ci) => {
    // Cover 6 hours back and 12 hours forward.
    for (let i = -8; i < 16; i++) {
      const start = now + i * slot;
      const name = SHOW_NAMES[(hash(ch.channel_id + i) + ci) % SHOW_NAMES.length];
      programmes.push({
        channel: ch.channel_id,
        title: name,
        desc: `${name} — phát trên ${ch.name}.`,
        start: new Date(start).toISOString(),
        stop: new Date(start + slot).toISOString(),
        start_ts: Math.floor(start / 1000),
        stop_ts: Math.floor((start + slot) / 1000),
      });
    }
  });
  return { programmes, channels: CHANNELS.map((c) => ({ id: c.channel_id, name: c.name, logo: c.logo })) };
}

const EPG = buildEpg();

// ============================================================================
// HTTP
// ============================================================================
const json = (res, body, status = 200) => {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(data);
};

const png = (res, buf, cache = 'public, max-age=3600') => {
  res.writeHead(200, {
    'Content-Type': 'image/png',
    'Content-Length': buf.length,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': cache,
  });
  res.end(buf);
};

/** Read a JSON request body. Returns {} on anything unparseable — a malformed
 *  body should produce a normal validation error, not a crashed fixture. */
function readJson(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function tmdbProxy(url) {
  const p = url.searchParams.get('path') || '';
  let results = ALL;
  let extra = {};

  if (p.startsWith('/trending')) results = ALL.slice(0, 10);
  else if (p.startsWith('/movie/now_playing')) results = MOVIES.slice(0, 10);
  else if (p.startsWith('/movie/top_rated')) results = [...MOVIES].sort((a, b) => b.vote_average - a.vote_average).slice(0, 10);
  else if (p.startsWith('/movie/popular')) results = MOVIES;
  else if (p.startsWith('/tv/popular')) results = TV;
  else if (p.startsWith('/discover/movie')) results = MOVIES;
  else if (p.startsWith('/discover/tv')) results = TV;
  else if (p.startsWith('/movie/upcoming')) results = MOVIES.slice(0, 8);
  else if (p.startsWith('/search/')) {
    const q = (url.searchParams.get('query') || '').toLowerCase();
    results = ALL.filter((m) => (m.title || m.name || '').toLowerCase().includes(q));
  } else if (p.startsWith('/genre/')) {
    return { genres: [{ id: 18, name: 'Chính kịch' }, { id: 28, name: 'Hành động' }, { id: 35, name: 'Hài' }, { id: 16, name: 'Hoạt hình' }] };
  } else if (/^\/(movie|tv)\/\d+$/.test(p)) {
    const id = Number(p.split('/').pop());
    const hit = ALL.find((m) => m.id === id) || ALL[0];
    return {
      ...hit,
      runtime: 128,
      tagline: 'playZ dev fixture',
      genres: [{ id: 18, name: 'Chính kịch' }, { id: 28, name: 'Hành động' }],
      status: 'Released',
      seasons: [],
      number_of_seasons: hit.media_type === 'tv' ? 3 : undefined,
    };
  } else if (/\/(movie|tv)\/\d+\/videos$/.test(p)) {
    return { results: [] }; // no trailer in the fixture — exercises the fallback path
  }

  extra = { page: 1, total_pages: 3, total_results: results.length };
  return { results, ...extra };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
    return res.end();
  }

  // --- landing ------------------------------------------------------------
  // Reached only if someone opens the fixture's own preview. A bare 404 here
  // looks like a broken deployment, so say what this process is and where the
  // application actually lives.
  if (path === '/' || path === '/index.html') {
    const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>playZ — fixture API</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#08080A;color:#F5F5F7;font-family:Inter,system-ui,sans-serif">
<div style="max-width:560px;padding:32px 24px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
    <span style="display:inline-flex;width:34px;height:34px;border-radius:9px;background:#2F6BFF;align-items:center;justify-content:center;font-weight:800">Z</span>
    <span style="font-weight:800">playZ</span>
  </div>
  <p style="font-size:16px;font-weight:700;margin:0 0 8px">Đây là API giả lập, không phải ứng dụng</p>
  <p style="font-size:13.5px;color:#8A8A99;line-height:1.7;margin:0 0 20px">
    Tiến trình này chỉ phục vụ dữ liệu phát triển (kênh, EPG, phim, thể thao, cộng đồng, admin).
    Nó không có giao diện. Mở cổng <b style="color:#F5F5F7">3000</b> để xem ứng dụng, cổng
    <b style="color:#F5F5F7">3100</b> để xem trang quản trị.
  </p>
  <div style="border:1px solid #24242C;border-radius:12px;background:#101014;padding:14px;font:12px/1.9 ui-monospace,Menlo,monospace;color:#8A8A99">
    GET /api/playlist · /api/epg · /api/tmdb?path=… · /api/shorts<br>
    GET /media/&lt;clip&gt;.mp4 · /img/&lt;size&gt;/&lt;name&gt;.png<br>
    GET /api/community/* · /api/party/*
    GET /admin/* — 19 endpoint quản trị
  </div>
</div></body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(html) });
    return res.end(html);
  }

  // --- fixture media ------------------------------------------------------
  // Vertical clips for Shorts. They are pans over a still, a few seconds and a
  // few dozen KB each — see tools/make-fixture-media.mjs. Ships nothing.
  if (path.startsWith('/media/')) {
    const name = path.slice('/media/'.length);
    if (!/^[a-z0-9-]+\.(mp4|png|jpg|webp)$/.test(name)) return json(res, { error: 'bad name' }, 400);
    const file = new URL(`./fixture-media/${name}`, import.meta.url);
    if (!existsSync(file)) return json(res, { error: 'no such media', name, hint: 'run: node tools/make-fixture-media.mjs' }, 404);
    const type = name.endsWith('.mp4') ? 'video/mp4' : name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    const body = readFileSync(file);
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': body.length,
      // The clips are tiny and immutable, and SeekRange matters here: without
      // it Safari refuses to play an <video> at all.
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
    });
    return res.end(body);
  }

  // --- artwork ------------------------------------------------------------
  if (path.startsWith('/img/')) {
    // /img/<size>/<name>.png   e.g. /img/w342/p76600.png
    const parts = path.slice(5).split('/');
    const size = parts[0];
    const name = (parts[1] || 'p0.png').replace(/\.png$/, '');
    let w;
    if (/^\d+$/.test(size)) w = Math.min(Number(size), 2000);
    else w = SIZE_W[size] || 500;
    const isBackdrop = name.startsWith('b');
    const isLogo = name.startsWith('l');
    const h = isBackdrop ? Math.round((w * 9) / 16) : isLogo ? w : Math.round(w * 1.5);
    return png(res, art(name, w, h));
  }

  // --- API ----------------------------------------------------------------
  if (path === '/api/playlist') {
    // Upstream logo hosts are unreachable here, and a broken <img> per channel
    // would make the grid unreadable — so serve generated tiles instead. Only
    // the fixture does this; production returns the real logo URLs.
    const data = CHANNELS.map((c) => ({
      ...c,
      logo: `/img/w185/l${c.channel_id.replace(/[^a-zA-Z0-9]/g, '') || 'x'}.png`,
    }));
    return json(res, { success: true, data, total: data.length, fixture: true });
  }

  if (path === '/api/epg') {
    return json(res, { success: true, data: EPG, fixture: true });
  }

  if (path === '/api/notifications') {
    return json(res, { success: true, notifications: [] });
  }

  if (path === '/api/movie/sources') {
    return json(res, { success: true, sources: [] });
  }

  if (path === '/api/tmdb') {
    return json(res, tmdbProxy(url));
  }

  if (path === '/api/geo') {
    return json(res, { success: true, country: 'VN', region: 'VN' });
  }

  if (path === '/api/stats/trending') {
    return json(res, { success: true, data: CHANNELS.slice(0, 10).map((c, i) => ({ ...c, views: 1000 - i * 37 })) });
  }

  // --- sports -------------------------------------------------------------
  // The Sports page falls back through three sources; these cover the two that
  // are same-origin, plus the bare /tsdb and /espn paths the dev proxy uses.
  if (path === '/api/sports/tsdb') {
    return json(res, sports.tsdbProxy(url));
  }
  if (path === '/api/sports/espn') {
    return json(res, sports.espnProxy(url));
  }
  if (path.startsWith('/tsdb/')) {
    const file = decodeURIComponent(path.slice(6));
    const qs = url.searchParams.toString();
    return json(res, sports.tsdbProxy(new URL(`http://x/?file=${encodeURIComponent(file)}${qs ? `&${qs}` : ''}`)));
  }
  if (path.startsWith('/espn/sports/soccer/')) {
    const slug = path.slice('/espn/sports/soccer/'.length).split('/')[0];
    return json(res, sports.espnProxy(new URL(`http://x/?league=${encodeURIComponent(slug)}`)));
  }
  if (path === '/api/plans') {
    // Same ladder the admin manages, so the package page and the admin panel
    // can never disagree in development.
    return json(res, admin.get('/admin/plans') || { success: true, plans: [] });
  }
  if (path === '/api/challenges') {
    return json(res, { success: true, challenges: [], fixture: true });
  }
  if (path === '/api/sports-videos') {
    return json(res, { success: true, videos: sports.SPORTS_VIDEOS, fixture: true });
  }

  // --- shorts -------------------------------------------------------------
  if (path === '/api/shorts' || path === '/api/shorts/feed') {
    return json(res, { success: true, shorts: shorts.list(), fixture: true });
  }
  if (path === '/api/shorts/creators') {
    return json(res, { success: true, creators: shorts.creators(), fixture: true });
  }
  // Must come before the /creator prefix below, or the profile route is
  // swallowed by it and the creator studio always reads back empty.
  if (path === '/api/shorts/creator/profile') {
    if (req.method === 'POST') {
      const out = shorts.saveProfile(await readJson(req));
      return json(res, out, out.status || 200);
    }
    return json(res, shorts.myProfile());
  }
  if (path.startsWith('/api/shorts/creator')) {
    return json(res, shorts.creatorProfile(
      url.searchParams.get('creator_id') || url.searchParams.get('id') || '',
      url.searchParams.get('handle') || '',
    ), 200);
  }
  if (path === '/api/shorts/upload' && req.method === 'POST') {
    const out = shorts.upload(await readJson(req));
    return json(res, out, out.status || 200);
  }
  if (path === '/api/shorts/react' && req.method === 'POST') {
    const out = shorts.react(await readJson(req));
    return json(res, out, out.status || 200);
  }
  if (path === '/api/shorts/star' && req.method === 'POST') {
    const out = shorts.star(await readJson(req));
    return json(res, out, out.status || 200);
  }
  if (path === '/api/shorts/follow' && req.method === 'POST') {
    const out = shorts.follow(await readJson(req));
    return json(res, out, out.status || 200);
  }

  // --- community ----------------------------------------------------------
  if (path === '/api/community/feed') {
    return json(res, community.feed());
  }
  if (path === '/api/community/like' && req.method === 'POST') {
    const b = await readJson(req);
    const out = community.like(b);
    return json(res, out, out.status || 200);
  }
  if (path === '/api/comments') {
    if (req.method === 'GET') return json(res, community.listComments(url.searchParams.get('target') || ''));
    if (req.method === 'POST') {
      const b = await readJson(req);
      const out = community.addComment(b);
      return json(res, out, out.status || 200);
    }
    if (req.method === 'DELETE') {
      return json(res, community.removeComment(url.searchParams.get('id')));
    }
  }
  if (path.startsWith('/api/party/')) {
    if (req.method === 'GET' && path === '/api/party/feed') {
      return json(res, community.chatFeed(url.searchParams.get('room') || '', url.searchParams.get('after') || 0));
    }
    if (req.method === 'POST') {
      const b = await readJson(req);
      const action = path.slice('/api/party/'.length);
      const fn = community[action];
      if (typeof fn === 'function') {
        const out = community[action](b);
        return json(res, out, out.status || 200);
      }
    }
  }

  // --- admin --------------------------------------------------------------
  // The management panels read these. Mutations round-trip in memory, so a
  // toggle really does stay toggled until the fixture restarts.
  if (path.startsWith('/admin/')) {
    if (req.method === 'GET') {
      const out = admin.get(path);
      if (out) return json(res, out);
    } else if (req.method === 'POST') {
      const out = admin.post(path, await readJson(req));
      if (out) return json(res, out);
    } else if (req.method === 'PUT') {
      const out = admin.put(path, await readJson(req));
      if (out) return json(res, out);
    } else if (req.method === 'DELETE') {
      const out = admin.del(path, await readJson(req));
      if (out) return json(res, out);
    }
    return json(res, { success: false, error: 'Not implemented in dev fixture', code: 'FIXTURE_404' }, 404);
  }

  // Anything else: an explicit empty success, so the UI exercises its empty
  // states instead of hanging on a request that never resolves.
  if (path.startsWith('/api/') || path.startsWith('/auth/') || path.startsWith('/user/') || path.startsWith('/admin/')) {
    return json(res, { success: false, error: 'Not implemented in dev fixture', code: 'FIXTURE_404' }, 404);
  }

  json(res, { error: 'Not found', path }, 404);
});

server.listen(PORT, HOST, () => {
  const pngCount = CHANNELS.length ? 2 : 0;
  console.log(`playZ dev fixture API → http://${HOST}:${PORT}`);
  console.log(`  channels      : ${CHANNELS.length} (from playlists/tv.m3u)`);
  console.log(`  epg programmes: ${EPG.programmes.length}`);
  console.log(`  catalogue     : ${CATALOG.length} titles (${MOVIES.length} movies, ${TV.length} shows)`);
  console.log(`  sports        : ${sports.SPORTS_LEAGUES.length} leagues, ${sports.LEAGUE_INDEX.length} indexed leagues, ${sports.SPORTS_VIDEOS.length} clips`);
  console.log('  community     : feed + likes + a live chat room');
  console.log('  admin         : 19 management endpoints for the admin app');
  console.log(`  shorts        : ${shorts.list().length} vertical clips, served from /media/`);
  console.log('  artwork       : generated on demand at /img/<size>/<name>.png');
  console.log('  NOTE — development fixture. Not product content, never deployed.');
});

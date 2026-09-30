// ============================================================================
// ADMIN — fixture responses
// ----------------------------------------------------------------------------
// Stands in for the /admin/* endpoints so the management panels render with data
// in development. Shapes mirror what the Worker actually returns, which was read
// off each handler rather than guessed — a panel that renders against a made-up
// shape proves nothing.
//
// Mutations are applied in memory so the UI round-trips honestly: toggling a
// channel off and reloading really does show it off. Everything resets when the
// fixture restarts.
//
// Dev-only. Never deployed; production uses the real handlers in worker.js.
// ============================================================================

export function createAdmin({ channels = [], hash }) {
  const ymd = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };

  // Deterministic per-day series, so the chart is stable between reloads.
  const series = (seed, base, spread, days = 14) =>
    Array.from({ length: days }, (_, i) => {
      const offset = i - (days - 1);
      const v = base + (hash(`${seed}:${offset}`) % spread);
      return { day: ymd(offset), n: v, views: v, logins: Math.round(v / 4) };
    });

  const viewsByDay = series('views', 420, 900);
  const loginsByDay = series('logins', 40, 120);

  const topChannels = [...channels]
    .slice(0, 40)
    .map((c, i) => ({
      channel_id: c.channel_id,
      name: c.name,
      views: 9000 - i * 137 + (hash(`top:${c.channel_id}`) % 400),
      group_title: c.group_title,
    }))
    .sort((a, b) => b.views - a.views);

  const names = ['Minh Tuấn', 'Hà Linh', 'Quốc Bảo', 'Thảo Vy', 'Đức Anh', 'Hoàng Nam', 'Lan Anh', 'Tuấn Kiệt', 'Bảo Ngọc', 'Gia Hân'];

  const viewers = names.slice(0, 7).map((name, i) => ({
    user_id: 100 + i,
    name,
    channel_id: channels[i * 13]?.channel_id || '',
    channel_name: channels[i * 13]?.name || '',
    last_seen: Date.now() - i * 42000,
  }));

  const users = names.map((name, i) => ({
    id: 100 + i,
    username: `user${100 + i}`,
    display_name: name,
    email: `user${100 + i}@example.test`,
    role: i === 0 ? 'admin' : i === 1 ? 'moderator' : 'user',
    plan: ['premium', 'standard', 'free', 'premium', 'free', 'standard', 'free', 'premium', 'free', 'free'][i],
    banned: i === 8 ? 1 : 0,
    created_at: new Date(Date.now() - (i + 3) * 86400000).toISOString().slice(0, 19).replace('T', ' '),
  }));

  const plans = [
    { code: 'free', name: 'Miễn phí', price: 0, days: 0, groups: 'Kênh cơ bản', is_active: 1 },
    { code: 'day', name: 'Gói ngày', price: 10000, days: 1, groups: 'Kênh cơ bản', is_active: 1 },
    { code: 'week', name: 'Gói tuần', price: 50000, days: 7, groups: 'Kênh cơ bản + Thể thao', is_active: 1 },
    { code: 'month', name: 'Gói tháng', price: 150000, days: 30, groups: 'Tất cả', is_active: 1 },
    { code: 'year', name: 'Gói năm', price: 1500000, days: 365, groups: 'Tất cả', is_active: 1 },
    { code: 'legacy', name: 'Gói cũ (ngừng bán)', price: 99000, days: 30, groups: 'Kênh cơ bản', is_active: 0 },
  ];

  const statuses = ['paid', 'paid', 'pending', 'paid', 'failed', 'paid', 'pending', 'paid'];
  const payments = Array.from({ length: 24 }, (_, i) => ({
    id: `PAY${2000 + i}`,
    user_id: 100 + (i % names.length),
    username: `user${100 + (i % names.length)}`,
    plan_code: plans[(i % 4) + 1].code,
    amount: plans[(i % 4) + 1].price,
    status: statuses[i % statuses.length],
    created_at: new Date(Date.now() - i * 3600000).toISOString().slice(0, 19).replace('T', ' '),
  }));

  const comments = [
    { id: 900, target: 'community', user_id: 103, name: 'Quốc Bảo', body: 'Bảng xếp hạng Ngoại hạng Anh giờ nhìn khó đoán thật.', status: 'visible', created_at: new Date(Date.now() - 3600000).toISOString().slice(0, 19).replace('T', ' ') },
    { id: 899, target: 'community', user_id: 105, name: 'Đức Anh', body: 'Có ai biết kênh nào chiếu NBA không?', status: 'visible', created_at: new Date(Date.now() - 7200000).toISOString().slice(0, 19).replace('T', ' ') },
    { id: 898, target: 'movie:76600', user_id: 107, name: 'Hoàng Nam', body: 'Phim này hay, nên xem bản gốc.', status: 'visible', created_at: new Date(Date.now() - 10800000).toISOString().slice(0, 19).replace('T', ' ') },
    // One hidden entry, so the moderation state is visible rather than theoretical.
    { id: 897, target: 'community', user_id: 109, name: 'Gia Hân', body: 'Nội dung đã bị ẩn để kiểm tra.', status: 'hidden', created_at: new Date(Date.now() - 14400000).toISOString().slice(0, 19).replace('T', ' ') },
  ];

  const notifications = Array.from({ length: 5 }, (_, i) => ({
    id: 500 + i,
    title: ['Bảo trì định kỳ', 'Kênh mới: VTV Prime HD', 'Nâng cấp chất lượng 1080p', 'Sự kiện thể thao cuối tuần', 'Cập nhật ứng dụng'][i],
    body: 'Thông báo mẫu cho môi trường phát triển.',
    audience: i % 2 ? 'premium' : 'all',
    created_at: new Date(Date.now() - (i + 1) * 43200000).toISOString().slice(0, 19).replace('T', ' '),
  }));

  const audit = Array.from({ length: 30 }, (_, i) => ({
    id: 7000 + i,
    created_at: new Date(Date.now() - i * 5400000).toISOString().slice(0, 19).replace('T', ' '),
    actor: i % 3 === 0 ? 'admin' : `user${100 + (i % 5)}`,
    action: ['channel.update', 'user.ban', 'plan.update', 'notify.send', 'comment.delete'][i % 5],
    target: i % 2 ? `channel:${channels[i]?.channel_id || 'x'}` : `user:${100 + (i % 10)}`,
    detail: 'Thao tác mẫu trong môi trường phát triển.',
  }));

  const epgOverrides = [
    { id: 1, channel_id: channels[0]?.channel_id || 'x', title: 'Bản tin buổi sáng', start: new Date().toISOString().slice(0, 19).replace('T', ' '), stop: new Date(Date.now() + 3600000).toISOString().slice(0, 19).replace('T', ' ') },
    { id: 2, channel_id: channels[1]?.channel_id || 'x', title: 'Trực tiếp: Giải vô địch', start: new Date(Date.now() + 7200000).toISOString().slice(0, 19).replace('T', ' '), stop: new Date(Date.now() + 10800000).toISOString().slice(0, 19).replace('T', ' ') },
  ];

  const events = [
    { id: 1, title: 'Chung kết C1 — trực tiếp', subtitle: '03:00 thứ Năm trên playZ', image_url: '/img/w780/b1.png', link_type: 'channel', link_value: channels[0]?.channel_id || '', starts_at: '', ends_at: '', is_active: 1, sort_order: 0, blocked_regions: '' },
    { id: 2, title: 'V.League vòng 12', subtitle: 'Tất cả trận trong tuần', image_url: '/img/w780/b2.png', link_type: 'url', link_value: '/sports', starts_at: '', ends_at: '', is_active: 1, sort_order: 1, blocked_regions: '' },
    { id: 3, title: 'Tết 2027 — gói Signature giảm 40%', subtitle: 'Kết thúc 05/02', image_url: '/img/w780/b3.png', link_type: 'plans', link_value: 'signature', starts_at: '2027-01-20 00:00:00', ends_at: '2027-02-05 23:59:59', is_active: 0, sort_order: 2, blocked_regions: '' },
  ];

  const movieSources = [
    { id: 1, name: 'Nguồn chính (dựng sẵn)', kind: 'iframe', url_template: 'https://embed.example/{type}/{tmdb}', label: 'Server 1', license_note: 'Theo thoả thuận', is_active: 1, sort_order: 0, blocked_regions: '' },
    { id: 2, name: 'Nguồn dự phòng', kind: 'hls', url_template: 'https://cdn.example/{tmdb}/master.m3u8', label: 'Server 2', license_note: '', is_active: 1, sort_order: 1, blocked_regions: 'US' },
  ];
  const builtinSources = [
    { id: 'builtin-1', name: 'playZ builtin A', kind: 'iframe', url_template: 'https://a.example/embed/{tmdb}' },
    { id: 'builtin-2', name: 'playZ builtin B', kind: 'iframe', url_template: 'https://b.example/embed/{tmdb}' },
  ];

  const sportsVideos = [
    { id: 1, title: 'Bàn thắng phút 90+4', league: 'Ngoại hạng Anh', thumb_url: '/img/w780/b1.png', video_url: '/media/s4.mp4', duration: '1:24', is_active: 1, sort_order: 0 },
    { id: 2, title: 'Pha cứu thua không tưởng', league: 'La Liga', thumb_url: '/img/w780/b2.png', video_url: '/media/s3.mp4', duration: '0:48', is_active: 1, sort_order: 1 },
    { id: 3, title: 'Highlights V.League vòng 11', league: 'V.League 1', thumb_url: '/img/w780/b3.png', video_url: '/media/s1.mp4', duration: '3:12', is_active: 1, sort_order: 2 },
  ];

  const shortCreators = [
    { id: 1, handle: 'playZ', display_name: 'playZ', bio: 'Kênh chính thức của playZ.', verified: 1, shorts_count: 12, followers: 128400 },
    { id: 2, handle: 'mienTay', display_name: 'Miền Tây Sports', bio: 'Bóng đá miền sông nước.', verified: 1, shorts_count: 34, followers: 38200 },
    { id: 3, handle: 'muaBui', display_name: 'Mưa Bụi', bio: 'Quay đời thường bằng điện thoại.', verified: 0, shorts_count: 7, followers: 9410 },
  ];
  const shortRows = [
    { id: 1, title: 'Night Drive', caption: 'Đường phố sau mưa.', thumb_url: '/media/s1.png', video_url: '/media/s1.mp4', status: 'live', views: 18400, likes: 1240, author: 'playZ', creator_id: 1, creator_handle: 'playZ', created_at: new Date(Date.now() - 3600e3).toISOString().slice(0, 19).replace('T', ' ') },
    { id: 2, title: 'Sunset Loop', caption: 'Mặt trời lặn sau khán đài.', thumb_url: '/media/s2.png', video_url: '/media/s2.mp4', status: 'live', views: 9310, likes: 733, author: 'Miền Tây Sports', creator_id: 2, creator_handle: 'mienTay', created_at: new Date(Date.now() - 7200e3).toISOString().slice(0, 19).replace('T', ' ') },
    { id: 3, title: 'Gold Hour', caption: 'Bàn thắng vàng phút 89.', thumb_url: '/media/s4.png', video_url: '/media/s4.mp4', status: 'hidden', views: 44200, likes: 3910, author: 'Mưa Bụi', creator_id: 3, creator_handle: 'muaBui', created_at: new Date(Date.now() - 10800e3).toISOString().slice(0, 19).replace('T', ' ') },
  ];

  const broadcasts = [
    { id: 1, message: 'Sự cố kênh VTV1 đang được xử lý, dự kiến 15 phút.', type: 'warning', is_active: 1, created_at: new Date(Date.now() - 900e3).toISOString().slice(0, 19).replace('T', ' '), expires_at: Math.floor((Date.now() + 900e3) / 1000) },
    { id: 2, message: 'Chào mừng tới playZ Cộng đồng 👋', type: 'info', is_active: 1, created_at: new Date(Date.now() - 86400e3).toISOString().slice(0, 19).replace('T', ' '), expires_at: 0 },
  ];

  const themes = [
    { id: 1, key: 'default', name: 'playZ mặc định', emoji: '', description: 'Bảng màu gốc', primary_color: '#2F6BFF', secondary_color: '#08080A', accent_color: '#FF6B2C', is_active: 1, starts_at: '', ends_at: '', sort_order: 0 },
    { id: 2, key: 'tet-2027', name: 'Tết 2027', emoji: '🧧', description: 'Áp dụng mùng 1 đến mùng 5', primary_color: '#E2450F', secondary_color: '#12080A', accent_color: '#FFC53D', is_active: 0, starts_at: '2027-02-06 00:00:00', ends_at: '2027-02-11 23:59:59', sort_order: 1 },
  ];

  const ads = [
    { id: 1, slot: 'home-top', title: 'Gói Signature — 40%', image_url: '/img/w780/b1.png', link_url: '/plans', video_url: '', starts_at: '', ends_at: '', is_active: 1, sort_order: 0, blocked_regions: '' },
    { id: 2, slot: 'player-preroll', title: 'playZ Premium', image_url: '/img/w780/b2.png', link_url: '/plans', video_url: '/media/s2.mp4', starts_at: '', ends_at: '', is_active: 1, sort_order: 1, blocked_regions: '' },
    { id: 3, slot: 'banner', title: 'Thể thao cuối tuần', image_url: '/img/w780/b3.png', link_url: '/sports', video_url: '', starts_at: '', ends_at: '', is_active: 1, sort_order: 2, blocked_regions: 'US, CA' },
  ];

  const paymentConfig = { bank_id: '970436', account_no: '0123456789', account_name: 'ANKB CO.', template: 'compact2', note: 'PLAYZ <mã đơn>', has_sepay: true };

  const regionItems = channels.slice(0, 8).map((c) => ({ channel_id: c.channel_id, name: c.name, is_sponsored: 0, blocked_regions: '' }));

  const maintenance = [
    { channel_id: channels[0]?.channel_id || 'x', name: channels[0]?.name || 'Kênh 1', group_title: channels[0]?.group_title || '', maintenance_until: Math.floor(Date.now() / 1000) + 1800, note: 'Nhà cung cấp đang đổi CDN' },
  ];

  const streamCredentials = [
    { channel_id: channels[0]?.channel_id || 'x', updated_at: Math.floor(Date.now() / 1000) - 86400, has_token: true },
  ];

  return {
    get(path) {
      switch (path) {
        case '/admin/analytics/summary':
          return { success: true, viewsByDay, loginsByDay, topChannels: topChannels.slice(0, 12), byEvent: [{ kind: 'view', n: 18420 }, { kind: 'login', n: 2140 }, { kind: 'search', n: 3960 }, { kind: 'error', n: 87 }] };
        case '/admin/analytics':
          return { success: true, viewsByDay, loginsByDay, topChannels: topChannels.slice(0, 12) };
        case '/admin/presence':
        case '/admin/realtime':
          return { success: true, viewers };
        case '/admin/channels':
          return { success: true, channels };
        case '/admin/comments':
          return { success: true, comments };
        case '/admin/users':
          return { success: true, users };
        case '/admin/plans':
          return { success: true, plans };
        case '/admin/payments':
          return { success: true, payments };
        case '/admin/notifications':
          return { success: true, notifications };
        case '/admin/audit':
          return { success: true, audit };
        case '/admin/epg-overrides':
          return { success: true, overrides: epgOverrides };
        case '/admin/events':
          return { success: true, events };
        case '/admin/movie_sources':
          return {
            success: true, sources: movieSources, frame_allowlist: ['embed.example', 'a.example', 'b.example'],
            frame_allowlist_set: true, custom_allowlist: [], builtin_enabled: true, builtin_sources: builtinSources,
          };
        case '/admin/sports-videos':
          return { success: true, videos: sportsVideos };
        case '/admin/shorts':
          return { success: true, shorts: shortRows };
        case '/admin/short-creators':
          return { success: true, creators: shortCreators };
        case '/admin/broadcasts':
          return { success: true, broadcasts };
        case '/admin/themes':
          return { success: true, themes };
        case '/admin/ads':
          return { success: true, ads };
        case '/admin/payment-config':
          return { success: true, config: paymentConfig };
        case '/admin/regions':
          return { success: true, type: 'channel', items: regionItems };
        case '/admin/maintenance':
          return { success: true, items: maintenance };
        case '/admin/stream-credentials':
          return { success: true, credentials: streamCredentials };
        default:
          return null;
      }
    },

    post(path, body) {
      if (path === '/admin/channels' && body?.channel_id) {
        const i = channels.findIndex((c) => c.channel_id === body.channel_id);
        if (i >= 0) {
          // Mirrors the worker's upsert: stream_token survives when omitted.
          channels[i] = { ...channels[i], ...body, stream_token: body.stream_token || channels[i].stream_token };
        }
        return { success: true };
      }
      if (path === '/admin/users/action') return { success: true };

      // --- content --------------------------------------------------------
      if (path === '/admin/events') {
        events.push({ id: Math.max(0, ...events.map((e) => e.id)) + 1, blocked_regions: '', ...body });
        return { success: true };
      }
      if (path === '/admin/movie_sources') {
        movieSources.push({ id: Math.max(0, ...movieSources.map((m) => m.id)) + 1, blocked_regions: '', ...body });
        return { success: true };
      }
      if (path === '/admin/sports-videos') {
        sportsVideos.push({ id: Math.max(0, ...sportsVideos.map((v) => v.id)) + 1, ...body });
        return { success: true };
      }
      if (path === '/admin/themes') {
        themes.push({ id: Math.max(0, ...themes.map((t) => t.id)) + 1, ...body });
        return { success: true };
      }
      if (path === '/admin/ads') {
        ads.push({ id: Math.max(0, ...ads.map((a) => a.id)) + 1, blocked_regions: '', ...body });
        return { success: true };
      }
      if (path === '/admin/broadcast') {
        broadcasts.unshift({
          id: Math.max(0, ...broadcasts.map((b) => b.id)) + 1,
          message: body?.message || '', type: body?.type || 'info', is_active: 1,
          created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
          expires_at: body?.expiresAt || 0,
        });
        return { success: true };
      }
      if (path === '/admin/maintenance' && body?.channel_id) {
        const until = Math.floor(Date.now() / 1000) + (parseInt(body.minutes, 10) || 30) * 60;
        const known = channels.find((c) => c.channel_id === body.channel_id);
        const row = {
          channel_id: body.channel_id, name: known?.name || body.channel_id,
          group_title: known?.group_title || '', maintenance_until: until, note: body.note || '',
        };
        const i = maintenance.findIndex((m) => m.channel_id === body.channel_id);
        if (i >= 0) maintenance[i] = row; else maintenance.push(row);
        return { success: true, maintenance_until: until };
      }
      if (path === '/admin/stream-credentials' && body?.channel_id) {
        const row = { channel_id: body.channel_id, updated_at: Math.floor(Date.now() / 1000), has_token: true };
        const i = streamCredentials.findIndex((c) => c.channel_id === body.channel_id);
        if (i >= 0) streamCredentials[i] = row; else streamCredentials.push(row);
        return { success: true };
      }
      if (path === '/admin/notify') {
        notifications.unshift({
          id: 500 + notifications.length, title: body?.title || '', body: body?.body || '',
          audience: 'all', created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        });
        return { success: true };
      }
      return null;
    },

    // The worker uses PUT for edits and POST for creates. In the fixture the
    // two branches are the same code, so PUT merges into the existing row by id
    // rather than appending a duplicate.
    put(path, body) {
      const table = {
        '/admin/events': events,
        '/admin/movie_sources': movieSources,
        '/admin/sports-videos': sportsVideos,
        '/admin/shorts': shortRows,
        '/admin/short-creators': shortCreators,
        '/admin/themes': themes,
        '/admin/ads': ads,
        '/admin/channels': channels,
      }[path];
      if (table) {
        const key = path === '/admin/channels' ? 'channel_id' : 'id';
        const i = table.findIndex((r) => String(r[key]) === String(body?.[key]));
        if (i >= 0) table[i] = { ...table[i], ...body };
        else table.push({ id: Math.max(0, ...table.map((r) => Number(r.id) || 0)) + 1, ...body });
        return { success: true };
      }
      if (path === '/admin/payment-config') {
        Object.assign(paymentConfig, body || {});
        if (body?.sepay_token) paymentConfig.has_sepay = true;
        return { success: true };
      }
      if (path === '/admin/regions') {
        const key = body?.channel_id || body?.id;
        const i = regionItems.findIndex((r) => String(r.channel_id) === String(key) || String(r.id) === String(key));
        if (i >= 0) regionItems[i] = { ...regionItems[i], blocked_regions: body?.regions || '' };
        return { success: true };
      }
      return null;
    },

    del(path, body) {
      if (path === '/admin/comments' && body?.id) {
        const i = comments.findIndex((c) => c.id === Number(body.id));
        if (i >= 0) comments.splice(i, 1);
        return { success: true };
      }
      if (path === '/admin/broadcast' && body?.id) {
        const i = broadcasts.findIndex((b) => b.id === Number(body.id));
        if (i >= 0) broadcasts.splice(i, 1);
        return { success: true };
      }
      if (path === '/admin/maintenance' && body?.channel_id) {
        const i = maintenance.findIndex((m) => m.channel_id === body.channel_id);
        if (i >= 0) maintenance.splice(i, 1);
        return { success: true };
      }
      if (path === '/admin/stream-credentials' && body?.channel_id) {
        const i = streamCredentials.findIndex((c) => c.channel_id === body.channel_id);
        if (i >= 0) streamCredentials.splice(i, 1);
        return { success: true };
      }
      const delTable = {
        '/admin/events': events,
        '/admin/movie_sources': movieSources,
        '/admin/sports-videos': sportsVideos,
        '/admin/shorts': shortRows,
        '/admin/short-creators': shortCreators,
        '/admin/themes': themes,
        '/admin/ads': ads,
      }[path];
      if (delTable && body?.id) {
        const i = delTable.findIndex((r) => r.id === Number(body.id));
        if (i >= 0) delTable.splice(i, 1);
        return { success: true };
      }
      if (path === '/admin/epg-overrides' && body?.id) {
        const i = epgOverrides.findIndex((o) => o.id === Number(body.id));
        if (i >= 0) epgOverrides.splice(i, 1);
        return { success: true };
      }
      return null;
    },
  };
}

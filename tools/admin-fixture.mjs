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
      if (path === '/admin/notify') {
        notifications.unshift({
          id: 500 + notifications.length, title: body?.title || '', body: body?.body || '',
          audience: 'all', created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        });
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
      if (path === '/admin/epg-overrides' && body?.id) {
        const i = epgOverrides.findIndex((o) => o.id === Number(body.id));
        if (i >= 0) epgOverrides.splice(i, 1);
        return { success: true };
      }
      return null;
    },
  };
}

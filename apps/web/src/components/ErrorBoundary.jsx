import React from 'react';

/**
 * playZ — last line of defence
 * ============================================================================
 * The failure this exists for: the application threw during mount, React
 * unmounted the tree, and what remained was the page background. A black
 * rectangle with a green build, a clean dev server, and nothing in any log —
 * which is unreadable as a bug report and indistinguishable from "still
 * loading".
 *
 * An error boundary turns that into text. It is deliberately plain — inline
 * styles, no theme imports, no i18n — because whatever is broken might be the
 * theme, the context provider, or the translation layer, and a fallback that
 * depends on them can fail in exactly the situation it exists for.
 *
 * It renders in Vietnamese and English together for the same reason: the
 * language is a preference of the healthy app, not a fact available here.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the component stack — it names the file that threw, which the message
    // alone usually does not.
    this.setState({ info });
    try {
      // eslint-disable-next-line no-console
      console.error('[playZ] render crashed:', error, info);
    } catch { /* console unavailable */ }
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    const message = String(error?.message || error || 'Unknown error');
    const stack = String(error?.stack || '').split('\n').slice(0, 6).join('\n');
    const where = String(info?.componentStack || '').split('\n').filter(Boolean).slice(0, 6).join('\n');

    return (
      <div style={{
        position: 'fixed', inset: 0, overflowY: 'auto',
        background: '#08080A', color: '#F5F5F7',
        fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, sans-serif',
        padding: '32px 20px', display: 'flex', justifyContent: 'center',
      }}>
        <div style={{ width: '100%', maxWidth: 620 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <span style={{
              display: 'inline-flex', width: 34, height: 34, borderRadius: 9,
              background: '#2F6BFF', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em',
            }}>Z</span>
            <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em' }}>playZ</span>
          </div>

          <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>
            Ứng dụng gặp lỗi khi hiển thị
          </p>
          <p style={{ fontSize: 13, color: '#8A8A99', margin: '0 0 20px', lineHeight: 1.6 }}>
            The app hit an error while rendering. Chi tiết ở dưới — gửi nguyên phần này là đủ để tìm ra chỗ hỏng.
          </p>

          <div style={{
            background: '#101014', border: '1px solid #24242C', borderRadius: 12,
            padding: 14, marginBottom: 12, fontSize: 12,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            color: '#FF8A8F', wordBreak: 'break-word', lineHeight: 1.55,
          }}>
            {message}
          </div>

          {(stack || where) && (
            <pre style={{
              background: '#101014', border: '1px solid #24242C', borderRadius: 12,
              padding: 14, marginBottom: 18, overflowX: 'auto', fontSize: 11,
              lineHeight: 1.6, color: '#7C7C8A', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              whiteSpace: 'pre-wrap',
            }}>{[stack, where].filter(Boolean).join('\n\n')}</pre>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 18px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: '#2F6BFF', color: '#fff', fontSize: 13, fontWeight: 700,
                fontFamily: 'inherit',
              }}
            >
              Tải lại trang
            </button>
            <button
              type="button"
              onClick={() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} window.location.reload(); }}
              style={{
                padding: '10px 18px', borderRadius: 999, cursor: 'pointer',
                background: 'transparent', border: '1px solid #33333E', color: '#D2D2DC',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              }}
            >
              Xoá dữ liệu lưu &amp; tải lại
            </button>
          </div>

          <p style={{ fontSize: 11.5, color: '#55555F', marginTop: 18, lineHeight: 1.6 }}>
            Nếu lỗi lặp lại sau khi xoá dữ liệu, báo lại kèm dòng chữ đỏ ở trên.
          </p>
        </div>
      </div>
    );
  }
}

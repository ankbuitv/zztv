/**
 * playZ — informational dialogs
 * ============================================================================
 * The second-tier navigation entries (Giới thiệu, Liên hệ) and the header's
 * download-app action need somewhere to go. Rather than routing to pages that
 * would each hold four lines of text, they open focused dialogs.
 *
 * The download dialog is honest about what it offers: it drives the browser's
 * PWA install prompt when one is available and otherwise explains how to
 * install — it never pretends a native build exists when one does not.
 */
import React, { useEffect, useState } from 'react';
import { Info, Mail, Download, ExternalLink, Share, Plus } from 'lucide-react';
import { color as C, radius } from './tokens';
import { Modal, Button } from './ui';
import { PlayzLogo } from './Logo';

const SUPPORT_EMAIL = 'support@thelac.dpdns.org';
const SITE = 'https://thelac.dpdns.org';

function Row({ label, value, href }) {
  return (
    <div className="flex items-start justify-between" style={{ padding: '9px 0', gap: 16, borderBottom: `1px solid ${C.line}` }}>
      <span style={{ fontSize: 12.5, color: C.textMuted, flexShrink: 0 }}>{label}</span>
      {href ? (
        <a href={href} style={{ fontSize: 12.5, color: C.blueSoft, fontWeight: 700, textAlign: 'right', wordBreak: 'break-all' }}>
          {value}
        </a>
      ) : (
        <span style={{ fontSize: 12.5, color: C.text, fontWeight: 600, textAlign: 'right' }}>{value}</span>
      )}
    </div>
  );
}

function About() {
  return (
    <div>
      <div className="flex items-center" style={{ gap: 12, marginBottom: 16 }}>
        <PlayzLogo size={34} tint="#fff" />
      </div>
      <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.75, marginBottom: 18 }}>
        playZ là nền tảng xem truyền hình và phim đa nền tảng — web, điện thoại và Android TV.
        Xem trực tiếp hơn 180 kênh, phim và TV Shows, cùng dữ liệu thể thao cập nhật liên tục.
      </p>
      <Row label="Phiên bản" value="1.0.0" />
      <Row label="Website" value="thelac.dpdns.org" href={SITE} />
      <Row label="Hạ tầng" value="Cloudflare Workers · D1 · R2" />
      <Row label="Nền tảng" value="Web · Android · Android TV" />
      <p style={{ fontSize: 11.5, color: C.textFaint, lineHeight: 1.7, marginTop: 16 }}>
        Nội dung phát được cung cấp bởi bên thứ ba. playZ không lưu trữ tệp video trên hạ tầng
        của mình và không kiểm duyệt nội dung từ các nguồn bên ngoài.
      </p>
    </div>
  );
}

function Contact() {
  return (
    <div>
      <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.75, marginBottom: 18 }}>
        Cần hỗ trợ về tài khoản, gói cước hoặc báo lỗi kênh? Liên hệ theo các kênh dưới đây.
      </p>
      <Row label="Hỗ trợ chung" value={SUPPORT_EMAIL} href={`mailto:${SUPPORT_EMAIL}`} />
      <Row label="Báo lỗi kênh" value="Trong app → nút “Báo kênh lỗi”" />
      <Row label="Thời gian phản hồi" value="Trong vòng 24 giờ" />
      <p style={{ fontSize: 11.5, color: C.textFaint, lineHeight: 1.7, marginTop: 16 }}>
        Vui lòng không gửi mật khẩu hoặc mã xác thực qua email.
      </p>
    </div>
  );
}

function InstallApp({ onClose }) {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Chrome/Edge/Android fire beforeinstallprompt; capture it so the button
    // can trigger the real OS install flow.
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // Already running as an installed app?
    try {
      if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
        setInstalled(true);
      }
    } catch { /* ignore */ }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const doInstall = async () => {
    if (!prompt) return;
    prompt.prompt();
    try { await prompt.userChoice; } catch { /* user dismissed */ }
    setPrompt(null);
    onClose && onClose();
  };

  return (
    <div>
      {installed ? (
        <div className="flex items-center" style={{ gap: 10, padding: '14px 0' }}>
          <span style={{ color: '#22C55E' }}><Download size={20} /></span>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>
            playZ đang chạy ở chế độ ứng dụng đã cài.
          </p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.75, marginBottom: 16 }}>
            Cài playZ như một ứng dụng — mở toàn màn hình, có biểu tượng riêng trên màn hình chính,
            không cần qua cửa hàng ứng dụng.
          </p>

          {prompt ? (
            <Button variant="cta" size="lg" icon={Download} full onClick={doInstall}>
              Cài đặt ngay
            </Button>
          ) : (
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: radius.md, padding: 16 }}>
              <p style={{ fontSize: 12.5, fontWeight: 800, color: C.text, marginBottom: 12 }}>
                Cài thủ công
              </p>
              <div className="flex items-start" style={{ gap: 9, marginBottom: 10 }}>
                <Share size={15} style={{ color: C.blueSoft, marginTop: 2, flexShrink: 0 }} />
                <p style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.6 }}>
                  <b style={{ color: C.text }}>iPhone / iPad:</b> mở Safari → nút Chia sẻ → “Thêm vào màn hình chính”.
                </p>
              </div>
              <div className="flex items-start" style={{ gap: 9 }}>
                <Plus size={15} style={{ color: C.blueSoft, marginTop: 2, flexShrink: 0 }} />
                <p style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.6 }}>
                  <b style={{ color: C.text }}>Android / Chrome:</b> menu ⋮ → “Cài đặt ứng dụng” hoặc “Thêm vào màn hình chính”.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function InfoModal({ open, onClose, kind }) {
  const titles = { about: 'Giới thiệu playZ', contact: 'Liên hệ', app: 'Tải ứng dụng' };
  const icons = { about: Info, contact: Mail, app: Download };
  const Icon = icons[kind] || Info;

  return (
    <Modal open={!!open && !!kind} onClose={onClose} title={titles[kind] || 'Thông tin'} width={480}>
      {kind === 'about' && <About />}
      {kind === 'contact' && <Contact />}
      {kind === 'app' && <InstallApp onClose={onClose} />}
    </Modal>
  );
}

export { SUPPORT_EMAIL, SITE };

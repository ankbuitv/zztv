/**
 * playZ — logo components (compatibility layer)
 * ============================================================================
 * This file previously rendered the playZ lockup from a remotely hosted
 * image plus hardcoded "playZ" / "PL▷Y" text, with a third-party "reward" badge
 * beside it. All of that is gone.
 *
 * The public API is unchanged — same default export, same `size` values, same
 * `showSubtext` flag — so none of the nine components that import it needed to
 * change. Only the rendering is new.
 *
 * The real mark lives in `src/playz/Logo.jsx`; this is the legacy call-site
 * adapter around it.
 */
import React from 'react';
import { getAvatar } from '../contexts/ProfileContext';
import { useI18n } from '../contexts/I18nContext';
import { PlayzMark, PlayzWordmark } from '../playz/Logo';

// Kept as exports for backwards compatibility with existing imports. They now
// point at local playZ assets rather than a third-party image host, so the
// logo can never fail to load or silently show another brand.
export const MAIN_LOGO_URL = '/brand/playz-symbol-dark.svg';
export const MAIN_LOGO_SVG = '/brand/playz-symbol-dark.svg';

const SIZE = {
  sm: { mark: 24, word: 15 },
  md: { mark: 32, word: 20 },
  lg: { mark: 40, word: 25 },
  xl: { mark: 56, word: 34 },
};

export default function Logo({ size = 'md', showSubtext = true, className = '' }) {
  const { t } = useI18n();
  const s = SIZE[size] || SIZE.md;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <PlayzMark size={s.mark} tint="#fff" />
      <div className="flex flex-col leading-none min-w-0">
        <PlayzWordmark height={s.word} tint="#fff" />
        {showSubtext && (
          <span className="hidden md:block text-[8px] font-semibold tracking-[0.14em] text-stone-500 mt-1.5 uppercase truncate">
            {t('app.tagline')}
          </span>
        )}
      </div>
    </div>
  );
}

/** Bare mark without the wordmark — for compact placements. */
export function LogoMark({ size = 32, className = '' }) {
  return <PlayzMark size={size} tint="#fff" className={className} />;
}

export function AvatarBubble({ avatarId, size = 'lg', name = '', ring = false }) {
  const a = getAvatar(avatarId);
  const sizeCls = {
    sm: 'w-8 h-8 text-base rounded-md',
    md: 'w-12 h-12 text-xl rounded-md',
    lg: 'w-24 h-24 md:w-32 md:h-32 text-3xl md:text-4xl rounded-lg',
    xl: 'w-40 h-40 text-5xl rounded-xl',
  }[size];

  const initial = (name || '?')[0].toUpperCase();

  return (
    <div className={`${sizeCls} aspect-square bg-gradient-to-br ${a.color} flex items-center justify-center text-white relative overflow-hidden ${ring ? 'ring-4 ring-white shadow-2xl' : ''}`}>
      <span className="relative z-10 font-bold">{a.emoji || initial}</span>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { Search, X, Clock, Radio, Play } from 'lucide-react';
import { formatTimeHHMM, parseEpgDate } from '../utils/dateUtils';
import { useI18n } from '../contexts/I18nContext';

export default function SearchEPG({ epgData, channels, onPlayCatchup, onSelectChannel }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    if (!query.trim() || !epgData?.programmes) return [];
    const q = query.toLowerCase();
    return epgData.programmes
      .filter(p => p.title && p.title.toLowerCase().includes(q))
      .sort((a, b) => parseEpgDate(b.start) - parseEpgDate(a.start))
      .slice(0, 30)
      .map(p => {
        const ch = channels.find(c => c.channel_id === p.channel);
        const pStart = parseEpgDate(p.start);
        const pStop = parseEpgDate(p.stop);
        const now = new Date();
        return { ...p, channel: ch, pStart, pStop, isPast: pStop < now, isLive: pStart <= now && pStop >= now };
      });
  }, [query, epgData, channels]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#16161C]/60 border border-[#24242C]/50 rounded-xl text-xs text-[#9C9CAB] hover:text-white hover:border-[#24242C] transition-all">
        <Search className="w-3.5 h-3.5" /> {t('epg.search_prog')}
      </button>
    );
  }

  return (
    <div className="bg-[#13151c] border border-[#24242C]/40 rounded-xl p-3 space-y-2 anim-pop-fast">
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-[#7C7C8A] shrink-0" />
        <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('epg.search_ph')} className="flex-1 bg-transparent text-sm text-white placeholder:text-[#5A5A66] focus:outline-none" />
        <button onClick={() => { setOpen(false); setQuery(''); }} className="p-1 hover:bg-[#1E1E26] rounded"><X className="w-4 h-4 text-[#7C7C8A]" /></button>
      </div>
      {query.trim() && results.length > 0 && (
        <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => {
                if ((r.isPast || r.isLive) && r.channel) {
                  // Server xin token catchup (kèm thời điểm program) — client không build URL
                  onPlayCatchup && onPlayCatchup(r.channel, r);
                } else if (r.channel) {
                  onSelectChannel && onSelectChannel(r.channel);
                }
              }}
              className="w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[#1E1E26]/60 transition-all"
            >
              {r.channel?.logo && <img src={r.channel.logo} alt="" className="w-8 h-8 object-contain rounded bg-[#16161C] p-0.5 shrink-0" onError={e => e.target.style.display = 'none'} />}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{r.title}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-[#7C7C8A]">
                  <span>{r.channel?.name || ''}</span><span>·</span>
                  <Clock className="w-2.5 h-2.5" />
                  <span>{formatTimeHHMM(r.start)} - {formatTimeHHMM(r.stop)}</span>
                </div>
              </div>
              {r.isLive && <span className="px-1.5 py-px text-[9px] bg-[#2F6BFF] rounded text-white font-bold shrink-0">LIVE</span>}
              {r.isPast && <Play className="w-3 h-3 text-purple-400 shrink-0" />}
            </button>
          ))}
        </div>
      )}
      {query.trim() && results.length === 0 && <p className="text-xs text-[#5A5A66] text-center py-3">{t('epg.search_none')}</p>}
    </div>
  );
}

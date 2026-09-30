import React from 'react';
import { Heart, Radio, Play, Info } from 'lucide-react';
import FocusableWrapper from './FocusableWrapper';

export default function ChannelCard({
  channel,
  isSelected = false,
  isFavorite = false,
  onSelect,
  onToggleFavorite,
  onShowInfo,
  epgNow = null,
}) {
  return (
    <FocusableWrapper
      onClick={() => onSelect(channel)}
      className={`group relative rounded-xl bg-[#13151c] border p-3 flex flex-col justify-between overflow-hidden shadow-md transition-all duration-200 ${
        isSelected ? 'border-[#2F6BFF]/70 bg-[#7a2f0e]/15 shadow-[#2F6BFF]/15' : 'border-[#24242C]/40 hover:border-[#24242C]/60'
      }`}
    >
      <div className="absolute top-2 right-2 flex items-center gap-0.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
        {onShowInfo && (
          <button onClick={(e) => { e.stopPropagation(); onShowInfo(); }} className="p-1 rounded-full bg-black/30 hover:bg-blue-600/80 text-[#7C7C8A] hover:text-white">
            <Info className="w-3 h-3" />
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(channel.channel_id); }} className="p-1 rounded-full bg-black/30 hover:bg-black/60 text-[#7C7C8A] hover:text-[#2F6BFF]">
          <Heart className={`w-3 h-3 ${isFavorite ? 'fill-[#2F6BFF] text-[#2F6BFF]' : ''}`} />
        </button>
      </div>

      {/* Always visible favorite when selected */}
      <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(channel.channel_id); }} className={`absolute top-2 right-2 p-1 rounded-full bg-black/30 text-[#7C7C8A] hover:text-[#2F6BFF] z-20 ${isFavorite || isSelected ? '' : 'hidden'} group-hover:hidden`}>
        <Heart className={`w-3 h-3 ${isFavorite ? 'fill-[#2F6BFF] text-[#2F6BFF]' : ''}`} />
      </button>

      <div className="flex items-center gap-2.5 mb-2">
        <div className="relative w-11 h-11 rounded-lg bg-[#0d0e12] p-1.5 border border-[#24242C]/30 shrink-0 flex items-center justify-center overflow-hidden">
          <img src={channel.logo || '/brand/playz-symbol-dark.svg'} alt={channel.name} className="w-full h-full object-contain transition-transform group-hover:scale-105" onError={e => { e.target.src = '/brand/playz-symbol-dark.svg'; }} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[9px] font-bold text-[#2F6BFF]/80 uppercase tracking-widest block mb-0.5">{channel.group_title || 'TỔNG HỢP'}</span>
          <h3 className="font-bold text-white text-[13px] truncate group-hover:text-[#6E9BFF]/90 transition-colors">{channel.name}</h3>
        </div>
      </div>

      <div className="bg-[#0d0e12]/50 rounded-lg p-2 border border-[#24242C]/20 mt-auto">
        <div className="flex items-center justify-between text-[9px] text-[#7C7C8A] font-medium mb-0.5">
          <span className="flex items-center gap-0.5 text-emerald-500/90 font-semibold"><Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE</span>
          <Play className="w-2.5 h-2.5 text-[#5A5A66] group-hover:text-[#2F6BFF]/70 transition-colors" />
        </div>
        <p className="text-[10px] font-medium text-[#D2D2DC] truncate">{epgNow ? epgNow.title : 'Đang phát'}</p>
      </div>
    </FocusableWrapper>
  );
}

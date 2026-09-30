/**
 * playZ — TV player core (extracted)
 * ============================================================================
 * This component is MOVED, not rewritten. It carries the streaming logic that
 * makes the product work: Shaka for DASH, hls.js for HLS, playback-token
 * rotation for protected streams, upstream fallback, quality/audio/subtitle
 * track selection, and the zoom modes.
 *
 * It was previously inlined at the top of TVPage.jsx. Extracting it means the
 * new TV page and the legacy page share exactly one implementation — a second
 * copy would drift, and the drift would show up as streams failing on one page
 * but not the other.
 *
 * Behaviour is unchanged. To alter streaming, change it here and both pages
 * inherit the fix.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import shaka from 'shaka-player';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, Settings, Hd, Languages, Captions, X, ZoomIn, ChevronsRight, AlertTriangle, RefreshCw } from 'lucide-react';
import { isHlsUrl, isProxiedStreamUrl, getRotateAtMs, getCatchupAt, refreshStreamToken, makeStreamRequestFilter, applyStreamClientHeaders, fallbackToDirectUrl, isDashChannel } from '../services/streamGuard';
import { isCriticalShakaError } from '../services/telemetry';
import useVideoZoom from '../hooks/useVideoZoom';
import StreamWatermark from './StreamWatermark';

export default function SimpleHlsPlayer({ streamUrl, channel, onError, onRetry }) {
  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const hlsRef = useRef(null);
  const shakaRef = useRef(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(100);
  const [buffering, setBuffering] = useState(true);
  const [error, setError] = useState(null);
  const zoom = useVideoZoom();
  const [ctrlOn, setCtrlOn] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('quality');
  const ctrlTimer = useRef(null);
  const flashCtrl = useCallback(() => {
    setCtrlOn(true);
    if (ctrlTimer.current) clearTimeout(ctrlTimer.current);
    ctrlTimer.current = setTimeout(() => setCtrlOn(false), 4000);
  }, []);
  useEffect(() => () => { if (ctrlTimer.current) clearTimeout(ctrlTimer.current); }, []);

  // quality/audio/subtitle
  const [hlsLevels, setHlsLevels] = useState([]);
  const [hlsLevel, setHlsLevel] = useState(-1);
  const [shakaTracks, setShakaTracks] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState(-1);
  const [audioTracks, setAudioTracks] = useState([]);
  const [selectedAudio, setSelectedAudio] = useState(-1);
  const [textTracks, setTextTracks] = useState([]);
  const [selectedText, setSelectedText] = useState(-1);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;
    let cancelled = false;
    setError(null);
    setBuffering(true);
    const proxied = isProxiedStreamUrl(streamUrl);
    const isHls = isHlsUrl(streamUrl) || proxied;
    const dash = isDashChannel(channel, streamUrl);
    let rotateTimer = null;
    let directTried = false;
    const tryDirectFallback = async (hlsOrNull) => {
      if (directTried || !proxied || !channel) return false;
      directTried = true;
      const atStored = getCatchupAt(channel.channel_id) || 0;
      const fresh = await fallbackToDirectUrl(channel, atStored).catch(() => "");
      if (cancelled || !fresh) return false;
      if (hlsOrNull) hlsOrNull.loadSource(fresh);
      else { video.src = fresh; video.play().catch(() => {}); }
      return true;
    };
    const cleanup = () => {
      if (rotateTimer) { clearTimeout(rotateTimer); rotateTimer = null; }
      try { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } } catch {}
      try { if (shakaRef.current) { shakaRef.current.destroy(); shakaRef.current = null; } } catch {}
    };
    const scheduleRotate = () => {
      if (!channel) return;
      const rotateAt = getRotateAtMs(channel.channel_id);
      if (!rotateAt) return;
      if (rotateTimer) clearTimeout(rotateTimer);
      rotateTimer = setTimeout(async () => {
        if (cancelled) return;
        try {
          const atStored = getCatchupAt(channel.channel_id) || 0;
          const fresh = await refreshStreamToken(channel, atStored);
          if (cancelled || !fresh) return;
          if (hlsRef.current) hlsRef.current.loadSource(fresh);
          else if (shakaRef.current) await shakaRef.current.load(fresh);
          scheduleRotate();
        } catch (e) {
          if (e?.code === "PREVIEW_EXPIRED") {
            if (!cancelled) { setError(e.message || "Hết thời gian xem thử — nâng gói để xem tiếp."); setBuffering(false); }
            return;
          }
          if (!cancelled) rotateTimer = setTimeout(scheduleRotate, 20000);
        }
      }, Math.max(15000, rotateAt - Date.now()));
    };
    const loadShaka = async () => {
      try {
        shaka.polyfill.installAll();
        if (shaka.Player.isBrowserSupported()) {
          const player = new shaka.Player(video);
          shakaRef.current = player;
          try {
            const filter = makeStreamRequestFilter(channel);
            if (filter) player.getNetworkingEngine()?.registerRequestFilter(filter);
          } catch {}
          player.configure({
            streaming: {
              rebufferingGoal: 6,
              bufferingGoal: 30,
              bufferBehind: 60,
              lowLatencyMode: false,
              retryParameters: { maxAttempts: 6, baseDelay: 800, timeout: 15000 },
            },
            abr: { enabled: true },
            manifest: { retryParameters: { maxAttempts: 3, baseDelay: 1000 } },
          });
          const ckId = channel?.clearKeyId || channel?.clear_key_id;
          const ckKey = channel?.clearKey || channel?.clear_key;
          if (ckId && ckKey) {
            const kid = String(ckId).replace(/[^a-f0-9]/gi, '');
            const k = String(ckKey).replace(/[^a-f0-9]/gi, '');
            if (kid.length === 32 && k.length === 32) {
              try { player.configure({ drm: { clearKeys: { [kid]: k } } }); } catch {}
            }
          }
          player.addEventListener('buffering', (e) => { if (!cancelled) setBuffering(e.buffering); });
          player.addEventListener('error', (e) => {
            if (cancelled) return;
            if (dash && !isCriticalShakaError(e.detail)) return;
            const msg = e.detail?.message || 'Không phát được kênh này';
            setError(msg); setBuffering(false); onError && onError(msg);
          });
          await player.load(streamUrl);
          if (!cancelled) {
            scheduleRotate();
            try {
              const all = player.getVariantTracks();
              setShakaTracks(all || []);
              const active = all.find(t => t.active);
              if (active) setSelectedTrack(active.id);
              const audios = [];
              const seen = new Set();
              (all || []).forEach((tr, idx) => {
                const lang = tr.language || '';
                if (!seen.has(lang)) {
                  seen.add(lang);
                  audios.push({ id: idx, lang: lang || 'und', label: lang ? lang.toUpperCase() : `Audio ${idx+1}`, active: !!tr.active });
                }
              });
              try {
                const langs = player.getAudioLanguages();
                if (langs && langs.length) {
                  setAudioTracks(langs.map((l,i)=>({ id:i, lang:l, label:l.toUpperCase(), active: all.some(t=>t.active && t.language===l) })));
                } else setAudioTracks(audios);
              } catch { setAudioTracks(audios); }
              const txt = player.getTextTracks() || [];
              setTextTracks(txt.map((tr,i)=>({ id: tr.id ?? i, lang: tr.language || 'und', label: tr.label || tr.language || `Sub ${i+1}`, active: !!tr.active })));
              const activeTxt = txt.find(t=>t.active);
              setSelectedText(activeTxt ? (activeTxt.id ?? -1) : -1);
            } catch {}
            try { await video.play(); setPlaying(true); } catch { setPlaying(false); }
            setBuffering(false);
          }
        } else {
          video.src = streamUrl;
          video.addEventListener('waiting', () => !cancelled && setBuffering(true));
          video.addEventListener('playing', () => !cancelled && setBuffering(false));
          video.addEventListener('error', () => { if (cancelled || !proxied) return; tryDirectFallback(null); });
          try { await video.play(); setPlaying(true); } catch { setPlaying(false); }
          setBuffering(false);
        }
      } catch (err) {
        if (!cancelled) {
          const m = String(err?.message || err || 'Lỗi tải luồng');
          setError(m); setBuffering(false); onError && onError(m);
        }
      }
    };
    const init = async () => {
      try {
        if (isHls && Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 60,
            maxBufferLength: 30,
            maxMaxBufferLength: 120,
            maxBufferSize: 60 * 1000 * 1000,
            liveSyncDurationCount: 3,
            abrEwmaDefaultEstimate: 800000,
            fragLoadingMaxRetry: 6,
            levelLoadingMaxRetry: 4,
            manifestLoadingMaxRetry: 4,
            fragLoadingMaxRetryTimeout: 8000,
            xhrSetup: (xhr, url) => {
              if (!isProxiedStreamUrl(url)) return;
              const h = applyStreamClientHeaders({}, channel);
              Object.entries(h).forEach(([k, v]) => { try { xhr.setRequestHeader(k, v); } catch {} });
            },
          });
          hlsRef.current = hls;
          hls.attachMedia(video);
          hls.on(Hls.Events.MEDIA_ATTACHED, () => { if (!cancelled) hls.loadSource(streamUrl); });
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (cancelled) return;
            const lvls = (hls.levels || []).map((l,i)=>({ id:i, height:l.height||0, width:l.width||0, bitrate:l.bitrate||0, label: l.height ? `${l.height}p` : `${Math.round((l.bitrate||0)/1000)}k` })).sort((a,b)=>b.height-a.height);
            setHlsLevels(lvls);
            setHlsLevel(hls.currentLevel ?? -1);
            try {
              const aTracks = (hls.audioTracks || []).map((at,i)=>({ id: at.id ?? i, lang: at.lang || at.name || 'und', label: at.name || at.lang || `Audio ${i+1}`, active: i===hls.audioTrack }));
              setAudioTracks(aTracks);
              setSelectedAudio(hls.audioTrack ?? -1);
            } catch {}
            try {
              const sTracks = (hls.subtitleTracks || []).map((st,i)=>({ id: st.id ?? i, lang: st.lang || st.name || 'und', label: st.name || st.lang || `Sub ${i+1}`, active: i===hls.subtitleTrack }));
              setTextTracks(sTracks);
              setSelectedText(hls.subtitleTrack ?? -1);
            } catch {}
            setBuffering(false);
            scheduleRotate();
            video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
          });
          hls.on(Hls.Events.LEVEL_SWITCHED, (evt,data)=>{ if (!cancelled) setHlsLevel(data.level ?? hls.currentLevel ?? -1); });
          hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (evt,data)=>{ if (!cancelled) { setSelectedAudio(data.id ?? hls.audioTrack ?? -1); setAudioTracks(prev=>prev.map((at,idx)=>({ ...at, active: idx===(data.id ?? hls.audioTrack) }))); } });
          hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (evt,data)=>{ if (!cancelled) { setSelectedText(data.id ?? hls.subtitleTrack ?? -1); setTextTracks(prev=>prev.map((st,idx)=>({ ...st, active: idx===(data.id ?? hls.subtitleTrack) }))); } });
          hls.on(Hls.Events.ERROR, (evt, data) => {
            if (cancelled) return;
            const st = data?.response?.code || 0;
            if (proxied && (st === 502 || st === 504)) { tryDirectFallback(hls).then((ok) => { if (!ok && !cancelled) hls.startLoad(); }); return; }
            if (proxied && (st === 401 || st === 403)) {
              const atStored = getCatchupAt(channel.channel_id) || 0;
              refreshStreamToken(channel, atStored).then((fresh) => { if (!cancelled && fresh) { hls.loadSource(fresh); scheduleRotate(); } }).catch(() => {});
              return;
            }
            if (data.fatal) {
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) { tryDirectFallback(hls).then((ok) => { if (!ok && !cancelled) hls.startLoad(); }); }
              else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
              else { cleanup(); loadShaka(); }
            }
          });
          return;
        }
        await loadShaka();
      } catch { await loadShaka(); }
    };
    init();
    return () => { cancelled = true; cleanup(); };
  }, [streamUrl, channel]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) { v.play().then(() => setPlaying(true)).catch(() => {}); }
    else { v.pause(); setPlaying(false); }
  }, []);
  const toggleMute = useCallback(() => {
    const v = videoRef.current; if (!v) return;
    v.muted = !v.muted; setMuted(v.muted);
  }, []);
  const changeVol = useCallback((e) => {
    const v = videoRef.current; const val = Number(e.target.value);
    setVol(val);
    if (v) {
      v.volume = val / 100;
      if (val === 0) { v.muted = true; setMuted(true); }
      else if (v.muted) { v.muted = false; setMuted(false); }
    }
  }, []);
  const goFullscreen = useCallback(() => {
    const el = videoRef.current?.parentElement;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }, []);

  const selectQuality = useCallback((id) => {
    if (hlsRef.current) {
      try { hlsRef.current.currentLevel = id; setHlsLevel(id); } catch {}
    }
    if (shakaRef.current) {
      try {
        const player = shakaRef.current;
        if (id === -1) { player.configure({ abr:{ enabled:true } }); setSelectedTrack(-1); }
        else {
          const tr = shakaTracks.find(t=>t.id===id);
          if (tr) { player.configure({ abr:{ enabled:false } }); player.selectVariantTrack(tr,true); setSelectedTrack(id); }
        }
      } catch {}
    }
    setShowSettings(false); flashCtrl();
  }, [shakaTracks, flashCtrl]);

  const selectAudio = useCallback((id) => {
    if (hlsRef.current) { try { hlsRef.current.audioTrack = id; setSelectedAudio(id); } catch {} }
    if (shakaRef.current) {
      try {
        const target = audioTracks.find(a=>a.id===id);
        if (target && target.lang) { shakaRef.current.selectAudioLanguage(target.lang); setSelectedAudio(id); }
      } catch {}
    }
    setShowSettings(false); flashCtrl();
  }, [audioTracks, flashCtrl]);

  const selectSub = useCallback((id) => {
    if (hlsRef.current) { try { hlsRef.current.subtitleTrack = id; setSelectedText(id); } catch {} }
    if (shakaRef.current) {
      try {
        const player = shakaRef.current;
        if (id===-1) { player.setTextTrackVisibility(false); setSelectedText(-1); }
        else {
          const all = player.getTextTracks() || [];
          const tr = all.find(t=>(t.id ?? -1)===id) || all[id];
          if (tr) { player.selectTextTrack(tr); player.setTextTrackVisibility(true); setSelectedText(id); }
        }
      } catch {}
    }
    setShowSettings(false); flashCtrl();
  }, [flashCtrl]);

  const hasQuality = hlsLevels.length>0 || shakaTracks.length>0;
  const hasAudio = audioTracks.length>1;
  const hasSubs = textTracks.length>0;

  return (
    <div ref={stageRef} className="relative w-full h-full bg-black group/video">
      <video
        ref={videoRef}
        className={`w-full h-full ${zoom.cls}`}
        playsInline
        autoPlay
        controls={false}
        controlsList="nodownload noplaybackrate noremoteplayback"
        disablePictureInPicture
        disableRemotePlayback
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => { togglePlay(); flashCtrl(); }}
        onDoubleClick={goFullscreen}
      />
      <StreamWatermark channel={channel} page="tv" containerRef={stageRef} buffering={buffering} />
      {buffering && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
          <div className="w-12 h-12 border-[3px] border-[#2F6BFF] border-t-transparent rounded-full animate-spin"></div>
          <span className="mt-3 text-[11px] text-white/60 font-bold tracking-widest">ĐANG TẢI...</span>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/85 p-6 text-center">
          <div className="max-w-sm">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#2F6BFF]/15 border border-[#2F6BFF]/30 flex items-center justify-center mb-3"><AlertTriangle className="w-7 h-7 text-[#6E9BFF]" /></div>
            <h3 className="text-white font-black text-[15px] mb-1">Không xem được</h3>
            <p className="text-[#9C9CAB] text-xs mb-1">{channel?.name}</p>
            <p className="text-[#7C7C8A] text-[11px] mb-4 line-clamp-3">{String(error).slice(0, 160)}</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => { setError(null); onRetry && onRetry(); }} className="px-4 py-2 rounded-full bg-[#2F6BFF] text-white text-xs font-bold flex items-center gap-1.5 hover:brightness-110"><RefreshCw className="w-3.5 h-3.5" /> Thử lại</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="absolute top-3 right-3 w-[300px] max-w-[90vw] bg-[#0f0f12]/95 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden z-30 shadow-2xl">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
            <span className="text-[12px] font-black text-white flex items-center gap-1.5"><Settings className="w-3.5 h-3.5 text-[#6E9BFF]" /> Cài đặt</span>
            <button onClick={() => setShowSettings(false)} className="p-1 rounded-full hover:bg-white/10"><X className="w-4 h-4 text-white/60" /></button>
          </div>
          <div className="flex gap-1 px-2 py-2 bg-black/30">
            {[
              { id:'quality', label:'Chất lượng', icon:Hd, show:hasQuality },
              { id:'audio', label:'Âm thanh', icon:Languages, show:hasAudio },
              { id:'subtitle', label:'Phụ đề', icon:Captions, show:true },
              { id:'size', label:'Khung', icon:Monitor, show:true },
            ].filter(t=>t.show).map(tab=>(
              <button key={tab.id} onClick={()=>setSettingsTab(tab.id)} className={`flex-1 flex flex-col items-center gap-1 px-2 py-2 rounded-xl text-[10px] font-bold transition ${settingsTab===tab.id ? 'bg-[#2F6BFF] text-white' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}>
                <tab.icon className="w-4 h-4" />{tab.label}
              </button>
            ))}
          </div>
          <div className="max-h-[300px] overflow-y-auto p-2">
            {settingsTab==='quality' && (
              <div className="space-y-1">
                <button onClick={()=>selectQuality(-1)} className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between ${(hlsLevel===-1 && selectedTrack===-1) ? 'bg-[#2F6BFF] text-white font-bold' : 'text-white/70 hover:bg-white/10'}`}>
                  <span className="flex items-center gap-2"><Hd className="w-3.5 h-3.5" /> Tự động</span>
                </button>
                {hlsLevels.map(lv=>(
                  <button key={lv.id} onClick={()=>selectQuality(lv.id)} className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex justify-between ${hlsLevel===lv.id ? 'bg-[#2F6BFF] text-white font-bold' : 'text-white/70 hover:bg-white/10'}`}>
                    <span>{lv.label}</span><span className="text-[10px] opacity-60">{lv.bitrate ? `${Math.round(lv.bitrate/1000)}k` : ''}</span>
                  </button>
                ))}
                {hlsLevels.length===0 && shakaTracks.map(tr=>(
                  <button key={tr.id} onClick={()=>selectQuality(tr.id)} className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex justify-between ${selectedTrack===tr.id ? 'bg-[#2F6BFF] text-white font-bold' : 'text-white/70 hover:bg-white/10'}`}>
                    <span>{tr.height ? `${tr.height}p` : `Track ${tr.id}`}</span><span className="text-[10px] opacity-60">{Math.round((tr.bandwidth||0)/1000)}k</span>
                  </button>
                ))}
                {!hasQuality && <p className="text-[11px] text-[#7C7C8A] px-3 py-4 text-center">Chỉ có 1 chất lượng</p>}
              </div>
            )}
            {settingsTab==='audio' && (
              <div className="space-y-1">
                {audioTracks.map((at,idx)=>(
                  <button key={idx} onClick={()=>selectAudio(at.id)} className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex justify-between ${(selectedAudio===at.id || at.active) ? 'bg-[#2F6BFF] text-white font-bold' : 'text-white/70 hover:bg-white/10'}`}>
                    <span className="flex items-center gap-2"><Languages className="w-3.5 h-3.5" /> {at.label}</span><span className="text-[10px] opacity-60">{at.lang}</span>
                  </button>
                ))}
                {audioTracks.length===0 && <p className="text-[11px] text-[#7C7C8A] px-3 py-4 text-center">Không có audio khác</p>}
              </div>
            )}
            {settingsTab==='subtitle' && (
              <div className="space-y-1">
                <button onClick={()=>selectSub(-1)} className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center gap-2 ${selectedText===-1 ? 'bg-[#2F6BFF] text-white font-bold' : 'text-white/70 hover:bg-white/10'}`}><X className="w-3.5 h-3.5" /> Tắt phụ đề</button>
                {textTracks.map((st,idx)=>(
                  <button key={idx} onClick={()=>selectSub(st.id)} className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex justify-between ${(selectedText===st.id || st.active) ? 'bg-[#2F6BFF] text-white font-bold' : 'text-white/70 hover:bg-white/10'}`}>
                    <span className="flex items-center gap-2"><Captions className="w-3.5 h-3.5" /> {st.label}</span><span className="text-[10px] opacity-60">{st.lang}</span>
                  </button>
                ))}
                {textTracks.length===0 && <p className="text-[11px] text-[#7C7C8A] px-3 py-4 text-center">Không có phụ đề</p>}
              </div>
            )}
            {settingsTab==='size' && (
              <div className="space-y-1">
                {zoom.modes.map(m=>(
                  <button key={m.id} onClick={()=>{ zoom.setMode(m.id); setShowSettings(false); flashCtrl(); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex justify-between ${zoom.mode===m.id ? 'bg-[#2F6BFF] text-white font-bold' : 'text-white/70 hover:bg-white/10'}`}>
                    <span className="flex items-center gap-2"><ZoomIn className="w-3.5 h-3.5" /> {m.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity flex items-center gap-2 ${ctrlOn ? 'opacity-100' : 'opacity-0 pointer-events-none group-hover/video:opacity-100 group-hover/video:pointer-events-auto group-focus-within/video:opacity-100 group-focus-within/video:pointer-events-auto'}`}>
        <button onClick={togglePlay} className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur">{playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}</button>
        <button onClick={toggleMute} className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur">{muted || vol === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</button>
        <input type="range" min={0} max={100} value={muted ? 0 : vol} onChange={changeVol} className="w-24 accent-[#2F6BFF]" />
        <div className="ml-auto flex items-center gap-2">
          <button onClick={()=>{ setShowSettings(v=>!v); setSettingsTab('quality'); flashCtrl(); }} className={`p-2.5 rounded-full backdrop-blur ${showSettings ? 'bg-[#2F6BFF] text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}><Settings className="w-4 h-4" /></button>
          <button onClick={() => { zoom.cycle(); flashCtrl(); }} title={`Khung hình: ${zoom.label}`} className="flex items-center gap-1.5 px-3 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur">
            <ZoomIn className="w-4 h-4" />
            <span className="text-[10px] font-bold hidden sm:inline">{zoom.label}</span>
          </button>
          <button onClick={goFullscreen} className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur"><Maximize className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueueItem {
  id: string;
  youtubeId: string;
  title: string;
  addedBy: string;
  duration: number;
}

interface MusicState {
  queue: QueueItem[];
  currentSong: QueueItem | null;
  isPlaying: boolean;
  startedAt: number;
  serverTime: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractYoutubeId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const ytHosts = ["www.youtube.com", "youtube.com", "music.youtube.com"];
    if (ytHosts.includes(url.hostname) && url.pathname === "/watch")
      return url.searchParams.get("v") ?? null;
    if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
    if (ytHosts.includes(url.hostname) && url.pathname.startsWith("/embed/"))
      return url.pathname.split("/embed/")[1]?.split("?")[0] || null;
  } catch { /* not a URL */ }
  return null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getStoredVolume(): number {
  if (typeof window === "undefined") return 50;
  const stored = sessionStorage.getItem("jukebox-volume");
  return stored ? parseInt(stored, 10) : 15;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MusicPlayer() {
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState<MusicState>({
    queue: [], currentSong: null, isPlaying: false, startedAt: 0, serverTime: 0,
  });
  const [urlInput, setUrlInput] = useState("");
  const [volume, setVolume] = useState(getStoredVolume);
  const [elapsed, setElapsed] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const toastShownRef = useRef(false);
  const [serverOffset, setServerOffset] = useState(0);

  // Track which song ID is currently loaded in the iframe
  // Only rebuild iframe when the SONG changes, not on every state update
  const [loadedSongId, setLoadedSongId] = useState<string | null>(null);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);

  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const currentSong = state.currentSong;

  // Desbloqueia áudio no mobile — envia playVideo durante gesto do usuário
  const unlockAudio = useCallback(() => {
    if (audioUnlocked) return;
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*"
      );
    }
    setAudioUnlocked(true);
  }, [audioUnlocked]);

  // -------------------------------------------------------------------------
  // Send volume to YouTube iframe
  // -------------------------------------------------------------------------

  const sendVolume = useCallback((vol: number) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: "setVolume", args: [vol] }), "*"
    );
  }, []);

  useEffect(() => {
    sendVolume(volume);
    if (typeof window !== "undefined") sessionStorage.setItem("jukebox-volume", volume.toString());
  }, [volume, sendVolume]);

  const handleIframeLoad = useCallback(() => {
    setTimeout(() => sendVolume(volume), 500);
    setTimeout(() => sendVolume(volume), 1500);
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      // Começar a escutar eventos do player e buscar duração agressivamente
      const requestInfo = () => {
        iframe.contentWindow?.postMessage(
          JSON.stringify({ event: "listening", id: 1 }), "*"
        );
        iframe.contentWindow?.postMessage(
          JSON.stringify({ event: "command", func: "getDuration", args: [] }), "*"
        );
        iframe.contentWindow?.postMessage(
          JSON.stringify({ event: "command", func: "getCurrentTime", args: [] }), "*"
        );
      };
      // Polls rápidos nos primeiros segundos para capturar duração cedo
      setTimeout(requestInfo, 1000);
      setTimeout(requestInfo, 2000);
      setTimeout(requestInfo, 3500);
      setTimeout(requestInfo, 5000);
    }
  }, [volume, sendVolume]);

  // -------------------------------------------------------------------------
  // Build iframe src ONLY when song changes
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!currentSong) {
      setLoadedSongId(null);
      setIframeSrc(null);
      return;
    }

    // Same song instance still playing — don't rebuild iframe
    if (currentSong.id === loadedSongId) return;

    // New song — calculate seek from server time
    const offset = serverOffset;
    const seek = state.startedAt > 0
      ? Math.max(0, Math.floor((Date.now() + offset - state.startedAt) / 1000))
      : 0;

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const src = `https://www.youtube.com/embed/${currentSong.youtubeId}?autoplay=1&controls=0&disablekb=1&modestbranding=1&start=${seek}&enablejsapi=1&rel=0&origin=${encodeURIComponent(origin)}&widget_referrer=${encodeURIComponent(origin)}`;

    setLoadedSongId(currentSong.id);
    setIframeSrc(src);
  }, [currentSong, state.startedAt, serverOffset, loadedSongId]);

  // -------------------------------------------------------------------------
  // WebSocket
  // -------------------------------------------------------------------------

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL ?? "http://localhost:3001";
    const socket = io(`${wsUrl}/music`, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("music:state", (incoming: MusicState) => {
      if (incoming.serverTime) {
        setServerOffset(incoming.serverTime - Date.now());
      }
      setState(incoming);
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, []);

  // Show toast notification when user arrives and music is playing
  useEffect(() => {
    if (toastShownRef.current) return;
    if (state.isPlaying && state.currentSong) {
      toastShownRef.current = true;
      setShowToast(true);
      const timer = setTimeout(() => setShowToast(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [state.isPlaying, state.currentSong]);

  // -------------------------------------------------------------------------
  // Progress timer
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!state.isPlaying || !state.startedAt) { setElapsed(0); return; }
    const tick = () => {
      setElapsed(Math.max(0, (Date.now() + serverOffset - state.startedAt) / 1000));
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [state.isPlaying, state.startedAt, serverOffset]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const addSong = useCallback((youtubeId: string, title: string, duration?: number) => {
    socketRef.current?.emit("music:add", { youtubeId, title, addedBy: "Anonymous", duration: duration || 0 });
  }, []);

  const handleAddUrl = useCallback(async () => {
    const id = extractYoutubeId(urlInput);
    if (!id) return;
    setUrlInput("");

    // Buscar título real via oEmbed API
    let title = `YouTube (${id})`;
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
      if (res.ok) {
        const data = await res.json();
        if (data.title) title = data.title;
      }
    } catch { /* fallback para título genérico */ }

    addSong(id, title);
  }, [urlInput, addSong]);

  const handleSkip = useCallback(() => { socketRef.current?.emit("music:skip"); }, []);
  const handleRemove = useCallback((id: string) => { socketRef.current?.emit("music:remove", { id }); }, []);
  const handleClearQueue = useCallback(() => { socketRef.current?.emit("music:clear"); }, []);

  // Detect song ended — poll iframe every 2s via postMessage
  // and listen for YouTube state change events
  const endedEmittedRef = useRef<string | null>(null);
  const durationSentRef = useRef<string | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (typeof event.data !== "string") return;
      try {
        const parsed = JSON.parse(event.data);
        // YouTube sends onStateChange with info: 0 when video ends
        if (parsed?.event === "onStateChange" && parsed?.info === 0) {
          if (state.currentSong && endedEmittedRef.current !== state.currentSong.id) {
            endedEmittedRef.current = state.currentSong.id;
            socketRef.current?.emit("music:ended");
          }
        }
        // YouTube sends info with currentTime and duration
        if (parsed?.info?.currentTime !== undefined && parsed?.info?.duration !== undefined) {
          const ct = parsed.info.currentTime as number;
          const dur = parsed.info.duration as number;

          // Enviar duração real ao backend se ainda não conhecida
          if (dur > 0 && state.currentSong && durationSentRef.current !== state.currentSong.id && (!state.currentSong.duration || state.currentSong.duration <= 0)) {
            durationSentRef.current = state.currentSong.id;
            socketRef.current?.emit("music:update-duration", { duration: dur });
          }

          // If near the end (within 2 seconds), trigger ended
          if (dur > 0 && ct > 0 && dur - ct < 2) {
            if (state.currentSong && endedEmittedRef.current !== state.currentSong.id) {
              endedEmittedRef.current = state.currentSong.id;
              socketRef.current?.emit("music:ended");
            }
          }
        }
      } catch { /* ignore non-JSON messages */ }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [state.currentSong]);

  // Reset flags when song changes
  useEffect(() => {
    endedEmittedRef.current = null;
    durationSentRef.current = null;
  }, [state.currentSong?.id]);

  // Poll YouTube iframe for current time every 2s
  useEffect(() => {
    if (!state.isPlaying) return;

    const poll = () => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      // Request playback info
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: "listening", id: 1 }), "*"
      );
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "getVideoData", args: [] }), "*"
      );
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "getCurrentTime", args: [] }), "*"
      );
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "getDuration", args: [] }), "*"
      );
    };

    const interval = setInterval(poll, 2000);
    poll(); // immediate first poll
    return () => clearInterval(interval);
  }, [state.isPlaying]);

  // Hard fallback: if duration known and elapsed > duration + 5s, force skip
  useEffect(() => {
    if (!state.isPlaying || !state.startedAt || !state.currentSong) return;
    const dur = state.currentSong.duration;
    if (!dur || dur <= 0) return;

    const check = () => {
      const now = Date.now() + serverOffset;
      const elapsedSec = (now - state.startedAt) / 1000;
      if (elapsedSec >= dur + 5 && state.currentSong && endedEmittedRef.current !== state.currentSong.id) {
        endedEmittedRef.current = state.currentSong.id;
        socketRef.current?.emit("music:ended");
      }
    };

    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, [state.isPlaying, state.startedAt, state.currentSong, serverOffset]);

  // -------------------------------------------------------------------------
  // Computed
  // -------------------------------------------------------------------------

  const songDuration = currentSong?.duration || 0;
  const progress = songDuration > 0 ? Math.min(1, elapsed / songDuration) : 0;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Show invite toast when no music playing on first visit
  useEffect(() => {
    if (toastShownRef.current) return;
    if (!state.isPlaying) {
      toastShownRef.current = true;
      setShowToast(true);
      const timer = setTimeout(() => setShowToast(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [state.isPlaying]);

  return (
    <>
      {/* Toast notification */}
      {showToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] animate-bounce">
          <button
            onClick={() => { setShowToast(false); setExpanded(true); unlockAudio(); }}
            className="flex items-center gap-3 px-4 py-3 bg-pixel-surface border-4 border-pixel-accent shadow-[4px_4px_0px_0px_rgba(233,69,96,0.5)] hover:bg-pixel-accent/20 transition-colors cursor-pointer"
          >
            <span className="font-pixel text-[14px]">&#9835;</span>
            <div>
              <p className="font-pixel text-[9px] text-pixel-accent">
                {state.isPlaying ? "A JHAM ESTA ROLANDO!" : "INICIE SUA JHAM AGORA!"}
              </p>
              <p className="font-pixel text-[9px] text-pixel-muted mt-0.5">
                {state.isPlaying
                  ? `Tocando: ${state.currentSong?.title ?? "..."}`
                  : "Clique para adicionar uma musica"
                }
              </p>
            </div>
            <span className="font-pixel text-[10px] text-pixel-muted">[X]</span>
          </button>
        </div>
      )}

      {/* Hidden iframe — always rendered, keeps music playing even minimized */}
      {iframeSrc && (
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          width={1}
          height={1}
          allow="autoplay; encrypted-media"
          title="YouTube audio"
          onLoad={handleIframeLoad}
          style={{ position: "fixed", top: 0, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none", zIndex: -1 }}
        />
      )}

      {/* Mobile: tap to unlock audio (autoplay is blocked on mobile) */}
      {!audioUnlocked && currentSong && iframeSrc && (
        <button
          onClick={unlockAudio}
          className="fixed top-10 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 px-5 py-2.5 bg-pixel-accent border-4 border-white/20 shadow-[0_0_20px_rgba(233,69,96,0.6)] animate-pulse cursor-pointer"
        >
          <span className="font-pixel text-[12px] text-white">&#9654;</span>
          <span className="font-pixel text-[9px] text-white">TAP TO PLAY</span>
        </button>
      )}

      {/* Minimized */}
      {!expanded && (
        <button
          onClick={() => { setExpanded(true); unlockAudio(); }}
          className="fixed bottom-16 left-6 z-50 flex items-center gap-2 bg-pixel-surface border-2 border-pixel-panel hover:border-pixel-accent transition-colors cursor-pointer"
          style={{ maxWidth: 280 }}
        >
          <div className="flex items-center gap-3 px-4 py-2.5 w-full">
            <span className="font-pixel text-[13px] text-pixel-accent shrink-0">&#9835;</span>
            <div className="flex-1 min-w-0">
              <span className="font-pixel text-[10px] text-pixel-text truncate block">
                {currentSong ? currentSong.title : "JUKEBOX"}
              </span>
              {currentSong && songDuration > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <div className="flex-1 h-1.5 bg-pixel-bg overflow-hidden">
                    <div className="h-full bg-pixel-accent transition-all duration-500" style={{ width: `${progress * 100}%` }} />
                  </div>
                  <span className="font-pixel text-[8px] text-pixel-muted shrink-0">
                    {formatTime(elapsed)}/{formatTime(songDuration)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </button>
      )}

      {/* Expanded */}
      {expanded && (
        <div className="fixed bottom-16 left-4 right-4 sm:right-auto sm:left-6 sm:bottom-16 z-50 w-auto sm:w-[380px] max-h-[60vh] sm:max-h-[500px] flex flex-col bg-pixel-surface border-4 border-pixel-panel shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between px-4 py-3 border-b-2 border-pixel-panel">
            <span className="font-pixel text-[13px] text-pixel-accent">&#9835; JUKEBOX</span>
            <button onClick={() => setExpanded(false)} className="font-pixel text-[11px] text-pixel-muted hover:text-pixel-accent transition-colors">[MINIMIZE]</button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {/* Now Playing */}
            <div>
              <p className="font-pixel text-[10px] text-pixel-muted uppercase mb-1.5">Now Playing</p>
              {currentSong ? (
                <div className="space-y-2">
                  <p className="font-pixel text-[11px] text-pixel-text truncate">{currentSong.title}</p>
                  <div className="space-y-1">
                    <div className="w-full h-2.5 bg-pixel-bg border border-pixel-panel overflow-hidden">
                      <div className="h-full bg-pixel-accent transition-all duration-500" style={{ width: `${progress * 100}%` }} />
                    </div>
                    <div className="flex justify-between">
                      <span className="font-pixel text-[9px] text-pixel-muted">{formatTime(elapsed)}</span>
                      <span className="font-pixel text-[9px] text-pixel-muted">{songDuration > 0 ? formatTime(songDuration) : "--:--"}</span>
                    </div>
                  </div>
                  {/* Volume */}
                  <div className="flex items-center gap-2">
                    <span className="font-pixel text-[9px] text-pixel-muted shrink-0">VOL</span>
                    <input type="range" min={0} max={100} value={volume}
                      onChange={(e) => setVolume(parseInt(e.target.value, 10))}
                      className="flex-1 h-1.5 cursor-pointer" style={{ accentColor: "#e94560" }} />
                    <span className="font-pixel text-[9px] text-pixel-muted shrink-0 w-7 text-right">{volume}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setVolume(volume > 0 ? 0 : 50)}>
                      {volume === 0 ? "UNMUTE" : "MUTE"}
                    </Button>
                    <Button variant="danger" size="sm" onClick={handleSkip}>SKIP &gt;&gt;</Button>
                  </div>
                </div>
              ) : (
                <p className="font-pixel text-[11px] text-pixel-muted">Nothing playing. Add a song!</p>
              )}
            </div>

            {/* Add URL */}
            <div>
              <p className="font-pixel text-[10px] text-pixel-muted uppercase mb-1.5">Add YouTube URL</p>
              <div className="flex gap-2">
                <Input placeholder="Paste YouTube URL..." className="text-[10px] py-1.5"
                  value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddUrl(); }} />
                <Button variant="primary" size="sm" onClick={handleAddUrl}>ADD</Button>
              </div>
            </div>

            {/* Queue (upcoming only) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="font-pixel text-[10px] text-pixel-muted uppercase">Up Next ({state.queue.length})</p>
                {state.queue.length > 0 && (
                  <Button variant="danger" size="sm" onClick={handleClearQueue}>CLEAR ALL</Button>
                )}
              </div>
              {state.queue.length === 0 ? (
                <p className="font-pixel text-[10px] text-pixel-muted">No upcoming songs</p>
              ) : (
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                  {state.queue.map((item, i) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-pixel-bg border border-pixel-panel/50">
                      <div className="flex-1 min-w-0">
                        <p className="font-pixel text-[10px] text-pixel-text truncate">
                          {i + 1}. {item.title}
                        </p>
                        <p className="font-pixel text-[9px] text-pixel-muted">
                          {item.addedBy} {item.duration > 0 && `· ${formatTime(item.duration)}`}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" className="shrink-0 text-red-400" onClick={() => handleRemove(item.id)}>X</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

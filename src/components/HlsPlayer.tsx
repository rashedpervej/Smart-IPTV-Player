import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Maximize, 
  HelpCircle, 
  Activity, 
  Info, 
  Globe, 
  AlertCircle, 
  ShieldAlert,
  ExternalLink,
  Copy,
  Check
} from "lucide-react";
import { PlaybackStatus } from "../types";

interface HlsPlayerProps {
  url: string;
  name: string;
  category: string;
  onStatusChange?: (status: PlaybackStatus) => void;
}

export default function HlsPlayer({ url, name, category, onStatusChange }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.8);
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [errorDetails, setErrorDetails] = useState<string>("");
  const [retryCount, setRetryCount] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);
  const [diagnostics, setDiagnostics] = useState<{
    type?: string;
    details?: string;
    fatal?: boolean;
    streamType?: string;
    mimeType?: string;
  }>({});
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const controlsTimeoutRef = useRef<any>(null);

  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2000);
  };

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const handleUserInteraction = () => {
    setShowControls(true);
    resetControlsTimeout();
  };

  const activeStreamRef = useRef<{ url: string; retryCount: number }>({ url: "", retryCount: 0 });

  // Trigger onStatusChange callback when status updates
  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(status);
    }
  }, [status, onStatusChange]);

  const loadStream = () => {
    const video = videoRef.current;
    if (!video) return;

    // Reset player state
    setStatus("loading");
    setErrorDetails("");
    setDiagnostics({});

    // Clean up previous HLS instance if any
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Determine stream type from url extension
    let isMp4 = false;
    let isMkv = false;
    try {
      const pathname = new URL(url).pathname.toLowerCase();
      isMp4 = pathname.endsWith(".mp4");
      isMkv = pathname.endsWith(".mkv");
    } catch {
      isMp4 = url.toLowerCase().includes(".mp4");
      isMkv = url.toLowerCase().includes(".mkv");
    }

    // Direct playback for MP4 or MKV if browser supports it
    if (isMp4 || isMkv) {
      video.src = url;
      video.play()
        .then(() => {
          if (activeStreamRef.current.url !== url || activeStreamRef.current.retryCount !== retryCount) return;
          setStatus("playing");
          setIsPlaying(true);
        })
        .catch((err) => {
          if (activeStreamRef.current.url !== url || activeStreamRef.current.retryCount !== retryCount) return;
          if (err.name === "AbortError") return;
          console.error("Native play error:", err);
          setStatus("error");
          setErrorDetails("This stream or file could not be played directly. Live stream links often expire or require specific network environments.");
        });
      setDiagnostics({
        streamType: isMp4 ? "MP4 Video" : "MKV Container File",
        details: "Direct native browser media source play",
        fatal: false
      });
      return;
    }

    // Playback for HLS (.m3u8) Streams
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
        appendErrorMaxRetry: 3,
      });

      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (activeStreamRef.current.url !== url || activeStreamRef.current.retryCount !== retryCount) return;
        setStatus("loading");
        video.play()
          .then(() => {
            if (activeStreamRef.current.url !== url || activeStreamRef.current.retryCount !== retryCount) return;
            setStatus("playing");
            setIsPlaying(true);
          })
          .catch((err) => {
            if (activeStreamRef.current.url !== url || activeStreamRef.current.retryCount !== retryCount) return;
            if (err.name === "AbortError") {
              console.log("Play request aborted (expected due to stream switch/reload).");
              return;
            }
            console.error("HLS play failed:", err);
            // Browser blocked autoplay
            setStatus("paused");
            setIsPlaying(false);
          });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (activeStreamRef.current.url !== url || activeStreamRef.current.retryCount !== retryCount) return;
        console.error("Hls.js Error:", data);
        setDiagnostics({
          type: data.type,
          details: data.details,
          fatal: data.fatal,
          streamType: "HLS (.m3u8)"
        });

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setErrorDetails(`Network connection error to stream server. (Details: ${data.details})`);
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setErrorDetails(`Media parsing/playback error. Attempting recovery...`);
              hls.recoverMediaError();
              break;
            default:
              setStatus("error");
              setErrorDetails(`The stream is currently offline, protected, or blocked. (Error: ${data.details})`);
              break;
          }
        }
      });

      // Update loading status based on buffering
      video.onwaiting = () => {
        if (activeStreamRef.current.url !== url || activeStreamRef.current.retryCount !== retryCount) return;
        setStatus("loading");
      };

      video.onplaying = () => {
        if (activeStreamRef.current.url !== url || activeStreamRef.current.retryCount !== retryCount) return;
        setStatus("playing");
      };

    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS support (Safari)
      video.src = url;
      video.onloadedmetadata = () => {
        if (activeStreamRef.current.url !== url || activeStreamRef.current.retryCount !== retryCount) return;
        video.play()
          .then(() => {
            if (activeStreamRef.current.url !== url || activeStreamRef.current.retryCount !== retryCount) return;
            setStatus("playing");
            setIsPlaying(true);
          })
          .catch((err) => {
            if (activeStreamRef.current.url !== url || activeStreamRef.current.retryCount !== retryCount) return;
            if (err.name === "AbortError") return;
            setStatus("paused");
            setIsPlaying(false);
          });
      };

      video.onerror = (e) => {
        if (activeStreamRef.current.url !== url || activeStreamRef.current.retryCount !== retryCount) return;
        setStatus("error");
        setErrorDetails("Safari direct stream error. The link might be offline or blocked.");
      };
    } else {
      setStatus("error");
      setErrorDetails("Custom HLS playback is not supported on this browser.");
    }
  };

  useEffect(() => {
    activeStreamRef.current = { url, retryCount };
    loadStream();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      const video = videoRef.current;
      if (video) {
        video.onwaiting = null;
        video.onplaying = null;
        video.onloadedmetadata = null;
        video.onerror = null;
        video.pause();
        video.removeAttribute("src");
        try {
          video.load();
        } catch (e) {
          console.warn("video.load abort error:", e);
        }
      }
    };
  }, [url, retryCount]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      setStatus("paused");
    } else {
      video.play()
        .then(() => {
          setIsPlaying(true);
          setStatus("playing");
        })
        .catch((err) => {
          console.error("Play requested failed:", err);
          setStatus("error");
        });
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const val = parseFloat(e.target.value);
    setVolume(val);
    video.volume = val;
    setIsMuted(val === 0);
    video.muted = val === 0;
  };

  const handleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.requestFullscreen) {
      video.requestFullscreen();
    } else if ((video as any).webkitRequestFullscreen) {
      (video as any).webkitRequestFullscreen();
    } else if ((video as any).msRequestFullscreen) {
      (video as any).msRequestFullscreen();
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  const handlePlayerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('.control-panel-intercept')) {
      return;
    }

    if (!showControls) {
      setShowControls(true);
      resetControlsTimeout();
    } else {
      togglePlay();
      resetControlsTimeout();
    }
  };

  // Determine error style or messaging
  const isDirectTsFile = url.endsWith(".ts");
  const isHttpsPage = typeof window !== "undefined" && window.location.protocol === "https:";
  const isHttpStream = url.toLowerCase().startsWith("http://");
  const isMixedContentError = isHttpsPage && isHttpStream;

  return (
    <div 
      className="relative group rounded-3xl bg-[#0e0e14] border border-zinc-900 shadow-2xl overflow-hidden aspect-video flex flex-col justify-between"
      onClick={handlePlayerClick}
      onMouseMove={handleUserInteraction}
      onTouchStart={handleUserInteraction}
    >
      {/* Aspect Video frame */}
      <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-black">
        <video
          ref={videoRef}
          className="w-full h-full object-contain cursor-pointer"
          playsInline
          autoPlay
          muted={isMuted}
        />
        
        {/* Banner Overlays & Messages (Ad-block warning, offline warnings, direct file info) */}
        {status === "loading" && (
          <div className="control-panel-intercept absolute inset-0 bg-[#07070a]/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 z-10 animate-in fade-in duration-200">
            <div className="relative flex items-center justify-center h-16 w-16 mb-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-20"></span>
              <span className="relative inline-flex rounded-full h-11 w-11 bg-gradient-to-br from-amber-500 to-amber-600 animate-pulse justify-center items-center text-stone-950 font-black text-sm shadow-lg shadow-amber-500/15">
                TV
              </span>
            </div>
            <p className="text-white font-extrabold text-lg tracking-tight">Connecting to TV Stream...</p>
            <p className="text-xs text-zinc-400 mt-2 max-w-sm leading-relaxed">Resolving stream URL container. Live IPTV streams may require up to 5-10 seconds to buffer.</p>
          </div>
        )}

        {status === "error" && (
          <div className="control-panel-intercept absolute inset-0 bg-[#07070a] flex flex-col items-center justify-center text-center p-6 md:p-8 z-10 overflow-y-auto animate-in fade-in duration-200">
            {isMixedContentError ? (
              <div className="max-w-xl flex flex-col items-center">
                <div className="p-2.5 bg-amber-500/15 text-amber-400 rounded-2xl mb-3 border border-amber-500/20 animate-pulse">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <h3 className="text-white font-bold text-sm md:text-base tracking-tight">🔒 ব্রাউজার সিকিউরিটি (Mixed Content) ব্লক!</h3>
                <p className="text-zinc-300 text-[11px] mt-2 px-1 text-center leading-relaxed">
                  স্ট্রীম লিঙ্কটি unencrypted <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-amber-400 font-mono text-[10px]">http://</code> ব্যবহার করছে কিন্তু প্লেয়ারটি secure <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-emerald-400 font-mono text-[10px]">https://</code> এ লোড হয়েছে। ব্রাউজার সিকিউরিটির জন্য এটি অটোমেটিক ব্লক করেছে। প্লেয়ারটি দুর্বল নয়, ব্রাউজার পলিসিই এর কারণ।
                </p>

                <div className="mt-3.5 w-full bg-[#0d0d14] border border-zinc-900/60 p-3 rounded-2xl text-left text-[10px] text-zinc-400 space-y-1.5 leading-relaxed">
                  <p className="font-extrabold text-amber-500 flex items-center gap-1 uppercase tracking-wider text-[9px]">💡 সমাধান করার ২টি সহজ উপায়:</p>
                  <div>
                    <span className="text-stone-200 font-bold">১. ইনসিকিউর কন্টেন্ট অনুমতি দিন (প্রস্তাবিত):</span>
                    <p className="pl-3.5 text-zinc-500">আপনার ব্রাউজার এড্রেস বারের বামের আইকনে (বা লক আইকনে) ক্লিক করুন &rarr; <span className="text-zinc-350 font-semibold">Site Settings</span> এ যান &rarr; <span className="text-zinc-350 font-semibold">Insecure content</span> অপশনটি <span className="text-amber-500 font-bold">Allow</span> সিলেক্ট করুন। এরপর পেজটি রিলোড দিন।</p>
                  </div>
                  <div>
                    <span className="text-stone-200 font-bold">২. বাহ্যিক প্লেয়ার বা নতুন ট্যাবে চালান:</span>
                    <p className="pl-3.5 text-zinc-500">নিচের বাটনে ক্লিক করে সরাসরি নতুন ট্যাবে অথবা VLC প্লেয়ারে লিঙ্কটি পেস্ট করে বাফারলেস উপভোগ করুন!</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(url);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-3 py-1.5 bg-zinc-850 hover:bg-zinc-800 text-white font-bold text-[11px] rounded-xl flex items-center gap-1.5 cursor-pointer border border-zinc-800 hover:border-zinc-700 transition-all"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-zinc-400" />}
                    {copied ? "Copied!" : "Copy Stream URL"}
                  </button>

                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-extrabold text-[11px] rounded-xl shadow-lg shadow-amber-500/10 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="h-3.5 w-3.5 stroke-[2.5]" />
                    নতুন ট্যাবে প্লে করুন 
                  </a>

                  <button
                    onClick={() => setShowDiagnostics(!showDiagnostics)}
                    className="px-3 py-1.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-400 font-bold text-[11px] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-zinc-800"
                  >
                    <Activity className="h-3.5 w-3.5 text-amber-500" />
                    Diagnostics
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-3 bg-rose-500/15 text-rose-500 rounded-2xl mb-4 border border-rose-500/20">
                  <ShieldAlert className="h-8 w-8" />
                </div>
                <h3 className="text-white font-bold text-lg">{name || "Channel"} is currently Offline</h3>
                <p className="text-zinc-400 text-xs mt-2 max-w-xl px-4 leading-relaxed">
                  {errorDetails || "No content received. The stream link might have expired, may be private, or requires a VPN if geo-blocked."}
                </p>

                {isDirectTsFile && (
                  <div className="mt-4 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg max-w-md text-left">
                    <p className="text-[11px] text-amber-400 font-medium flex items-center gap-1.5 leading-normal">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      Technical Note: This is a direct Transport Stream (.ts) format. Modern browsers often block native .ts files unless they are packaged into standard HLS.
                    </p>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2.5 justify-center">
                  <button
                    onClick={handleRetry}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/10 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5 stroke-[2.5]" />
                    Reload Stream
                  </button>
                  <button
                    onClick={() => setShowDiagnostics(!showDiagnostics)}
                    className="px-3.5 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Activity className="h-3.5 w-3.5" />
                    {showDiagnostics ? "Hide Diagnostics" : "Diagnose Link"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Diagnostics panel overlay */}
      {showDiagnostics && (
        <div 
          className="control-panel-intercept absolute top-4 left-4 right-4 bg-[#07070a]/95 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-4 text-left z-20 shadow-2xl animate-in fade-in slide-in-from-top-2" 
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-2.5 border-b border-zinc-800/80 pb-2">
            <h4 className="text-xs text-white font-extrabold flex items-center gap-1.5 uppercase tracking-wider">
              <Activity className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
              Player Diagnostic Logs
            </h4>
            <button 
              onClick={() => setShowDiagnostics(false)} 
              className="text-[10px] text-zinc-300 hover:text-white bg-[#161622] hover:bg-[#1e1e2d] px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="space-y-1.5 font-mono text-[10px] text-zinc-300">
            <div className="flex justify-between"><span className="text-zinc-500">Channel Name:</span> <span className="text-white font-semibold">{name}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Category:</span> <span className="text-white font-semibold">{category}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">URL Target:</span> <span className="text-blue-400 truncate max-w-[240px]" title={url}>{url}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Playback Engine:</span> <span className="text-white font-semibold">{Hls.isSupported() ? "hls.js Web Worker" : "Native Browser (HTML5)"}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Last Error Type:</span> <span className="text-rose-400 font-semibold">{diagnostics.type || "None"}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Fatal Condition:</span> <span className={diagnostics.fatal ? "text-rose-500 font-bold" : "text-emerald-400"}>{diagnostics.fatal ? "YES" : "NO"}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Format Detected:</span> <span className="text-amber-400 font-semibold">{diagnostics.streamType || "HLS Stream"}</span></div>
          </div>
          <div className="mt-3.5 text-[10px] text-zinc-500 border-t border-zinc-800/80 pt-2.5 leading-relaxed">
            💡 Many IPTV links are hosted on public servers with small bandwidth. If a link fails to play, it might be overloaded, or your browser might have blocked mixed HTTP/HTTPS content.
          </div>
        </div>
      )}

      {/* Top Bar overlay - Brand / Channel description */}
      <div 
        className={`control-panel-intercept absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start transition-opacity duration-300 z-10 ${showControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <div className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-amber-600 text-[10px] text-stone-950 font-black tracking-widest uppercase rounded">
            Live TV
          </div>
          <h2 className="text-xs font-extrabold text-white drop-shadow-md truncate max-w-[180px]">
            {name}
          </h2>
          <span className="text-[10px] text-stone-200 px-2 py-0.5 rounded-lg bg-zinc-900/60 backdrop-blur-md font-semibold tracking-wide border border-zinc-850">
            {category}
          </span>
        </div>
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDiagnostics(!showDiagnostics);
            }}
            className="p-1.5 px-2.5 bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800/80 backdrop-blur-sm rounded-lg text-zinc-200 hover:text-white transition-all text-[10px] font-bold flex items-center gap-1.5 cursor-pointer"
            title="Stream Debug Diagnostics"
          >
            <Activity className="h-3 w-3 text-amber-500" />
            Diagnostics
          </button>
        </div>
      </div>

      {/* Bottom custom custom controls panel */}
      <div 
        className={`control-panel-intercept absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#050508] to-transparent transition-opacity duration-300 z-10 flex flex-col gap-2 ${showControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pointer-events-auto">
          {/* Left Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all active:scale-95 cursor-pointer"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-white text-white" />}
            </button>

            <button
              onClick={handleRetry}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all active:scale-95 cursor-pointer"
              title="Restart Stream"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2 group/volume ml-1">
              <button
                onClick={toggleMute}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                {isMuted || volume === 0 ? <VolumeX className="h-3.5 w-3.5 text-rose-400" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 md:w-24 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500 scale-x-100 lg:scale-x-0 lg:group-hover/volume:scale-x-100 origin-left transition-transform duration-200"
              />
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-amber-400 font-mono tracking-wider flex items-center gap-1.5 justify-end bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              ONLINE
            </span>
            <button
              onClick={handleFullscreen}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all active:scale-95 cursor-pointer"
              title="Full Screen Mode"
            >
              <Maximize className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

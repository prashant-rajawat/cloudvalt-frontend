import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  Sliders,
  AlertCircle,
  Download,
  Loader2,
  Film
} from "lucide-react";
import { FileItem } from "../types/index.js";

interface VideoPlayerProps {
  file: FileItem;
  srcUrl: string;
  authToken?: string;
  onDownload?: () => void;
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoPlayer({ file, srcUrl, onDownload }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressTrackRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [useNativeControls, setUseNativeControls] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeUrl, setActiveUrl] = useState(srcUrl);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if browser natively claims support for this format
  const extension = file.extension?.toLowerCase() || (file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "");
  const isPotentiallyUnsupported = ["avi", "mkv", "wmv", "flv", "vob"].includes(extension || "");

  // Update activeUrl when srcUrl or file changes
  useEffect(() => {
    setActiveUrl(srcUrl);
    setErrorMessage(null);
    setIsLoading(true);
    setCurrentTime(0);
    setIsPlaying(false);
  }, [srcUrl, file.id]);

  // Clean up playback on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute("src");
        videoRef.current.load();
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Auto-hide controls when playing and inactive
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
      }, 3000);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused || videoRef.current.ended) {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
        setErrorMessage(null);
      }).catch((err) => {
        console.error("Video playback error:", err);
        // If autoplay / playback failed
        if (err.name === "NotSupportedError") {
          setErrorMessage("This video format is not supported by your browser.");
        }
      });
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current || isDragging) return;
    setCurrentTime(videoRef.current.currentTime);

    // Calculate buffer progress
    if (videoRef.current.buffered.length > 0 && videoRef.current.duration) {
      const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      setBufferedPercent(Math.min(100, (bufferedEnd / videoRef.current.duration) * 100));
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration || 0);
    setIsLoading(false);
    setIsBuffering(false);
    setErrorMessage(null);
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    setIsBuffering(false);
  };

  const handleWaiting = () => {
    setIsBuffering(true);
  };

  const handlePlaying = () => {
    setIsBuffering(false);
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setIsBuffering(false);
    const video = videoRef.current;
    if (video && video.error) {
      console.error("HTML5 Video Error code:", video.error.code, video.error.message);
      if (video.error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        if (isPotentiallyUnsupported) {
          setErrorMessage("This video format is not supported by your browser.");
        } else if (!activeUrl.includes("/api/storage/stream")) {
          // Attempt fallback to proxy stream
          const streamUrl = `/api/storage/stream?path=${encodeURIComponent(file.storagePath)}`;
          setActiveUrl(streamUrl);
          return;
        } else {
          setErrorMessage("This video format is not supported by your browser.");
        }
      } else if (video.error.code === MediaError.MEDIA_ERR_NETWORK) {
        setErrorMessage("A network error occurred while loading the video.");
      } else {
        setErrorMessage("Unable to load or decode this video file.");
      }
    } else {
      if (isPotentiallyUnsupported) {
        setErrorMessage("This video format is not supported by your browser.");
      } else {
        setErrorMessage("Unable to play video from storage.");
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressTrackRef.current || duration <= 0) return;
    const rect = progressTrackRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = pos * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSeekMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressTrackRef.current || duration <= 0) return;
    const rect = progressTrackRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(pos * duration);
    setHoverPosition(pos * 100);

    if (isDragging && videoRef.current) {
      const newTime = pos * duration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleSeekMouseLeave = () => {
    setHoverTime(null);
    setHoverPosition(null);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.muted = false;
      videoRef.current.volume = volume > 0 ? volume : 0.7;
      setIsMuted(false);
    } else {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const skipTime = (seconds: number) => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const changeSpeed = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
  };

  // Keyboard controls
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "ArrowRight" || e.key === "l") {
      e.preventDefault();
      skipTime(5);
    } else if (e.key === "ArrowLeft" || e.key === "j") {
      e.preventDefault();
      skipTime(-5);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const newVol = Math.min(1, volume + 0.1);
      setVolume(newVol);
      if (videoRef.current) videoRef.current.volume = newVol;
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const newVol = Math.max(0, volume - 0.1);
      setVolume(newVol);
      if (videoRef.current) videoRef.current.volume = newVol;
    } else if (e.key === "f") {
      e.preventDefault();
      toggleFullscreen();
    } else if (e.key === "m") {
      e.preventDefault();
      toggleMute();
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={`relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center select-none outline-none focus:ring-2 focus:ring-blue-500/50 ${
        isFullscreen ? "h-screen w-screen rounded-none" : "aspect-video max-h-[65vh]"
      }`}
    >
      {/* 1. HTML5 Video Element */}
      <video
        ref={videoRef}
        src={activeUrl}
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onPause={handlePause}
        onError={handleError}
        preload="metadata"
        playsInline
        controls={useNativeControls}
      />

      {/* 2. Loading / Buffering Spinner */}
      {(isLoading || isBuffering) && !errorMessage && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center pointer-events-none z-20">
          <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-3" />
          <p className="text-xs text-slate-200 font-medium tracking-wide">
            {isLoading ? "Loading media stream..." : "Buffering..."}
          </p>
        </div>
      )}

      {/* 3. Error Fallback State */}
      {errorMessage && (
        <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-30 animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-3 shadow-lg">
            <Film className="w-7 h-7" />
          </div>
          <h4 className="text-sm font-bold text-white mb-1">
            {errorMessage}
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mb-5 leading-relaxed">
            {isPotentiallyUnsupported
              ? `The file extension .${extension.toUpperCase()} may not be decodable by your web browser, but you can download it to view locally.`
              : "You can download the original file to view it in your device's media player."}
          </p>
          {onDownload && (
            <button
              onClick={onDownload}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" /> Download Video ({file.name})
            </button>
          )}
        </div>
      )}

      {/* 4. Center Play / Pause Big Button Overlay (When Paused) */}
      {!useNativeControls && !isPlaying && !isLoading && !errorMessage && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/25 transition-opacity duration-200 hover:bg-black/35 z-10"
        >
          <button
            className="w-16 h-16 rounded-full bg-blue-600/90 hover:bg-blue-600 text-white shadow-2xl backdrop-blur-md flex items-center justify-center transition-transform duration-200 hover:scale-110 active:scale-95 cursor-pointer border border-white/20"
            title="Play video"
          >
            <Play className="w-7 h-7 fill-white ml-1" />
          </button>
        </div>
      )}

      {/* 5. Custom Overlay Video Controls Bar */}
      {!useNativeControls && !errorMessage && (
        <div
          className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-10 transition-opacity duration-300 z-20 ${
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress / Seek Bar */}
          <div
            ref={progressTrackRef}
            onClick={handleSeek}
            onMouseMove={handleSeekMouseMove}
            onMouseLeave={handleSeekMouseLeave}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            className="group/track relative w-full h-2 bg-white/20 hover:h-3 rounded-full cursor-pointer transition-all mb-3 flex items-center"
          >
            {/* Buffered Progress */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full"
              style={{ width: `${bufferedPercent}%` }}
            />

            {/* Current Play Progress */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-blue-500 rounded-full flex items-center justify-end"
              style={{ width: `${progressPercent}%` }}
            >
              {/* Scrub Handle */}
              <div className="w-3.5 h-3.5 rounded-full bg-white shadow-md transform translate-x-1.5 scale-0 group-hover/track:scale-100 transition-transform" />
            </div>

            {/* Hover Tooltip Timestamp */}
            {hoverTime !== null && hoverPosition !== null && (
              <div
                className="absolute -top-7 transform -translate-x-1/2 bg-slate-900/95 text-white text-[10px] font-mono px-2 py-0.5 rounded shadow-lg border border-slate-700 pointer-events-none"
                style={{ left: `${hoverPosition}%` }}
              >
                {formatTime(hoverTime)}
              </div>
            )}
          </div>

          {/* Control Buttons & Indicators */}
          <div className="flex items-center justify-between gap-2 text-white">
            {/* Left Controls: Play/Pause, Rewind/FastForward, Volume, Time */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={togglePlay}
                className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
              </button>

              <button
                onClick={() => skipTime(-10)}
                className="p-1.5 rounded-lg hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer hidden sm:flex items-center"
                title="Rewind 10s (Left Arrow)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => skipTime(10)}
                className="p-1.5 rounded-lg hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer hidden sm:flex items-center"
                title="Forward 10s (Right Arrow)"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Volume Slider & Toggle */}
              <div className="flex items-center gap-1 group/vol">
                <button
                  onClick={toggleMute}
                  className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title={isMuted ? "Unmute (M)" : "Mute (M)"}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 sm:w-20 h-1 bg-white/30 accent-blue-500 rounded-lg cursor-pointer"
                  title="Adjust Volume"
                />
              </div>

              {/* Time Display */}
              <div className="text-xs font-mono text-slate-300 ml-1">
                <span className="text-white font-medium">{formatTime(currentTime)}</span>
                <span className="text-slate-500 mx-1">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right Controls: Playback Speed, Native Toggle, Fullscreen */}
            <div className="flex items-center gap-1.5 relative">
              {/* Playback Speed Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-white transition-colors cursor-pointer"
                  title="Playback Speed"
                >
                  {playbackSpeed}x
                </button>

                {showSpeedMenu && (
                  <div className="absolute right-0 bottom-full mb-2 bg-slate-900/95 border border-slate-700/80 rounded-xl p-1 shadow-2xl backdrop-blur-md flex flex-col gap-0.5 text-xs text-slate-300 min-w-[70px] z-50">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => changeSpeed(spd)}
                        className={`px-3 py-1.5 rounded-lg text-left font-medium transition-colors cursor-pointer ${
                          playbackSpeed === spd
                            ? "bg-blue-600 text-white font-bold"
                            : "hover:bg-white/10 text-slate-200"
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Native Controls Toggle */}
              <button
                onClick={() => setUseNativeControls(true)}
                className="p-1.5 rounded-lg hover:bg-white/20 text-slate-400 hover:text-white transition-colors cursor-pointer hidden md:block"
                title="Switch to Browser Native Controls"
              >
                <Sliders className="w-4 h-4" />
              </button>

              {/* Fullscreen Button */}
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
                title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

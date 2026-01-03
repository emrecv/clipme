import React, { useState, useEffect, useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { readFile } from '@tauri-apps/plugin-fs';
import { Play, Pause, Volume2, VolumeX, AlertCircle } from 'lucide-react';

interface VideoPreviewProps {
  url: string; 
  previewUrl?: string; 
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ url, previewUrl }) => {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100
  const [duration, setDuration] = useState(0); // seconds
  const [currentTime, setCurrentTime] = useState(0); // seconds
  const [ytReady, setYtReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const htmlVideoRef = useRef<HTMLVideoElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const progressInterval = useRef<any>(null);

  // --- Source Detection ---
  const isYouTube = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url);
  // YouTube uses the main URL. Direct files use previewUrl or url if valid.
  const sourceUrl = isYouTube 
    ? url 
    : (previewUrl || url);
  
  // Convert local paths for HTML5 video
  // If not YouTube and not http/header (remote) and not blob, assume local file
  const isLocalFile = !isYouTube && !sourceUrl.startsWith('http') && !sourceUrl.startsWith('blob');
  
  // Use Blob URL if available (fallback), otherwise convertFileSrc
  const finalFileUrl = blobUrl || (isLocalFile ? convertFileSrc(sourceUrl) : sourceUrl);
  
  // console.log("VideoPreview Debug:", { url, previewUrl, sourceUrl, isLocalFile, finalFileUrl, blobUrl });

  const extractVideoId = (u: string) => {
    const match = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/);
    return match ? match[1] : null;
  };
  const youtubeId = isYouTube ? extractVideoId(url) : null;

  // Reset error state and blob when URL changes
  useEffect(() => {
    setHasError(false);
    setPlaying(false);
    setProgress(0);
    setDuration(0);
    setCurrentTime(0);
    if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
    }
  }, [url, previewUrl]);

  // --- YouTube API Loader ---
  useEffect(() => {
    if (!isYouTube) return;
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = () => setYtReady(true);
    } else {
      setYtReady(true);
    }
  }, [isYouTube]);

  // --- YouTube Player Init ---
  useEffect(() => {
    if (isYouTube && ytReady && youtubeId && !ytPlayerRef.current) {
       ytPlayerRef.current = new window.YT.Player('yt-player-iframe', {
        height: '100%',
        width: '100%',
        videoId: youtubeId,
        playerVars: {
          controls: 0,
          showinfo: 0,
          modestbranding: 1,
          rel: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3
        },
        events: {
          onReady: (e: any) => {
            setDuration(e.target.getDuration());
            setHasError(false);
          },
          onStateChange: (e: any) => {
            // YT.PlayerState.PLAYING = 1, PAUSED = 2, ENDED = 0
            if (e.data === 1) setPlaying(true);
            if (e.data === 2) setPlaying(false);
            if (e.data === 0) {
                setPlaying(false);
                setProgress(100);
            }
          },
          onError: (e: any) => {
            console.error("YouTube Player Error:", e);
            setHasError(true);
          }
        }
      });
    } else if (isYouTube && ytPlayerRef.current && youtubeId) {
        // If ID changes, cue new video? (Not strictly needed for this app flow but good practice)
        // ytPlayerRef.current.cueVideoById(youtubeId);
    }
    
    return () => {
        // Cleanup if switching away? React might handle DOM removal, 
        // but we should technically destroy player. 
        // Keeping it simple for now to avoid accidental destruction loops.
    };
  }, [isYouTube, ytReady, youtubeId]);

  // --- HTML5 Events ---
  const onHtmlTimeUpdate = () => {
    if (htmlVideoRef.current) {
        setCurrentTime(htmlVideoRef.current.currentTime);
        const d = htmlVideoRef.current.duration || 1;
        setDuration(d);
        setProgress((htmlVideoRef.current.currentTime / d) * 100);
    }
  };

  const onHtmlEnded = () => setPlaying(false);

  // --- Sync Progress Loop (YouTube) ---
  useEffect(() => {
    if (isYouTube && playing) {
      progressInterval.current = setInterval(() => {
        if (ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
          const t = ytPlayerRef.current.getCurrentTime();
          const d = ytPlayerRef.current.getDuration();
          setCurrentTime(t);
          setDuration(d);
          if (d > 0) setProgress((t / d) * 100);
        }
      }, 500);
    } else {
      if (progressInterval.current) clearInterval(progressInterval.current);
    }
    return () => clearInterval(progressInterval.current);
  }, [isYouTube, playing]);


  // --- Unified Controls ---
  const togglePlay = () => {
    if (isYouTube && ytPlayerRef.current) {
      if (playing) ytPlayerRef.current.pauseVideo();
      else ytPlayerRef.current.playVideo();
      // State update happens in onStateChange, but we trigger optimistcally
      setPlaying(!playing);
    } else if (!isYouTube && htmlVideoRef.current) {
      if (playing) htmlVideoRef.current.pause();
      else htmlVideoRef.current.play();
      setPlaying(!playing);
    }
  };

  const toggleMute = () => {
    if (isYouTube && ytPlayerRef.current) {
      if (muted) ytPlayerRef.current.unMute();
      else ytPlayerRef.current.mute();
      setMuted(!muted);
    } else if (!isYouTube && htmlVideoRef.current) {
      htmlVideoRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  const seekTo = (percent: number) => {
    const newTime = (percent / 100) * duration;
    setCurrentTime(newTime);
    setProgress(percent);
    
    if (isYouTube && ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(newTime, true);
    } else if (!isYouTube && htmlVideoRef.current) {
      htmlVideoRef.current.currentTime = newTime;
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!url) return null;

  // --- Placeholder Render for Error State ---
  if (hasError) {
    return (
        <div 
          className="video-player-container"
          style={{ 
            width: '100%', 
            aspectRatio: '16/9', 
            borderRadius: 'var(--radius)', 
            overflow: 'hidden',
            backgroundColor: '#000',
            boxShadow: 'var(--shadow)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            gap: '1rem',
            padding: '2rem',
            textAlign: 'center'
          }}
        >
            <AlertCircle size={48} color="var(--primary-color)" />
            <div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-color)' }}>Preview Unavailable</h3>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                    This video cannot be played directly.<br/>
                    You can still try to download or clip it.
                </p>
            </div>
        </div>
    );
  }

  return (
    <div 
      className="video-player-container"
      ref={containerRef}
      style={{ 
        width: '100%', 
        aspectRatio: '16/9', 
        borderRadius: 'var(--radius)', 
        overflow: 'hidden',
        backgroundColor: '#000',
        boxShadow: 'var(--shadow)',
        position: 'relative',
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Player Area */}
      <div style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
        {isYouTube ? (
          <div id="yt-player-iframe" style={{ width: '100%', height: '100%' }} />
        ) : (
          <video
            ref={htmlVideoRef}
            src={finalFileUrl}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onTimeUpdate={onHtmlTimeUpdate}
            onEnded={onHtmlEnded}
            onError={(e) => {
                console.error("HTML Video Error Event:", e);
                console.error("HTML Video Error Details:", e.currentTarget.error);
                
                // Try Blob Fallback for local files
                if (isLocalFile && !blobUrl) {
                    console.log("Attempting Blob fallback for:", sourceUrl);
                    readFile(sourceUrl)
                        .then(contents => {
                            console.log("File read success, creating blob...");
                            const ext = sourceUrl.split('.').pop()?.toLowerCase();
                            let mime = 'video/mp4';
                            if (ext === 'mov') mime = 'video/quicktime';
                            if (ext === 'webm') mime = 'video/webm';
                            if (ext === 'mkv') mime = 'video/mp4'; // Chrome treats some MKV as mp4/webm, safest fallback

                            const blob = new Blob([contents], { type: mime });
                            const bUrl = URL.createObjectURL(blob);
                            setBlobUrl(bUrl);
                            setHasError(false); 
                        })
                        .catch(err => {
                            console.error("Blob fallback failed:", err);
                            setHasError(true);
                        });
                } else {
                    setHasError(true);
                }
            }}
            onLoadedMetadata={(e) => {
                console.log("Video Loaded Metadata", e);
                setDuration(e.currentTarget.duration);
                setHasError(false);
            }}
          />
        )}
      </div>

      {/* Click Overlay (Big Play Button) */}
      <div 
        style={{
          position: 'absolute',
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0,
          background: playing && !hovering ? 'transparent' : 'rgba(0,0,0,0.3)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onClick={togglePlay}
      >
         {(!playing || hovering) && (
            <div style={{
              width: 64, height: 64,
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
              transform: hovering ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}>
               {playing ? 
                 <Pause fill="white" size={32} stroke="none" /> : 
                 <Play fill="white" size={32} stroke="none" style={{ marginLeft: 4 }} />
               }
            </div>
         )}
      </div>

      {/* Custom Control Bar */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        padding: '24px 16px 16px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        opacity: (!playing || hovering) ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: (!playing || hovering) ? 'auto' : 'none',
      }}>
         {/* Progress Line */}
         <div 
           style={{
             width: '100%', height: 4,
             background: 'rgba(255,255,255,0.2)',
             borderRadius: 2,
             position: 'relative',
             cursor: 'pointer',
             transition: 'height 0.2s'
           }}
           className="progress-bar-hover" // We can add hover effect in CSS
           onClick={(e) => {
             e.stopPropagation();
             const rect = e.currentTarget.getBoundingClientRect();
             const p = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
             seekTo(p);
           }}
         >
            <div style={{
               position: 'absolute', left: 0, top: 0, bottom: 0,
               width: `${progress}%`,
               backgroundColor: 'var(--primary-color)',
               borderRadius: 2,
               boxShadow: '0 0 10px rgba(var(--primary-color-rgb), 0.5)'
            }} />
         </div>

         {/* Buttons & Time */}
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
               <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="icon-button-ghost">
                  {playing ? <Pause size={20} color="white" /> : <Play size={20} color="white" />}
               </button>
               <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="icon-button-ghost">
                  {muted ? <VolumeX size={20} color="white" /> : <Volume2 size={20} color="white" />}
               </button>
               <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontFamily: 'monospace' }}>
                 {formatTime(currentTime)} / {formatTime(duration)}
               </span>
            </div>
         </div>
      </div>
    </div>
  );
};

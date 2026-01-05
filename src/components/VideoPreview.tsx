import React, { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Play, Pause, Volume2, VolumeX, AlertCircle } from 'lucide-react';

interface VideoPreviewProps {
  url: string; 
  previewUrl?: string; 
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ url, previewUrl }) => {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100
  const [duration, setDuration] = useState(0); // seconds
  const [currentTime, setCurrentTime] = useState(0); // seconds
  const [ready, setReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  // --- Source Detection ---
  const isYouTube = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url);
  
  // For YouTube, always use the main URL (ReactPlayer handles it best).
  // For local files, use previewUrl or url.
  const sourceUrl = isYouTube 
    ? url 
    : (previewUrl || url);
  
  // Convert local paths to asset-protocol URLs on Windows/Mac
  const isLocalFile = !isYouTube && !sourceUrl.startsWith('http') && !sourceUrl.startsWith('blob');
  const finalPlayableUrl = isLocalFile ? convertFileSrc(sourceUrl) : sourceUrl;
  
  useEffect(() => {
    // Reset state on URL change
    setHasError(false);
    setPlaying(false);
    setProgress(0);
    setDuration(0);
    setCurrentTime(0);
    setReady(false);
  }, [url, previewUrl]);

  // --- Handlers ---
  const handlePlayPause = () => setPlaying(!playing);
  const handleMuteToggle = () => setMuted(!muted);
  
  const handleProgress = (state: { played: number, playedSeconds: number }) => {
    // User dragging overrides updates? No, we just visual sync
    if (!seeking.current) {
        setProgress(state.played * 100);
        setCurrentTime(state.playedSeconds);
    }
  };

  const handleDuration = (d: number) => {
    setDuration(d);
  };

  const handleError = (e: any) => {
    console.error("VideoPlayer Error:", e);
    setHasError(true);
  };

  const handleReady = () => {
    setReady(true);
    setHasError(false);
  };

  const seeking = useRef(false);
  const seekTo = (percent: number) => {
    const fraction = percent / 100;
    const time = fraction * duration;
    
    // Optimistic UI
    setProgress(percent);
    setCurrentTime(time);
    
    if (playerRef.current) {
        playerRef.current.seekTo(fraction, 'fraction');
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!url) return null;

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
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-color)' }}>Playback Error</h3>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                    Unable to play this video.<br/>
                    {isYouTube ? "Check internet connection." : "File format might not be supported."}
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
        position: 'relative', 
        paddingTop: '56.25%', /* 16:9 Aspect Ratio */
        borderRadius: 'var(--radius)', 
        overflow: 'hidden',
        backgroundColor: '#000',
        boxShadow: 'var(--shadow)',
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
          <ReactPlayer
            ref={playerRef}
            url={finalPlayableUrl}
            width="100%"
            height="100%"
            playing={playing}
            muted={muted}
            controls={false} // Custom controls
            onReady={handleReady}
            onProgress={(state: any) => handleProgress(state)}
            onDuration={handleDuration}
            onError={handleError}
            onEnded={() => setPlaying(false)}
            // YouTube specific configs
            config={{
                youtube: {
                    playerVars: { showinfo: 0, modestbranding: 1, rel: 0 }
                } as any
            }}
          />
      </div>

      {/* Click Overlay (Play/Pause) */}
      <div 
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: playing && !hovering ? 'transparent' : 'rgba(0,0,0,0.3)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onClick={handlePlayPause}
      >
         {(!playing || hovering) && ready && (
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
        opacity: (!playing || hovering) && ready ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: (!playing || hovering) && ready ? 'auto' : 'none',
      }}>
         {/* Progress Line */}
         <div 
           style={{
             width: '100%', height: 4,
             background: 'rgba(255,255,255,0.2)',
             borderRadius: 2,
             position: 'relative',
             cursor: 'pointer',
           }}
           className="progress-bar-hover"
           onMouseDown={() => { seeking.current = true; }}
           onMouseUp={() => { seeking.current = false; }}
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
               <button onClick={(e) => { e.stopPropagation(); handlePlayPause(); }} className="icon-button-ghost">
                  {playing ? <Pause size={20} color="white" /> : <Play size={20} color="white" />}
               </button>
               <button onClick={(e) => { e.stopPropagation(); handleMuteToggle(); }} className="icon-button-ghost">
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

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import 'media-chrome';
import { AlertCircle } from 'lucide-react';

// Type declarations for media-chrome custom elements need to be in the global module scope
// Using separate declaration file or module augmentation
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'media-controller': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        audio?: boolean;
        class?: string;
      }, HTMLElement>;
      'media-control-bar': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        class?: string;
      }, HTMLElement>;
      'media-play-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'media-seek-backward-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        seekoffset?: number;
      }, HTMLElement>;
      'media-seek-forward-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        seekoffset?: number;
      }, HTMLElement>;
      'media-mute-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'media-volume-range': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'media-time-range': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'media-time-display': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        showduration?: boolean;
      }, HTMLElement>;
      'media-fullscreen-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'media-pip-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'media-loading-indicator': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

interface VideoPreviewProps {
  url: string;
  previewUrl?: string;
}

// Social URL detection
const getVideoType = (url: string): 'youtube' | 'instagram' | 'tiktok' | 'local' => {
  if (!url) return 'local';
  const trimmed = url.trim().toLowerCase();
  
  if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
    return 'youtube';
  }
  if (trimmed.includes('instagram.com')) {
    return 'instagram';
  }
  if (trimmed.includes('tiktok.com')) {
    return 'tiktok';
  }
  return 'local';
};

// Extract YouTube video ID
const getYouTubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// Extract Instagram post ID
const getInstagramPostId = (url: string): string | null => {
  const pattern = /instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/;
  const match = url.match(pattern);
  return match ? match[1] : null;
};

// Extract TikTok video ID
const getTikTokVideoId = (url: string): string | null => {
  const pattern = /tiktok\.com\/@[^\/]+\/video\/(\d+)/;
  const match = url.match(pattern);
  return match ? match[1] : null;
};

// Ensure URL has protocol
const ensureProtocol = (url: string): string => {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  if (/^[\w\-]+(\.[\w\-]+)+/.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

// YouTube Embed Component
const YouTubeEmbed: React.FC<{ videoId: string }> = ({ videoId }) => {
  return (
    <div className="video-embed-container">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="video-embed-iframe"
      />
      <style>{embedStyles}</style>
    </div>
  );
};

// Instagram Embed Component
const InstagramEmbed: React.FC<{ postId: string }> = ({ postId }) => {
  useEffect(() => {
    // Load Instagram embed script
    const script = document.createElement('script');
    script.src = 'https://www.instagram.com/embed.js';
    script.async = true;
    document.body.appendChild(script);
    
    // Process embeds when script loads
    script.onload = () => {
      if ((window as any).instgrm) {
        (window as any).instgrm.Embeds.process();
      }
    };
    
    return () => {
      script.remove();
    };
  }, [postId]);
  
  return (
    <div className="video-embed-container instagram-embed">
      <blockquote
        className="instagram-media"
        data-instgrm-captioned
        data-instgrm-permalink={`https://www.instagram.com/p/${postId}/`}
        data-instgrm-version="14"
        style={{
          background: '#000',
          border: 0,
          borderRadius: '12px',
          margin: 0,
          maxWidth: '100%',
          minWidth: '100%',
          padding: 0,
          width: '100%',
        }}
      />
      <style>{embedStyles}</style>
    </div>
  );
};

// TikTok Embed Component
const TikTokEmbed: React.FC<{ url: string }> = ({ url }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Load TikTok embed script
    const script = document.createElement('script');
    script.src = 'https://www.tiktok.com/embed.js';
    script.async = true;
    document.body.appendChild(script);
    
    return () => {
      script.remove();
    };
  }, [url]);
  
  return (
    <div className="video-embed-container tiktok-embed" ref={containerRef}>
      <blockquote
        className="tiktok-embed"
        cite={ensureProtocol(url)}
        data-video-id={getTikTokVideoId(url) || ''}
        style={{
          maxWidth: '100%',
          minWidth: '100%',
        }}
      >
        <section />
      </blockquote>
      <style>{embedStyles}</style>
    </div>
  );
};

// Kibo UI Style Video Player using media-chrome
const KiboPlayer: React.FC<{ src: string }> = ({ src }) => {
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const handleError = () => {
    console.error('Video playback error:', src);
    setHasError(true);
  };

  if (hasError) {
    return (
      <div className="kibo-player kibo-player--error">
        <AlertCircle size={32} className="kibo-player__error-icon" />
        <p className="kibo-player__error-text">Video unavailable</p>
        <style>{kiboStyles}</style>
      </div>
    );
  }

  return (
    <div className="kibo-player">
      <media-controller class="kibo-media-controller">
        <video
          ref={videoRef}
          slot="media"
          src={src}
          preload="metadata"
          crossOrigin="anonymous"
          onError={handleError}
          className="kibo-video"
        />
        
        <media-loading-indicator slot="centered-chrome" />
        
        <media-control-bar class="kibo-control-bar">
          <media-play-button />
          <media-time-range />
          <media-time-display showduration />
          <media-mute-button />
          <media-volume-range />
          <media-fullscreen-button />
        </media-control-bar>
      </media-controller>
      <style>{kiboStyles}</style>
    </div>
  );
};

// Main VideoPreview Component
export const VideoPreview: React.FC<VideoPreviewProps> = ({ url }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const videoData = useMemo(() => {
    if (!url) return { type: 'local' as const, embedData: null, src: '' };
    
    const type = getVideoType(url);
    
    switch (type) {
      case 'youtube': {
        const videoId = getYouTubeVideoId(ensureProtocol(url));
        return { type, embedData: videoId, src: '' };
      }
      case 'instagram': {
        const postId = getInstagramPostId(ensureProtocol(url));
        return { type, embedData: postId, src: '' };
      }
      case 'tiktok': {
        return { type, embedData: url, src: '' };
      }
      case 'local':
      default: {
        let src = url;
        // Convert local file paths
        if (!url.startsWith('http') && !url.startsWith('blob:')) {
          src = convertFileSrc(url);
        }
        return { type, embedData: null, src };
      }
    }
  }, [url]);

  if (!mounted) return null;

  // YouTube Embed
  if (videoData.type === 'youtube' && videoData.embedData) {
    return <YouTubeEmbed videoId={videoData.embedData} />;
  }

  // Instagram Embed
  if (videoData.type === 'instagram' && videoData.embedData) {
    return <InstagramEmbed postId={videoData.embedData} />;
  }

  // TikTok Embed
  if (videoData.type === 'tiktok' && videoData.embedData) {
    return <TikTokEmbed url={videoData.embedData} />;
  }

  // Local Video with Kibo Player
  return <KiboPlayer src={videoData.src} />;
};

// Embed container styles
const embedStyles = `
.video-embed-container {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 12px;
  overflow: hidden;
  background: #000;
}

.video-embed-container.instagram-embed,
.video-embed-container.tiktok-embed {
  aspect-ratio: auto;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-embed-iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
}

.instagram-media {
  width: 100% !important;
  max-width: 100% !important;
}
`;

// Kibo Player styles (media-chrome styling)
const kiboStyles = `
.kibo-player {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.kibo-player--error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.kibo-player__error-icon {
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 8px;
}

.kibo-player__error-text {
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
  margin: 0;
}

.kibo-media-controller {
  width: 100%;
  height: 100%;
  display: block;
  --media-primary-color: #fff;
  --media-secondary-color: rgba(255, 255, 255, 0.7);
  --media-control-background: transparent;
  --media-control-hover-background: rgba(255, 255, 255, 0.1);
  --media-range-track-height: 4px;
  --media-range-track-background: rgba(255, 255, 255, 0.2);
  --media-range-bar-color: #fff;
  --media-range-thumb-width: 12px;
  --media-range-thumb-height: 12px;
  --media-range-thumb-background: #fff;
  --media-range-thumb-border-radius: 50%;
  --media-font-family: 'Inter', system-ui, -apple-system, sans-serif;
  --media-font-size: 12px;
  --media-button-icon-width: 18px;
  --media-button-icon-height: 18px;
  --media-control-padding: 10px;
  --media-time-range-buffered-color: rgba(255, 255, 255, 0.3);
  --media-icon-color: rgba(255, 255, 255, 0.85);
  border-radius: 12px;
}

.kibo-media-controller:hover {
  --media-icon-color: #fff;
}

.kibo-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.kibo-control-bar {
  padding: 16px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, transparent 100%);
  gap: 8px;
}

/* Custom styling for controls */
media-controller {
  --media-background-color: transparent;
}

media-control-bar {
  --media-control-background: transparent;
}

media-play-button,
media-seek-backward-button,
media-seek-forward-button,
media-mute-button,
media-pip-button,
media-fullscreen-button {
  border-radius: 6px;
  transition: background 0.2s ease, color 0.2s ease;
}

media-play-button:hover,
media-seek-backward-button:hover,
media-seek-forward-button:hover,
media-mute-button:hover,
media-pip-button:hover,
media-fullscreen-button:hover {
  background: rgba(255, 255, 255, 0.1);
}

media-time-range {
  flex: 1;
  height: 20px;
}

media-volume-range {
  width: 60px;
}

media-time-display {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  white-space: nowrap;
}

media-loading-indicator {
  --media-loading-icon-width: 48px;
  --media-loading-icon-height: 48px;
}

/* Center play button styling */
media-controller::part(center-play-button) {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
`;

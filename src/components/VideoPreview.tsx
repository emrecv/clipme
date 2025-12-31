import React from 'react';

interface VideoPreviewProps {
  url: string;
}

// Extrahiert die Video-ID aus verschiedenen YouTube URL-Formaten
const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

export const VideoPreview: React.FC<VideoPreviewProps> = ({ url }) => {
  if (!url) return null;

  const videoId = extractVideoId(url);
  
  if (!videoId) {
    return (
      <div style={{ 
        width: '100%', 
        aspectRatio: '16/9', 
        borderRadius: 'var(--radius)', 
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
        boxShadow: 'var(--shadow)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)'
      }}>
        Invalid YouTube URL
      </div>
    );
  }

  const embedUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0&modestbranding=1`;

  return (
    <div style={{ 
      width: '100%', 
      aspectRatio: '16/9', 
      borderRadius: 'var(--radius)', 
      overflow: 'hidden',
      backgroundColor: '#000',
      boxShadow: 'var(--shadow)'
    }}>
      <iframe
        src={embedUrl}
        width="100%"
        height="100%"
        style={{ border: 'none' }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="YouTube Video Preview"
      />
    </div>
  );
};

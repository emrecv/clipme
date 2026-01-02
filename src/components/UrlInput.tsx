import React, { useState } from 'react';

interface UrlInputProps {
  onUrlSubmit: (url: string) => void;
  isLoading: boolean;
}

export const UrlInput: React.FC<UrlInputProps> = ({ onUrlSubmit, isLoading }) => {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onUrlSubmit(url);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Paste YouTube URL here..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isLoading}
          style={{ flex: 1 }}
        />
        <button 
          type="submit" 
          disabled={isLoading || !url.trim()}
          className="icon-button"
          title="Load Video"
          style={{
            backgroundColor: url.trim() ? 'var(--primary-color)' : 'var(--surface-hover)',
          }}
        >
          {isLoading ? (
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none"
              style={{ animation: 'spin 1s linear infinite' }}
            >
              <circle 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="#181818" 
                strokeWidth="3" 
                strokeLinecap="round"
                strokeDasharray="31.4 31.4"
              />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path 
                d="M5.23852 14.8117C5.63734 16.3002 6.51616 17.6154 7.73867 18.5535C8.96118 19.4915 10.4591 20 12 20C13.5409 20 15.0388 19.4915 16.2613 18.5535C17.4838 17.6154 18.3627 16.3002 18.7615 14.8117" 
                stroke={url.trim() ? '#181818' : 'var(--primary-color)'} 
                strokeWidth="2"
              />
              <path 
                d="M12 13L11.3753 13.7809L12 14.2806L12.6247 13.7809L12 13ZM13 4C13 3.44772 12.5523 3 12 3C11.4477 3 11 3.44771 11 4L13 4ZM6.37531 9.78087L11.3753 13.7809L12.6247 12.2191L7.6247 8.21913L6.37531 9.78087ZM12.6247 13.7809L17.6247 9.78087L16.3753 8.21913L11.3753 12.2191L12.6247 13.7809ZM13 13L13 4L11 4L11 13L13 13Z" 
                fill={url.trim() ? '#181818' : 'var(--primary-color)'}
              />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
};

import React from 'react';

interface DownloadButtonProps {
  onDownload: () => void;
  isDownloading: boolean;
  disabled: boolean;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({ 
  onDownload, 
  isDownloading, 
  disabled 
}) => {
  return (
    <button 
      onClick={onDownload} 
      disabled={disabled}
      style={{ 
        backgroundColor: isDownloading ? '#ef4444' : 'var(--primary-color)',
        color: isDownloading ? '#fff' : 'var(--bg-color)',
        padding: '0.7em 1.25em',
      }}
    >
      {isDownloading ? (
        <>
          <svg 
            width="18" 
            height="18" 
            viewBox="0 0 24 24" 
            fill="currentColor"
          >
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
          Cancel
        </>
      ) : (
        <>
          <img 
            src="/download-button.svg" 
            alt="" 
            width="18" 
            height="18" 
            style={{ filter: 'none' }}
          />
          Clip Video
        </>
      )}
    </button>
  );
};

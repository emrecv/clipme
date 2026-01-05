import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Folder, Trash2, Clock, Film } from 'lucide-react';

export interface DownloadHistoryItem {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  duration: number;
  quality: string;
  format: string;
  filePath: string;
  fileSize?: number;
  downloadedAt: string;
}

interface DownloadHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  isPro: boolean;
  showToast: (message: string, type: 'info' | 'success' | 'error') => void;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
};

export const DownloadHistory: React.FC<DownloadHistoryProps> = ({ 
  isOpen, 
  onClose, 
  isPro,
  showToast 
}) => {
  const [history, setHistory] = useState<DownloadHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && isPro) {
      loadHistory();
    }
  }, [isOpen, isPro]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const items = await invoke<DownloadHistoryItem[]>('get_download_history');
      setHistory(items);
    } catch (error) {
      console.error('Failed to load history:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    try {
      await invoke('clear_download_history');
      setHistory([]);
      showToast('History cleared', 'success');
    } catch (error) {
      showToast('Failed to clear history', 'error');
    }
  };

  const openFileLocation = async (filePath: string) => {
    try {
      await invoke('open_file_location', { path: filePath });
    } catch (error) {
      showToast('File not found', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="history-overlay" onClick={onClose}>
      <div className="history-panel" onClick={(e) => e.stopPropagation()}>
        <div className="history-header">
          <h2>
            <Clock size={20} />
            Download History
          </h2>
          <div className="history-header-actions">
            {history.length > 0 && (
              <button 
                className="history-clear-btn"
                onClick={clearHistory}
                title="Clear all history"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button className="history-close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="history-content">
          {!isPro ? (
            <div className="history-pro-gate">
              <Film size={48} />
              <h3>Download History is a Pro Feature</h3>
              <p>Upgrade to Pro to access your download history.</p>
            </div>
          ) : loading ? (
            <div className="history-loading">
              <div className="spinner-small" />
              <span>Loading history...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="history-empty">
              <Film size={48} />
              <h3>No downloads yet</h3>
              <p>Your download history will appear here.</p>
            </div>
          ) : (
            <div className="history-list">
              {history.map((item) => (
                <div key={item.id} className="history-item">
                  <div 
                    className="history-thumbnail"
                    style={{ backgroundImage: item.thumbnail ? `url(${item.thumbnail})` : undefined }}
                  >
                    {!item.thumbnail && <Film size={24} />}
                    <span className="history-duration">{formatDuration(item.duration)}</span>
                  </div>
                  <div className="history-info">
                    <h4 className="history-title" title={item.title}>
                      {item.title}
                    </h4>
                    <div className="history-meta">
                      <span>{item.quality}</span>
                      <span>•</span>
                      <span>{item.format.toUpperCase()}</span>
                      {item.fileSize && (
                        <>
                          <span>•</span>
                          <span>{formatFileSize(item.fileSize)}</span>
                        </>
                      )}
                    </div>
                    <div className="history-date">
                      {formatDate(item.downloadedAt)}
                    </div>
                  </div>
                  <button 
                    className="history-open-btn"
                    onClick={() => openFileLocation(item.filePath)}
                    title="Open file location"
                  >
                    <Folder size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

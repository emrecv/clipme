import { useState, useCallback } from 'react';
import './App.css';
import { UrlInput } from './components/UrlInput';
import { Timeline } from './components/Timeline';
import { DownloadButton } from './components/DownloadButton';
import { VideoPreview } from './components/VideoPreview';
import { Toast } from './components/Toast';
import { invoke } from '@tauri-apps/api/core';

interface VideoMetadata {
  title: string;
  duration: number;
  formats: string[];
}

type ToastType = 'info' | 'success' | 'error';

function App() {
  const [loading, setLoading] = useState(false);
  const [videoMeta, setVideoMeta] = useState<VideoMetadata | null>(null);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [url, setUrl] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState('Best');
  
  // Toast state
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  }, []);

  const handleUrlSubmit = async (inputUrl: string) => {
    setLoading(true);
    showToast('Fetching video metadata...', 'info');
    setVideoMeta(null);
    try {
      const meta = await invoke<VideoMetadata>('get_video_metadata', { url: inputUrl });
      setVideoMeta(meta);
      setRange([0, meta.duration]);
      setUrl(inputUrl);
      setToast(null);
      if (meta.formats && meta.formats.length > 0) {
        setSelectedQuality(meta.formats[0]);
      }
    } catch (error) {
      console.error(error);
      showToast('Error fetching video info: ' + error, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!videoMeta || !url) return;
    
    if (downloading) {
      showToast('Cancelling...', 'info');
      try {
        await invoke('cancel_download');
        showToast('Download cancelled.', 'info');
      } catch (error) {
        console.error(error);
        showToast('Failed to cancel: ' + error, 'error');
      }
      setDownloading(false);
      return;
    }

    setDownloading(true);
    showToast('Downloading clip...', 'info');
    try {
      await invoke('download_clip', { 
        url, 
        start: range[0], 
        end: range[1],
        quality: selectedQuality
      });
      showToast('Download complete! Saved to Downloads/YT_Clipper', 'success');
    } catch (error) {
      console.error(error);
      if (typeof error === 'string' && error.includes('cancelled')) {
        showToast('Download cancelled.', 'info');
      } else {
        showToast('Download failed: ' + error, 'error');
      }
    } finally {
      setDownloading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container">
      {/* Header */}
      <header className="header" style={{ marginBottom: videoMeta ? '0.5rem' : '2rem' }}>
        <h1>YT Clipper</h1>
        {!videoMeta && <p>Paste a YouTube link to start clipping.</p>}
      </header>

      {/* URL Input */}
      <div className="input-section">
        <div className="card">
          <UrlInput onUrlSubmit={handleUrlSubmit} isLoading={loading} />
        </div>
      </div>

      {/* Content Grid */}
      {videoMeta && (
        <div className="content-grid fade-in">
          {/* Preview Column */}
          <div className="preview-column">
            <VideoPreview url={url} />
            <h2>{videoMeta.title}</h2>
          </div>

          {/* Controls Column */}
          <div className="controls-column">
            {/* Timeline Card */}
            <Timeline 
              duration={videoMeta.duration} 
              range={range} 
              onChange={setRange} 
            />

            {/* Settings Card */}
            <div className="card">
              <h3>Output Settings</h3>
              
              <div className="settings-row">
                <div className="quality-select">
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.4rem', 
                    fontSize: '0.85rem', 
                    color: 'var(--text-secondary)' 
                  }}>
                    Quality
                  </label>
                  <select 
                    value={selectedQuality} 
                    onChange={(e) => setSelectedQuality(e.target.value)}
                    disabled={downloading}
                  >
                    {videoMeta.formats.map(fmt => (
                      <option key={fmt} value={fmt}>{fmt}</option>
                    ))}
                  </select>
                </div>

                <div className="actions">
                  <span className="clip-duration">
                    Duration: {formatDuration(range[1] - range[0])}
                  </span>
                  <DownloadButton 
                    onDownload={handleDownload} 
                    isDownloading={downloading} 
                    disabled={!videoMeta} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
}

export default App;

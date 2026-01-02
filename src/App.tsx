import { useState, useCallback, useEffect, useRef } from 'react';
import './App.css';
import { UrlInput } from './components/UrlInput';
import { Timeline } from './components/Timeline';
import { DownloadButton } from './components/DownloadButton';
import { VideoPreview } from './components/VideoPreview';
import { Toast } from './components/Toast';
import { UserMenu } from './components/UserMenu';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ProBadge } from './components/ProBadge';
import { SettingsPanel } from './components/SettingsPanel';
import { Celebration } from './components/Celebration';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';

interface VideoMetadata {
  title: string;
  duration: number;
  formats: string[];
}

interface DownloadProgress {
  percent: number;
  speed: string;
  eta: string;
  downloaded: string;
  total: string;
  id: number;
}

type ToastType = 'info' | 'success' | 'error';

interface LicenseInfo {
  is_valid: boolean;
  is_pro: boolean;
  license_key: string | null;
  email: string | null;
}

interface AppSettings {
  preferred_quality: string | null;
}

const FREE_QUALITIES = ['720p', '480p', 'Audio Only'];

function App() {
  const [loading, setLoading] = useState(false);
  const [videoMeta, setVideoMeta] = useState<VideoMetadata | null>(null);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [url, setUrl] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState('720p');
  const [downloadPath, setDownloadPath] = useState('');
  const [askForPath, setAskForPath] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const downloadSessionRef = useRef(0);  // Counter to track download sessions
  const [showWelcome, setShowWelcome] = useState<boolean | null>(null); // null = loading
  const [isPro, setIsPro] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [preferredQuality, setPreferredQuality] = useState<string | null>(null);
  
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  }, []);

  // Check onboarding status and load license on mount
  useEffect(() => {
    invoke<boolean>('check_onboarding_complete').then((complete) => {
      setShowWelcome(!complete);
      if (complete) {
        invoke<string>('get_download_path').then(setDownloadPath).catch(console.error);
        // Load license status
        // Load license status and settings
        invoke<LicenseInfo>('get_license_status').then((license) => {
          setIsPro(license.is_pro);
          // Load settings
          invoke<AppSettings>('get_app_settings').then((settings) => {
            if (settings.preferred_quality) {
              setPreferredQuality(settings.preferred_quality);
            }
            
            if (license.is_pro) {
              // Valid Pro license
              if (settings.preferred_quality) {
                 // Will be applied when video meta loads
                 // But for initial state (if any)
                 setSelectedQuality(settings.preferred_quality);
              } else {
                 setSelectedQuality('Best');
              }
            }
          }).catch(console.error);
        }).catch(console.error);
      }
    }).catch(() => {
      setShowWelcome(true); // Show welcome on error
    });
  }, []);

  // Listen for progress events - uses session counter to filter stale events
  useEffect(() => {
    const unlisten = listen<DownloadProgress>('download-progress', (event) => {
      // Strict filtering: Only accept events that match the current session ID
      // This is foolproof against race conditions
      if (event.payload.id === downloadSessionRef.current) {
        setProgress(event.payload);
      }
    });
    
    return () => {
      unlisten.then(fn => fn());
    };
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
        // Set quality based on Pro status
        if (isPro) {
          setSelectedQuality(meta.formats[0]); // Usually "Best"
        } else {
          // For free users, select the best available free quality
          const freeQuality = meta.formats.find(q => FREE_QUALITIES.includes(q)) || '720p';
          setSelectedQuality(freeQuality);
        }
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
    
    // Reset progress immediately to clear any stale data
    setProgress(null);
    
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
      downloadSessionRef.current = 0;  // End session
      return;
    }

    // Generate unique session ID (timestamp)
    const sessionId = Date.now();
    downloadSessionRef.current = sessionId;
    
    setDownloading(true);
    setProgress({ percent: 0, speed: 'Starting', eta: '', downloaded: '', total: '', id: sessionId });

    // If askForPath is enabled, prompt for location first
    let targetPath = downloadPath;
    if (askForPath) {
      try {
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'Choose Download Location',
        });
        if (selected && typeof selected === 'string') {
          await invoke('set_download_path', { path: selected });
          targetPath = selected;
          setDownloadPath(selected);
        } else {
          // User cancelled folder selection
          setDownloading(false);
          setProgress(null);
          return;
        }
      } catch (err) {
        console.error(err);
        showToast('Failed to select folder', 'error');
        setDownloading(false);
        setProgress(null);
        return;
      }
    }
    
    try {
      await invoke('download_clip', { 
        url, 
        title: videoMeta.title,
        start: range[0], 
        end: range[1],
        quality: selectedQuality,
        id: sessionId // Pass the ID to backend
      });
      showToast('Download complete! Saved to ' + targetPath, 'success');
    } catch (error) {
      console.error(error);
      if (typeof error === 'string' && error.includes('cancelled')) {
        showToast('Download cancelled.', 'info');
      } else {
        showToast('Download failed: ' + error, 'error');
      }
    } finally {
      setDownloading(false);
      downloadSessionRef.current = 0;
      setProgress(null);
    }
  };

  const handleSelectDownloadPath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Download Folder',
      });
      
      if (selected && typeof selected === 'string') {
        await invoke('set_download_path', { path: selected });
        setDownloadPath(selected);
        showToast('Download path updated!', 'success');
      }
    } catch (error) {
      console.error(error);
      showToast('Failed to set download path', 'error');
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get short path for display
  const getShortPath = (path: string) => {
    const parts = path.split('/');
    return parts.slice(-2).join('/');
  };

  const handleWelcomeComplete = (settings: { downloadPath: string; askEachTime: boolean; isPro: boolean }) => {
    setDownloadPath(settings.downloadPath);
    setAskForPath(settings.askEachTime);
    setIsPro(settings.isPro);
    if (settings.isPro) {
      setSelectedQuality('Best');
    }
    setShowWelcome(false);
  };

  // Show nothing while checking onboarding status
  if (showWelcome === null) {
    return null;
  }

  // Show welcome screen if first time
  if (showWelcome) {
    return (
      <>
        <Celebration show={showCelebration} onComplete={() => setShowCelebration(false)} />
        <WelcomeScreen 
          onComplete={handleWelcomeComplete} 
          onLicenseActivated={() => setShowCelebration(true)}
        />
      </>
    );
  }

  return (
    <div className="app-layout">
      {/* Settings Panel */}
      <SettingsPanel 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        isPro={isPro}
        onLicenseChange={(newIsPro?: boolean) => {
          invoke<LicenseInfo>('get_license_status').then((license) => {
            const wasFree = !isPro;
            setIsPro(license.is_pro);
            if (license.is_pro) {
              // If we have a preference, try to use it
              if (preferredQuality) {
                setSelectedQuality(preferredQuality);
              } else {
                setSelectedQuality('Best');
              }
              
              // Show celebration if upgrading from free to pro
              if (wasFree || newIsPro) {
                setShowCelebration(true);
              }
            } else {
              setSelectedQuality('720p');
            }
          }).catch(console.error);
        }}
        preferredQuality={preferredQuality}
        onPreferredQualityChange={(quality) => {
          setPreferredQuality(quality);
          invoke('save_app_settings', { settings: { preferred_quality: quality } }).catch(console.error);
          if (isPro && quality) {
            setSelectedQuality(quality);
          }
        }}
      />

      {/* Top Bar */}
      <div className="top-bar">
        <UserMenu 
          onProfileClick={() => showToast('Profile coming soon!', 'info')}
          onSettingsClick={() => setShowSettings(true)}
        />
        <img src="/clipme-logo-white.svg" alt="clipme" className="top-bar-logo" style={{ height: '32px' }} />
        <ProBadge isPro={isPro} onProActivated={() => {
          setIsPro(true);
          setSelectedQuality('Best');
          setShowCelebration(true);
        }} />
      </div>

      {/* Celebration Overlay */}
      <Celebration show={showCelebration} onComplete={() => setShowCelebration(false)} />

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <header className="header" style={{ marginBottom: videoMeta ? '0.5rem' : '2rem' }}>
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
              <Timeline 
                duration={videoMeta.duration} 
                range={range} 
                onChange={setRange} 
              />

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
                      {videoMeta.formats.map(fmt => {
                        const isProOnly = !FREE_QUALITIES.includes(fmt);
                        const isDisabled = isProOnly && !isPro;
                        return (
                          <option key={fmt} value={fmt} disabled={isDisabled}>
                            {fmt}{isDisabled ? ' (Pro)' : ''}
                          </option>
                        );
                      })}
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

                {/* Progress Bar */}
                {downloading && progress && (
                  <div style={{ marginTop: '1rem' }}>
                    {/* Progress container */}
                    <div style={{
                      width: '100%',
                      height: '8px',
                      backgroundColor: '#2a2a2a',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      marginBottom: '0.5rem'
                    }}>
                      <div style={{
                        width: `${progress.percent}%`,
                        height: '100%',
                        backgroundColor: 'var(--primary-color)',
                        borderRadius: '4px',
                        transition: 'width 0.2s ease'
                      }} />
                    </div>
                    {/* Status text */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary)'
                    }}>
                      <span>{progress.speed || 'Starting'}</span>
                      <span>{Math.round(progress.percent)}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar - Quick Settings */}
      <div className="bottom-bar">
        {/* Version Badge */}
        <div className="version-badge">
          <img src="/stars.svg" alt="" width="14" height="14" />
          <span>v1.0</span>
        </div>

        <div className="bottom-bar-right">
          <button 
            className="path-button"
            onClick={handleSelectDownloadPath}
            title={downloadPath || 'Select download folder'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
            </svg>
            <span className="path-text">
              {downloadPath ? getShortPath(downloadPath) : 'Select folder...'}
            </span>
          </button>
          
          {/* Ask for location toggle */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            marginLeft: '1rem'
          }}>
            <input
              type="checkbox"
              checked={askForPath}
              onChange={(e) => setAskForPath(e.target.checked)}
              style={{
                width: '14px',
                height: '14px',
                cursor: 'pointer'
              }}
            />
            Ask each time
          </label>
        </div>
      </div>

      {/* Toast */}
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

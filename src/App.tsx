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
import { FileDropZone } from './components/FileDropZone';
import { TitlebarActions } from './components/TitlebarActions';
import { DownloadHistory } from './components/DownloadHistory';
import { MultiClipTimeline, ClipSegment } from './components/MultiClipTimeline';

import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { listen } from '@tauri-apps/api/event';
import { open, ask } from '@tauri-apps/plugin-dialog';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { useAuth } from './contexts/AuthContext';
import { AuthModal } from './components/AuthModal';
import { account, client } from './lib/appwrite';

interface VideoMetadata {
  title: string;
  duration: number;
  formats: string[];
  preview_url?: string;
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
  const [version, setVersion] = useState('');
  const [loadingVersion, setLoadingVersion] = useState(true);

  const checkForUpdates = async () => {
    try {
      setLoadingVersion(true);
      const update = await check();
      
      if (update?.available) {
        const yes = await ask(`Update to ${update.version} is available!\n\n${update.body}`, {
          title: 'Update Available',
          kind: 'info',
          okLabel: 'Update',
          cancelLabel: 'Cancel'
        });
        
        if (yes) {
          await update.downloadAndInstall();
          await relaunch();
        }
      } else {
        showToast('Clipme is up to date 🚀', 'success');
      }
    } catch (error) {
      console.error('Update check failed:', error);
      showToast('Update check failed', 'error');
    } finally {
      setLoadingVersion(false);
    }
  };
  const [loading, setLoading] = useState(false);
  const [videoMeta, setVideoMeta] = useState<VideoMetadata | null>(null);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [url, setUrl] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState('720p');
  const [downloadPath, setDownloadPath] = useState('');
  const [askForPath, setAskForPath] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const downloadSessionRef = useRef(0);
  const [showWelcome, setShowWelcome] = useState<boolean | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [preferredQuality, setPreferredQuality] = useState<string | null>(null);
  
  // New state for local files
  const [isLocalFile, setIsLocalFile] = useState(false);
  const [originalResolution, setOriginalResolution] = useState<string | null>(null);
  const [containerFormat, setContainerFormat] = useState('mp4');
  
  // Multi-Clip Mode (Pro feature)
  const [multiClipEnabled, setMultiClipEnabled] = useState(false);
  const [segments, setSegments] = useState<ClipSegment[]>([]);
  
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { checkSession, user, logout } = useAuth();

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  }, []);

  const handleCelebrationComplete = useCallback(() => {
    setShowCelebration(false);
  }, []);

  useEffect(() => {
    getVersion().then((v) => {
        setVersion(v);
        setLoadingVersion(false);
    });

    // Ping Appwrite to verify connection (for Onboarding Wizard)
    try {
        // @ts-ignore
        if (client && typeof client.ping === 'function') { 
            // @ts-ignore
            client.ping(); 
        }
    } catch (e) { console.error('Ping failed', e); }

    // Deep Link Listener for OAuth
    // The plugin listener returns a promise that resolves to an unlisten function
    let unlisten: (() => void) | undefined;

    onOpenUrl(async (urls) => {
      console.log('Deep link received:', urls);
      for (const url of urls) {
        if (url.includes('secret=') && url.includes('userId=')) {
           const urlObj = new URL(url);
           const secret = urlObj.searchParams.get('secret');
           const userId = urlObj.searchParams.get('userId');
           if (secret && userId) {
             try {
               await account.createSession(userId, secret);
               await checkSession();
               showToast('Successfully logged in!', 'success');
             } catch(e: any) {
               showToast('Login failed: ' + e.message, 'error');
             }
           }
        }
      }
    }).then((fn) => { unlisten = fn; });

    return () => {
        if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    // Timeout fallback - if backend doesn't respond in 5 seconds, show welcome screen
    const timeout = setTimeout(() => {
      if (showWelcome === null) {
        console.warn('Backend initialization timeout - showing welcome screen');
        setShowWelcome(true);
      }
    }, 5000);

    invoke<boolean>('check_onboarding_complete').then((complete) => {
      clearTimeout(timeout);
      setShowWelcome(!complete);
      if (complete) {
        check().then(async (update) => {
          if (update) {
            const yes = await ask(
              `Clipme v${update.version} is available!\n\nRelease Notes:\n${update.body}`, 
              { title: 'Update Available', kind: 'info', okLabel: 'Update Now', cancelLabel: 'Later' }
            );
            if (yes) {
              await update.downloadAndInstall();
              await relaunch();
            }
          }
        }).catch(console.error);

        invoke<string>('get_download_path').then(setDownloadPath).catch(console.error);
        invoke<LicenseInfo>('get_license_status').then((license) => {
          setIsPro(license.is_pro);
          invoke<AppSettings>('get_app_settings').then((settings) => {
            if (settings.preferred_quality) {
              setPreferredQuality(settings.preferred_quality);
            }
            if (license.is_pro && settings.preferred_quality) {
                 setSelectedQuality(settings.preferred_quality);
            } else if (license.is_pro) {
                 setSelectedQuality('Best');
            }
          }).catch(console.error);
        }).catch(console.error);
      }
    }).catch((err) => {
      clearTimeout(timeout);
      console.error('Onboarding check failed:', err);
      setShowWelcome(true);
    });

    return () => clearTimeout(timeout);
  }, []);

  // Sync license from account to local globally
  const syncLock = useRef(false);

  useEffect(() => {
     // @ts-ignore
     const prefs = user?.prefs as any;
     // Only sync if:
     // 1. User is logged in
     // 2. User has a license key in prefs
     // 3. We are not currently verifying (check ref for immediate lock)
     // 4. We are not already Pro (or we want to re-validate on login)
     if (user && prefs?.licenseKey && !syncLock.current && !isPro) {
        console.log('Found license on account, syncing globally...');
        syncLock.current = true;
        invoke<LicenseInfo>('verify_license', { licenseKey: prefs.licenseKey })
          .then(result => {
             if (result.is_valid) {
                 // Update local state
                 setIsPro(true);
                 // Only show celebration if NOT in onboarding (WelcomeScreen handles its own celebration)
                 if (!showWelcome) {
                     setShowCelebration(true);
                 }
                 showToast('License synced from account!', 'success');
             }
          })
          .catch(err => {
             console.error('Global license sync failed', err);
          })
          .finally(() => {
             syncLock.current = false;
          });
     }
  }, [user, isPro, showWelcome]); // Dependencies: user changes (login) or isPro changes

  useEffect(() => {
    const unlisten = listen<DownloadProgress>('download-progress', (event) => {
      if (event.payload.id === downloadSessionRef.current) {
        setProgress(event.payload);
      }
    });

    return () => { unlisten.then(fn => fn()); };
  }, []);

  const handleUrlSubmit = async (inputUrl: string, isLocal: boolean = false) => {
    setLoading(true);
    showToast(`${isLocal ? 'Analyzing file' : 'Fetching video metadata'}...`, 'info');
    setVideoMeta(null);
    setIsLocalFile(isLocal);
    setOriginalResolution(null);

    try {
      const meta = await invoke<VideoMetadata>('get_video_metadata', { url: inputUrl });
      setVideoMeta(meta);
      setRange([0, meta.duration]);
      setUrl(inputUrl);
      setToast(null);
      if (meta.formats && meta.formats.length > 0) {
        // Infer original resolution for local files (assuming 1st is best/original)
        if (isLocal) {
             setOriginalResolution(meta.formats[0]);
        }

        if (isPro) {
          setSelectedQuality(meta.formats[0]);
        } else {
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

  const handleFileSelect = (path: string) => {
      handleUrlSubmit(path, true);
  };

  const handleDownload = async () => {
    if (!videoMeta || !url) return;
    setProgress(null);
    
    if (downloading) {
      showToast('Cancelling...', 'info');
      try {
        await invoke('cancel_download');
        showToast('Download cancelled.', 'info');
      } catch (error) {
        showToast('Failed to cancel: ' + error, 'error');
      }
      setDownloading(false);
      downloadSessionRef.current = 0;
      return;
    }

    const sessionId = Date.now();
    downloadSessionRef.current = sessionId;
    setDownloading(true);
    setProgress({ percent: 0, speed: 'Starting', eta: '', downloaded: '', total: '', id: sessionId });

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
          setDownloading(false);
          setProgress(null);
          return;
        }
      } catch (err) {
        showToast('Failed to select folder', 'error');
        setDownloading(false);
        setProgress(null);
        return;
      }
    }
    
    try {
      // Multi-Clip Mode
      if (multiClipEnabled && isPro && segments.length > 0) {
        const results = await invoke<string[]>('download_multi_clip', { 
          url, 
          title: videoMeta.title,
          segments: segments,
          quality: selectedQuality,
          format: containerFormat,
          id: sessionId 
        });
        showToast(`${results.length} clips exported to ${targetPath}`, 'success');
        
        // Save each clip to history
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          const historyItem = {
            id: `${Date.now()}-${i}`,
            title: `${videoMeta.title} (Clip ${i + 1})`,
            url: url,
            thumbnail: videoMeta.preview_url || undefined,
            duration: seg.end - seg.start,
            quality: selectedQuality,
            format: containerFormat,
            filePath: results[i] || `${targetPath}/${videoMeta.title}_clip${i + 1}.${containerFormat}`,
            downloadedAt: new Date().toISOString(),
          };
          invoke('save_download_history', { item: historyItem }).catch(console.error);
        }
      } else {
        // Single Clip Mode
        await invoke('download_clip', { 
          url, 
          title: videoMeta.title,
          start: range[0], 
          end: range[1],
          quality: selectedQuality,
          format: containerFormat,
          id: sessionId 
        });
        showToast('Download complete! Saved to ' + targetPath, 'success');
        
        // Save to download history (Pro feature)
        if (isPro) {
          const historyItem = {
            id: `${Date.now()}`,
            title: videoMeta.title,
            url: url,
            thumbnail: videoMeta.preview_url || undefined,
            duration: range[1] - range[0],
            quality: selectedQuality,
            format: containerFormat,
            filePath: `${targetPath}/${videoMeta.title}_clip_${sessionId}.${containerFormat}`,
            downloadedAt: new Date().toISOString(),
          };
          invoke('save_download_history', { item: historyItem }).catch(console.error);
        }
      }
    } catch (error) {
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
      showToast('Failed to set download path', 'error');
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

  // Show loading screen while initializing
  if (showWelcome === null) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-primary, #0a0a0a)',
        color: 'white',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <img src="/clipme-logo-white.svg" alt="Clipme" style={{ height: '48px', opacity: 0.8 }} />
        <div style={{ fontSize: '0.9rem', opacity: 0.6 }}>Loading...</div>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await logout();
      await invoke('clear_license');
      setIsPro(false);
      showToast('Logged out successfully', 'success');
    } catch (e) {
      console.error('Logout error:', e);
      showToast('Error logging out', 'error');
    }
  };

  if (showWelcome) {
    return (
      <>
        <Celebration show={showCelebration} onComplete={handleCelebrationComplete} />
        <WelcomeScreen 
          onComplete={handleWelcomeComplete} 
          onLicenseActivated={() => setShowCelebration(true)}
          isPro={isPro}
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
              if (preferredQuality) setSelectedQuality(preferredQuality);
              else setSelectedQuality('Best');
              
              if (wasFree || newIsPro) setShowCelebration(true);
            } else {
              setSelectedQuality('720p');
            }
          }).catch(console.error);
        }}
        preferredQuality={preferredQuality}
        onPreferredQualityChange={(quality) => {
          setPreferredQuality(quality);
          invoke('save_app_settings', { settings: { preferred_quality: quality } }).catch(console.error);
          if (isPro && quality) setSelectedQuality(quality);
        }}
      />

      {/* Titlebar Drag Region - for macOS window dragging */}
      <div className="titlebar-drag-region" data-tauri-drag-region>
        <TitlebarActions 
          isPro={isPro}
          onClipboardUrl={(detectedUrl) => {
            setUrl(detectedUrl);
            handleUrlSubmit(detectedUrl, false);
          }}
          onOpenHistory={() => setShowHistory(true)}
          showToast={showToast}
        />
      </div>

      {/* Download History Panel */}
      <DownloadHistory 
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        isPro={isPro}
        showToast={showToast}
      />

      {/* Top Bar */}
      <div className="top-bar">
        <UserMenu 
          user={user}
          onProfileClick={() => setShowAuthModal(true)}
          onSettingsClick={() => setShowSettings(true)}
          onLogout={handleLogout}
        />
        <div className="top-bar-logo">
          <img src="/clipme-logo-white.svg" alt="clipme" className="logo-dark" />
          <img src="/clipme-logo-black.svg" alt="clipme" className="logo-light" />
        </div>
        <ProBadge isPro={isPro} onProActivated={() => {
          setIsPro(true);
          setSelectedQuality('Best');
          setShowCelebration(true);
        }} />
      </div>

      <Celebration show={showCelebration} onComplete={() => setShowCelebration(false)} />

      <div className="main-content">
        <header className="header" style={{ marginBottom: videoMeta ? '0.5rem' : '2rem' }}>
          {!videoMeta && <p>Paste a video link or drop a file to start.</p>}
        </header>

        <div className="input-section">
          <div className="card">
            <UrlInput onUrlSubmit={(u) => handleUrlSubmit(u, false)} isLoading={loading} />
          </div>
        </div>

        {/* File Drop Zone with Peeking UI */}
        <FileDropZone 
            onFileSelect={handleFileSelect} 
            onError={(msg) => showToast(msg, 'error')}
            isPro={isPro} 
        />

        {videoMeta && (
          <div className="content-grid fade-in">
            <div className="preview-column">
              <VideoPreview url={url} previewUrl={videoMeta.preview_url} />
              <h2>{videoMeta.title}</h2>
            </div>

            <div className="controls-column">
              {/* Mode Toggle */}
              <div className="clip-mode-toggle">
                <button 
                  className={`mode-btn ${!multiClipEnabled ? 'active' : ''}`}
                  onClick={() => setMultiClipEnabled(false)}
                >
                  Single Clip
                </button>
                <button 
                  className={`mode-btn ${multiClipEnabled ? 'active' : ''} ${!isPro ? 'pro-locked' : ''}`}
                  onClick={() => {
                    if (!isPro) {
                      showToast('Multi-Clip is a Pro feature', 'info');
                      return;
                    }
                    setMultiClipEnabled(true);
                    // Initialize with current range if switching to multi-clip
                    if (segments.length === 0) {
                      setSegments([{ id: `clip-${Date.now()}`, start: range[0], end: range[1] }]);
                    }
                  }}
                >
                  Multi-Clip
                  {!isPro && <span className="pro-badge-inline">PRO</span>}
                </button>
              </div>

              {/* Timeline: Single or Multi-Clip */}
              {multiClipEnabled && isPro ? (
                <MultiClipTimeline
                  duration={videoMeta.duration}
                  segments={segments}
                  onSegmentsChange={setSegments}
                  isPro={isPro}
                  onProRequired={() => showToast('Multi-Clip is a Pro feature', 'info')}
                />
              ) : (
                <Timeline 
                  duration={videoMeta.duration} 
                  range={range} 
                  onChange={setRange} 
                />
              )}

              <div className="card">
                <h3>{isLocalFile ? 'Transcode & Clip' : 'Output Settings'}</h3>
                
                <div className="settings-row">
                  <div className="quality-select">
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.4rem', 
                      fontSize: '0.85rem', 
                      color: 'var(--text-secondary)' 
                    }}>
                      {isLocalFile ? 'Target Quality' : 'Quality'}
                    </label>
                    <select 
                      value={selectedQuality} 
                      onChange={(e) => setSelectedQuality(e.target.value)}
                      disabled={downloading}
                    >
                      {videoMeta.formats.map(fmt => {
                        const isProOnly = !FREE_QUALITIES.includes(fmt);
                        
                        // Local File Logic: Can't choose quality higher than original
                        // Assume formats are ordered Best -> Worst or we parse them
                        // Simple Logic: If isLocalFile, disable qualities that seem higher? 
                        // Actually lib.rs generates the list based on max height, so the list IS valid downscales only!
                        // e.g. if file is 1080p, list is Best, 1080p, 720p... 
                        // So we don't need complex frontend checks here because backend already filtered the list!
                        
                        // Check Transcoding is PRO only logic
                        // If isLocalFile and not Pro, maybe restrict to "Best" (Copy) only?
                        // User said: "Transcoden ist ebenfalls eine Premium Funktion."
                        // So if not Pro, they can only keep original (Best)?
                        
                        const isTranscoding = isLocalFile && fmt !== (originalResolution || 'Best') && fmt !== 'Best';
                        const locked = (!isPro && isProOnly) || (isLocalFile && !isPro && isTranscoding);

                        return (
                          <option key={fmt} value={fmt} disabled={locked}>
                            {fmt}{locked ? ' (Pro)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="quality-select" style={{ minWidth: '80px' }}>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.4rem', 
                      fontSize: '0.85rem', 
                      color: 'var(--text-secondary)' 
                    }}>
                      Format
                    </label>
                    <select 
                      value={containerFormat} 
                      onChange={(e) => setContainerFormat(e.target.value)}
                      disabled={downloading}
                    >
                      <option value="mp4">MP4</option>
                      <option value="mov">MOV</option>
                      <option value="mkv">MKV</option>
                      <option value="avi">AVI</option>
                      <option value="webm">WEBM</option>
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

                {downloading && progress && (
                  <div style={{ marginTop: '1rem' }}>
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

      <div className="bottom-bar">
        <div 
          className="version-badge" 
          onClick={checkForUpdates}
          title="Check for updates"
        >
          <img src="/stars.svg" alt="" width="14" height="14" />
          <span>{loadingVersion ? 'Checking...' : `v${version}`}</span>
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

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
      
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}

export default App;

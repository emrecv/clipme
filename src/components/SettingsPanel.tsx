import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { check } from '@tauri-apps/plugin-updater';
import { ask } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';
import { useAuth } from '../contexts/AuthContext';
import { account } from '../lib/appwrite';

interface LicenseInfo {
  is_valid: boolean;
  is_pro: boolean;
  license_key: string | null;
  email: string | null;
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isPro: boolean;
  onLicenseChange: (isPro?: boolean) => void;
  preferredQuality: string | null;
  onPreferredQualityChange: (quality: string) => void;
}

export function SettingsPanel({ 
  isOpen, 
  onClose, 
  isPro, 
  onLicenseChange, 
  preferredQuality, 
  onPreferredQualityChange 
}: SettingsPanelProps) {
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [newLicenseKey, setNewLicenseKey] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [version, setVersion] = useState('');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  useEffect(() => {
    if (isOpen) {
      invoke<LicenseInfo>('get_license_status').then(setLicenseInfo).catch(console.error);
      getVersion().then(setVersion).catch(console.error);
    }
  }, [isOpen]);

  const handleCheckUpdate = async () => {
      setIsCheckingUpdate(true);
      try {
          const update = await check();
          if (update) {
              const yes = await ask(
                `Clipme v${update.version} is available!\n\nRelease Notes:\n${update.body}`, 
                { title: 'Update Available', kind: 'info', okLabel: 'Update Now', cancelLabel: 'Later' }
              );
              if (yes) {
                await update.downloadAndInstall();
                await relaunch();
              }
          } else {
              await ask('You are on the latest version.', { title: 'No Update Available', kind: 'info', okLabel: 'OK' });
          }
      } catch (e) {
          console.error(e);
          // await ask(`Failed to check for updates: ${e}`, { title: 'Error', kind: 'error' });
      } finally {
          setIsCheckingUpdate(false);
      }
  };

  const { user, checkSession } = useAuth();

  const handleVerify = async () => {
    if (!newLicenseKey.trim()) {
      setError('Please enter a license key');
      return;
    }
    setIsVerifying(true);
    setError('');
    try {
      const result = await invoke<LicenseInfo>('verify_license', { licenseKey: newLicenseKey.trim() });
      if (result.is_valid) {
        setLicenseInfo(result);
        setNewLicenseKey('');
        // Notify parent that we are now Pro
        onLicenseChange(true);

        // Sync to account if logged in
        if (user) {
           try {
             const prefs = user.prefs as any;
             await account.updatePrefs({ ...prefs, licenseKey: newLicenseKey.trim() });
             await checkSession(); // Refresh user state
           } catch(e) {
             console.error('Failed to sync license to account', e);
           }
        }
      } else {
        setError('Invalid or expired license');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClearLicense = async () => {
    setIsClearing(true);
    try {
      await invoke('clear_license');
      setLicenseInfo({ is_valid: false, is_pro: false, license_key: null, email: null });
      onLicenseChange();
    } catch (err) {
      console.error(err);
    } finally {
      setIsClearing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose}>×</button>
        </div>

        <div className="settings-content">
          {/* License Section */}
          <div className="settings-section">
            <h3>Preferences</h3>
            <div className="settings-input-group">
              <label className="settings-label">
                Preferred Quality
                {!isPro && <span className="pro-tag">PRO</span>}
              </label>
              <div className="select-wrapper">
                <select 
                  className={`settings-select ${!isPro ? 'disabled' : ''}`}
                  value={isPro ? (preferredQuality || 'Best') : '720p'}
                  onChange={(e) => isPro && onPreferredQualityChange(e.target.value)}
                  disabled={!isPro}
                >
                  <option value="Best">Best Available</option>
                  <option value="8K">8K (Ultra HD)</option>
                  <option value="4K">4K (Ultra HD)</option>
                  <option value="1440p">1440p (QHD)</option>
                  <option value="1080p">1080p (Full HD)</option>
                  <option value="720p">720p (HD)</option>
                  <option value="480p">480p</option>
                  <option value="Audio Only">Audio Only</option>
                </select>
                {!isPro && (
                  <div className="lock-overlay" title="Unlock Pro to change default quality">
                    🔒
                  </div>
                )}
              </div>
              {!isPro && (
                <p className="settings-hint">Free version is limited to 720p. Upgrade to choose your quality.</p>
              )}
            </div>
          </div>

          <div className="settings-section">
            <h3>License</h3>
            
            <div className="license-status-card">
              <div className="license-status-row">
                <span className="license-label">Status</span>
                {isPro ? (
                  <div className="license-pro-badge">
                    <img src="/pro-star-icon-main.svg" alt="" width="16" height="16" />
                    Pro
                  </div>
                ) : (
                  <span className="license-free">Free</span>
                )}
              </div>

              {user && licenseInfo?.license_key === (user.prefs as any)?.licenseKey && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--primary-color)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }}></span>
                    Linked to {user.email}
                  </div>
              )}

              {licenseInfo?.license_key && (
                <div className="license-status-row">
                  <span className="license-label">License Key</span>
                  <span className="license-key-display">
                    {licenseInfo.license_key.substring(0, 8)}...
                  </span>
                </div>
              )}

              {licenseInfo?.email && (
                <div className="license-status-row">
                  <span className="license-label">Email</span>
                  <span className="license-email">{licenseInfo.email}</span>
                </div>
              )}

              {isPro && (
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    className="settings-button danger"
                    onClick={handleClearLicense}
                    disabled={isClearing}
                    style={{ fontSize: '0.8rem', padding: '0.6rem 1rem' }}
                  >
                    {isClearing ? 'Removing...' : 'Remove License'}
                  </button>
                </div>
              )}
            </div>

            {!isPro && (
              <div className="license-activate-section">
                <input
                  type="text"
                  className="settings-input"
                  placeholder="Enter license key..."
                  value={newLicenseKey}
                  onChange={(e) => setNewLicenseKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                />
                {error && <span className="settings-error">{error}</span>}
                <button 
                  className="settings-button primary"
                  onClick={handleVerify}
                  disabled={isVerifying}
                >
                  {isVerifying ? 'Verifying...' : 'Activate License'}
                </button>
                <a 
                  href="https://demonicshop.gumroad.com/l/clipme" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="settings-link"
                >
                  Get a Pro license →
                </a>
              </div>
            )}
          </div>

            {/* Application Section */}
            <div className="settings-section">
              <h3>About</h3>
              <div className="license-status-card">
                 <div className="license-status-row">
                    <span className="license-label">Version</span>
                    <span className="license-key-display">v{version}</span>
                 </div>
                 <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      className="settings-button primary"
                      onClick={handleCheckUpdate}
                      disabled={isCheckingUpdate}
                      style={{ fontSize: '0.8rem', padding: '0.6rem 1rem' }}
                    >
                      {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
                    </button>
                 </div>
              </div>
            </div>

            {/* Developer Section */}
            <div className="settings-section" style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <h3 style={{ color: '#ff6b6b' }}>Danger Zone</h3>
            <p className="settings-hint" style={{ marginBottom: '1rem' }}>
              Only use this if you are experiencing issues. This will reset all local data.
            </p>
            <button 
              className="settings-button danger"
              onClick={async () => {
                try {
                   // Ensure we logout from Appwrite session
                   await checkSession();
                  if (user) {
                     await account.deleteSession('current');
                  }
                } catch(e) { console.error('Logout failed', e); }
                
                await invoke('reset_app');
                window.location.reload();
              }}
              style={{ width: '100%' }}
            >
              Factory Reset App
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

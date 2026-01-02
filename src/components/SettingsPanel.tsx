import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

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

  useEffect(() => {
    if (isOpen) {
      invoke<LicenseInfo>('get_license_status').then(setLicenseInfo).catch(console.error);
    }
  }, [isOpen]);

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
            <h3>Download Preferences</h3>
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
            </div>

            {isPro ? (
              <button 
                className="settings-button danger"
                onClick={handleClearLicense}
                disabled={isClearing}
              >
                {isClearing ? 'Removing...' : 'Remove License'}
              </button>
            ) : (
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

          {/* Developer Section */}
          <div className="settings-section">
            <h3>Developer</h3>
            <button 
              className="settings-button danger"
              onClick={async () => {
                await invoke('reset_app');
                window.location.reload();
              }}
            >
              Reset App (Show Onboarding)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

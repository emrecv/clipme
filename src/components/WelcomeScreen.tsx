import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

interface LicenseInfo {
  is_valid: boolean;
  is_pro: boolean;
  license_key: string | null;
  email: string | null;
}

interface WelcomeScreenProps {
  onComplete: (settings: { downloadPath: string; askEachTime: boolean; isPro: boolean }) => void;
  onLicenseActivated?: () => void;
}

export function WelcomeScreen({ onComplete, onLicenseActivated }: WelcomeScreenProps) {
  const [step, setStep] = useState(1);
  const [downloadOption, setDownloadOption] = useState<'default' | 'custom' | 'ask'>('default');
  const [customPath, setCustomPath] = useState('');
  const [isSelecting, setIsSelecting] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseError, setLicenseError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isPro, setIsPro] = useState(false);

  const handleSelectFolder = async () => {
    setIsSelecting(true);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Choose Download Folder',
      });
      if (selected && typeof selected === 'string') {
        setCustomPath(selected);
        setDownloadOption('custom');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSelecting(false);
    }
  };

  const handleVerifyLicense = async () => {
    if (!licenseKey.trim()) {
      setLicenseError('Please enter a license key');
      return;
    }
    
    setIsVerifying(true);
    setLicenseError('');
    
    try {
      const result = await invoke<LicenseInfo>('verify_license', { licenseKey: licenseKey.trim() });
      if (result.is_valid) {
        setIsPro(true);
        onLicenseActivated?.();
        setStep(3); // Go to Pro Success step
      } else {
        setLicenseError('License key is invalid or expired');
      }
    } catch (err) {
      setLicenseError(String(err));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFinish = async () => {
    let finalPath = '';
    let askEachTime = false;

    if (downloadOption === 'default') {
      try {
        finalPath = await invoke<string>('get_download_path');
      } catch {
        finalPath = '';
      }
    } else if (downloadOption === 'custom') {
      finalPath = customPath;
      if (finalPath) {
        await invoke('set_download_path', { path: finalPath });
      }
    } else if (downloadOption === 'ask') {
      askEachTime = true;
      try {
        finalPath = await invoke<string>('get_download_path');
      } catch {
        finalPath = '';
      }
    }

    await invoke('set_onboarding_complete');
    onComplete({ downloadPath: finalPath, askEachTime, isPro });
  };

  return (
    <div className="welcome-overlay">
      <div className="welcome-card">
        {step === 1 && (
          <div className="welcome-step fade-in">
            <div className="welcome-icon">
              <img src="/clipme-logo-white.svg" alt="Clipme" height="48" />
            </div>
            <h1>Welcome to Clipme</h1>
            <p>Clip and download your favorite YouTube moments in seconds.</p>
            <button className="welcome-button primary" onClick={() => setStep(2)}>
              Get Started
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="welcome-step fade-in">
            <h2>Have a license key?</h2>
            <p className="welcome-subtitle">Unlock Pro features for 1080p, 4K, and 8K downloads</p>

            <div className="license-input-wrapper">
              <input
                type="text"
                className="license-input"
                placeholder="Enter your license key..."
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyLicense()}
              />
              {licenseError && <span className="license-error">{licenseError}</span>}
            </div>

            <div className="welcome-actions">
              <button className="welcome-button secondary" onClick={() => setStep(4)}>
                Skip (Free)
              </button>
              <button 
                className="welcome-button primary" 
                onClick={handleVerifyLicense}
                disabled={isVerifying}
              >
                {isVerifying ? 'Verifying...' : 'Activate Pro'}
              </button>
            </div>

            <p className="welcome-hint">
              <a href="https://emrecv.gumroad.com/l/clipme-pro" target="_blank" rel="noopener noreferrer">
                Get a license key →
              </a>
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="welcome-step fade-in">
            <div className="welcome-icon">
              <img src="/pro-star-icon-main.svg" alt="Pro" height="48" style={{ filter: 'drop-shadow(0 0 10px rgba(255, 214, 10, 0.5))' }} />
            </div>
            <h1>Thank you for upgrading!</h1>
            <p className="welcome-subtitle">You've unlocked the full potential of Clipme.</p>

            <div className="pro-features-list">
              <div className="pro-feature-item">
                <span className="feature-check">✓</span>
                <span>Unrestricted 1080p, 4K & 8K Downloads</span>
              </div>
              <div className="pro-feature-item">
                <span className="feature-check">✓</span>
                <span>Priority Support</span>
              </div>
              <div className="pro-feature-item">
                <span className="feature-check">✓</span>
                <span>Support Future Development</span>
              </div>
            </div>

            <button className="welcome-button primary" onClick={() => setStep(4)}>
              Continue
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="welcome-step fade-in">
            {isPro && (
              <div className="pro-badge">
                <img src="/pro-star-icon-main.svg" alt="" width="16" height="16" />
                Pro Activated!
              </div>
            )}
            <h2>Where should we save your clips?</h2>
            <p className="welcome-subtitle">Choose how you want to handle downloads</p>

            <div className="welcome-options">
              <label 
                className={`welcome-option ${downloadOption === 'default' ? 'selected' : ''}`}
                onClick={() => setDownloadOption('default')}
              >
                <div className="option-radio">
                  <div className={`radio-dot ${downloadOption === 'default' ? 'active' : ''}`} />
                </div>
                <div className="option-content">
                  <span className="option-title">Downloads folder</span>
                  <span className="option-desc">Save to your default Downloads folder</span>
                </div>
              </label>

              <label 
                className={`welcome-option ${downloadOption === 'custom' ? 'selected' : ''}`}
                onClick={handleSelectFolder}
              >
                <div className="option-radio">
                  <div className={`radio-dot ${downloadOption === 'custom' ? 'active' : ''}`} />
                </div>
                <div className="option-content">
                  <span className="option-title">
                    {customPath ? customPath.split('/').slice(-2).join('/') : 'Choose a folder...'}
                  </span>
                  <span className="option-desc">
                    {isSelecting ? 'Selecting...' : 'Pick a specific folder for your clips'}
                  </span>
                </div>
              </label>

              <label 
                className={`welcome-option ${downloadOption === 'ask' ? 'selected' : ''}`}
                onClick={() => setDownloadOption('ask')}
              >
                <div className="option-radio">
                  <div className={`radio-dot ${downloadOption === 'ask' ? 'active' : ''}`} />
                </div>
                <div className="option-content">
                  <span className="option-title">Ask me each time</span>
                  <span className="option-desc">Choose where to save every download</span>
                </div>
              </label>
            </div>

            <div className="welcome-actions">
              <button 
                className="welcome-button secondary" 
                onClick={() => setStep(isPro ? 3 : 2)}
              >
                Back
              </button>
              <button className="welcome-button primary" onClick={handleFinish}>
                Finish
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

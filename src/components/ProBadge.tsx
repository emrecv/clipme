import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface LicenseInfo {
  is_valid: boolean;
  is_pro: boolean;
  license_key: string | null;
  email: string | null;
}

interface ProBadgeProps {
  isPro: boolean;
  onProActivated: () => void;
}

export function ProBadge({ isPro, onProActivated }: ProBadgeProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowPopup(false);
      }
    };
    if (showPopup) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPopup]);

  const handleVerify = async () => {
    if (!licenseKey.trim()) {
      setError('Please enter a license key');
      return;
    }
    setIsVerifying(true);
    setError('');
    try {
      const result = await invoke<LicenseInfo>('verify_license', { licenseKey: licenseKey.trim() });
      if (result.is_valid) {
        setShowPopup(false);
        onProActivated();
      } else {
        setError('Invalid or expired license');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsVerifying(false);
    }
  };

  if (isPro) {
    return (
      <div className="pro-badge-inline">
        <img src="/pro-star-icon-main.svg" alt="" width="18" height="18" />
        <span>Pro</span>
      </div>
    );
  }

  return (
    <div className="pro-badge-wrapper" ref={popupRef}>
      <button className="upgrade-button" onClick={() => setShowPopup(!showPopup)}>
        <img src="/pro-star-icon-main.svg" alt="" width="16" height="16" className="star-icon-dark" />
        Upgrade to Pro
      </button>

      {showPopup && (
        <div className="pro-popup">
          <div className="popup-section">
            <div className="popup-label">
              <img src="/key-icon-yellow.svg" alt="" width="16" height="16" />
              Already have a license?
            </div>
            <input
              type="text"
              className="popup-input"
              placeholder="Enter license key..."
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            />
            {error && <span className="popup-error">{error}</span>}
            <button 
              className="popup-button activate"
              onClick={handleVerify}
              disabled={isVerifying}
            >
              {isVerifying ? 'Verifying...' : 'Activate'}
            </button>
          </div>

          <div className="popup-divider" />

          <a 
            href="https://demonicshop.gumroad.com/l/clipme" 
            target="_blank" 
            rel="noopener noreferrer"
            className="popup-button get-license"
          >
            Get a License →
          </a>
        </div>
      )}
    </div>
  );
}

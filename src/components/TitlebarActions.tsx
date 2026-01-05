import React, { useState, useEffect, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Pin, PinOff, Clipboard, ClipboardCheck, Sun, Moon, Monitor, History } from 'lucide-react';

type Theme = 'dark' | 'light' | 'system';

interface TitlebarActionsProps {
  isPro: boolean;
  onClipboardUrl?: (url: string) => void;
  onOpenHistory?: () => void;
  showToast: (message: string, type: 'info' | 'success' | 'error') => void;
}

// URL patterns for supported platforms
const URL_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=[\w-]+/i,
  /(?:https?:\/\/)?(?:www\.)?youtu\.be\/[\w-]+/i,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/[\w-]+/i,
  /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[\w-]+/i,
  /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/i,
  /(?:https?:\/\/)?(?:vm\.)?tiktok\.com\/[\w-]+/i,
  /(?:https?:\/\/)?(?:www\.)?twitter\.com\/\w+\/status\/\d+/i,
  /(?:https?:\/\/)?(?:www\.)?x\.com\/\w+\/status\/\d+/i,
];

const extractUrl = (text: string): string | null => {
  for (const pattern of URL_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
};

export const TitlebarActions: React.FC<TitlebarActionsProps> = ({ 
  isPro, 
  onClipboardUrl,
  onOpenHistory,
  showToast 
}) => {
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [isClipboardMonitoring, setIsClipboardMonitoring] = useState(false);
  const [theme, setTheme] = useState<Theme>('dark');
  const [lastClipboard, setLastClipboard] = useState('');

  // Always on Top toggle
  const toggleAlwaysOnTop = useCallback(async () => {
    if (!isPro) {
      showToast('Always on Top is a Pro feature', 'info');
      return;
    }
    
    try {
      const appWindow = getCurrentWindow();
      const newValue = !isAlwaysOnTop;
      await appWindow.setAlwaysOnTop(newValue);
      setIsAlwaysOnTop(newValue);
      showToast(newValue ? 'Window pinned on top' : 'Window unpinned', 'success');
    } catch (error) {
      console.error('Failed to toggle always on top:', error);
      showToast('Failed to pin window', 'error');
    }
  }, [isPro, isAlwaysOnTop, showToast]);

  // Clipboard monitoring
  const toggleClipboardMonitor = useCallback(() => {
    if (!isPro) {
      showToast('Clipboard Monitor is a Pro feature', 'info');
      return;
    }
    
    const newValue = !isClipboardMonitoring;
    setIsClipboardMonitoring(newValue);
    showToast(
      newValue ? 'Clipboard monitoring enabled' : 'Clipboard monitoring disabled', 
      'success'
    );
  }, [isPro, isClipboardMonitoring, showToast]);

  // Clipboard polling effect
  useEffect(() => {
    if (!isClipboardMonitoring || !isPro) return;

    const checkClipboard = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text && text !== lastClipboard) {
          const url = extractUrl(text);
          if (url) {
            setLastClipboard(text);
            onClipboardUrl?.(url);
            showToast('Video URL detected!', 'success');
          }
        }
      } catch (error) {
        // Clipboard access denied - silently ignore
      }
    };

    const interval = setInterval(checkClipboard, 1000);
    return () => clearInterval(interval);
  }, [isClipboardMonitoring, isPro, lastClipboard, onClipboardUrl, showToast]);

  // Theme toggle
  const cycleTheme = useCallback(() => {
    const themes: Theme[] = ['dark', 'light', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setTheme(nextTheme);
    
    // Apply theme to document
    const root = document.documentElement;
    if (nextTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('light', !prefersDark);
    } else {
      root.classList.toggle('light', nextTheme === 'light');
    }
    
    // Save preference
    localStorage.setItem('clipme-theme', nextTheme);
    showToast(`Theme: ${nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1)}`, 'info');
  }, [theme, showToast]);

  // Load saved theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('clipme-theme') as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
      const root = document.documentElement;
      if (savedTheme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('light', !prefersDark);
      } else {
        root.classList.toggle('light', savedTheme === 'light');
      }
    }
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('light', !e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const getThemeIcon = () => {
    switch (theme) {
      case 'light': return <Sun size={16} />;
      case 'dark': return <Moon size={16} />;
      case 'system': return <Monitor size={16} />;
    }
  };

  const handleOpenHistory = useCallback(() => {
    if (!isPro) {
      showToast('Download History is a Pro feature', 'info');
      return;
    }
    onOpenHistory?.();
  }, [isPro, onOpenHistory, showToast]);

  return (
    <div className="titlebar-actions">
      {/* Theme Toggle - Free for all */}
      <button 
        className="titlebar-action-btn"
        onClick={cycleTheme}
        title={`Theme: ${theme}`}
      >
        {getThemeIcon()}
      </button>

      {/* Download History - Pro */}
      <button 
        className={`titlebar-action-btn ${!isPro ? 'pro-locked' : ''}`}
        onClick={handleOpenHistory}
        title={isPro ? 'Download History' : 'Download History (Pro)'}
      >
        <History size={16} />
        {!isPro && <span className="pro-badge-text">PRO</span>}
      </button>

      {/* Clipboard Monitor - Pro */}
      <button 
        className={`titlebar-action-btn ${isClipboardMonitoring ? 'active' : ''} ${!isPro ? 'pro-locked' : ''}`}
        onClick={toggleClipboardMonitor}
        title={isPro ? (isClipboardMonitoring ? 'Disable Clipboard Monitor' : 'Enable Clipboard Monitor') : 'Clipboard Monitor (Pro)'}
      >
        {isClipboardMonitoring ? <ClipboardCheck size={16} /> : <Clipboard size={16} />}
        {!isPro && <span className="pro-badge-text">PRO</span>}
      </button>

      {/* Always on Top - Pro */}
      <button 
        className={`titlebar-action-btn ${isAlwaysOnTop ? 'active' : ''} ${!isPro ? 'pro-locked' : ''}`}
        onClick={toggleAlwaysOnTop}
        title={isPro ? (isAlwaysOnTop ? 'Unpin Window' : 'Pin Window on Top') : 'Always on Top (Pro)'}
      >
        {isAlwaysOnTop ? <PinOff size={16} /> : <Pin size={16} />}
        {!isPro && <span className="pro-badge-text">PRO</span>}
      </button>

      <svg width="0" height="0" className="absolute pointer-events-none" style={{ position: 'absolute', opacity: 0 }}>
        <defs>
          <linearGradient id="pro-gradient" x1="0%" y1="0%" x2="100%" y2="100%" spreadMethod="repeat">
            <stop offset="0%" stopColor="#ffd60a" />
            <stop offset="50%" stopColor="#ff5f57" />
            <stop offset="100%" stopColor="#ffd60a" />
            <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="-1 0" dur="8s" repeatCount="indefinite" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

import React, { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'info' | 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ 
  message, 
  type = 'info', 
  onClose, 
  duration = 4000 
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, duration - 300);

    const closeTimer = setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, duration);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(closeTimer);
    };
  }, [duration, onClose]);

  if (!isVisible || !message) return null;

  const colors = {
    info: 'var(--primary-color)',
    success: '#22c55e',
    error: '#ef4444'
  };

  const bgColors = {
    info: 'rgba(255, 214, 10, 0.15)',
    success: 'rgba(34, 197, 94, 0.15)',
    error: 'rgba(239, 68, 68, 0.15)'
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '2rem',
        left: '50%',
        transform: `translateX(-50%) translateY(${isExiting ? '20px' : '0'})`,
        backgroundColor: bgColors[type],
        border: `1px solid ${colors[type]}`,
        borderRadius: '12px',
        padding: '1rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(12px)',
        zIndex: 1000,
        opacity: isExiting ? 0 : 1,
        transition: 'all 0.3s ease-out',
        maxWidth: '90vw',
      }}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: colors[type],
          flexShrink: 0,
        }}
      />
      <span style={{ color: 'var(--text-color)', fontSize: '0.95rem' }}>
        {message}
      </span>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(onClose, 300);
        }}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          padding: '4px',
          marginLeft: '0.5rem',
          fontSize: '1.2rem',
          lineHeight: 1,
          opacity: 0.7,
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
      >
        ×
      </button>
    </div>
  );
};

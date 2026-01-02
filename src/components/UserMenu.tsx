import React, { useState, useRef, useEffect } from 'react';

interface UserMenuProps {
  onProfileClick?: () => void;
  onSettingsClick?: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ 
  onProfileClick, 
  onSettingsClick 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      {/* Avatar Button */}
      <button 
        className="profile-button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          overflow: 'hidden',
          cursor: 'pointer',
          border: `3px solid ${isOpen ? '#2E2E2E' : '#282828'}`,
          padding: 0,
          background: 'none',
          transition: 'all 0.2s ease',
          outline: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#2E2E2E'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = isOpen ? '#2E2E2E' : '#282828'}
      >
        <svg 
          width="20" 
          height="20" 
          viewBox="-32 0 512 512" 
          fill="var(--primary-color)"
        >
          <path d="M64 224h13.5c24.7 56.5 80.9 96 146.5 96s121.8-39.5 146.5-96H384c8.8 0 16-7.2 16-16v-96c0-8.8-7.2-16-16-16h-13.5C345.8 39.5 289.6 0 224 0S102.2 39.5 77.5 96H64c-8.8 0-16 7.2-16 16v96c0 8.8 7.2 16 16 16zm40-88c0-22.1 21.5-40 48-40h144c26.5 0 48 17.9 48 40v24c0 53-43 96-96 96h-48c-53 0-96-43-96-96v-24zm72 72l12-36 36-12-36-12-12-36-12 36-36 12 36 12 12 36zm151.6 113.4C297.7 340.7 262.2 352 224 352s-73.7-11.3-103.6-30.6C52.9 328.5 0 385 0 454.4v9.6c0 26.5 21.5 48 48 48h80v-64c0-17.7 14.3-32 32-32h128c17.7 0 32 14.3 32 32v64h80c26.5 0 48-21.5 48-48v-9.6c0-69.4-52.9-125.9-120.4-133zM272 448c-8.8 0-16 7.2-16 16s7.2 16 16 16 16-7.2 16-16-7.2-16-16-16zm-96 0c-8.8 0-16 7.2-16 16v48h32v-48c0-8.8-7.2-16-16-16z"/>
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: '0',
            backgroundColor: 'var(--surface-color)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            minWidth: '160px',
            overflow: 'hidden',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <MenuItem 
            label="Profile" 
            onClick={() => { onProfileClick?.(); setIsOpen(false); }}
          />
          <MenuItem 
            label="Settings" 
            onClick={() => { onSettingsClick?.(); setIsOpen(false); }}
          />
        </div>
      )}
    </div>
  );
};

interface MenuItemProps {
  label: string;
  onClick?: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      width: '100%',
      padding: '0.75rem 1rem',
      backgroundColor: 'transparent',
      border: 'none',
      borderRadius: '0',
      color: 'var(--text-color)',
      fontSize: '0.9rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: '0',
      cursor: 'pointer',
      transition: 'background-color 0.15s',
      textTransform: 'none',
      fontWeight: '500',
      boxShadow: 'none',
      transform: 'none',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.transform = 'none';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = 'transparent';
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.transform = 'none';
    }}
  >
    <span>{label}</span>
  </button>
);

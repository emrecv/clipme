import React, { useState, useRef, useEffect } from 'react';

import { Models } from 'appwrite';

interface UserMenuProps {
  user: Models.User<Models.Preferences> | null;
  onProfileClick?: () => void;
  onSettingsClick?: () => void;
  onLogout?: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ 
  user,
  onProfileClick, 
  onSettingsClick,
  onLogout
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

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

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
          background: user ? 'var(--primary-color)' : 'none',
          color: user ? 'black' : 'var(--primary-color)',
          transition: 'all 0.2s ease',
          outline: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.2rem',
          fontWeight: 'bold',
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#2E2E2E'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = isOpen ? '#2E2E2E' : '#282828'}
      >
        {user ? (
            getInitials(user.name || user.email)
        ) : (
            <img 
              src="/user-astronaut.svg" 
              alt="User" 
              width="24" 
              height="24" 
              style={{ filter: 'brightness(0) saturate(100%) invert(88%) sepia(21%) saturate(6969%) hue-rotate(359deg) brightness(103%) contrast(103%)' }} 
            />
        )}
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
          {user ? (
             <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
                 <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-color)' }}>{user.name}</div>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
             </div>
          ) : (
            <MenuItem 
                label="Sign In / Register" 
                onClick={() => { onProfileClick?.(); setIsOpen(false); }}
            />
          )}

          {user && (
              <MenuItem 
                label="Profile" 
                onClick={() => { onProfileClick?.(); setIsOpen(false); }}
            />
          )}
          
          <MenuItem 
            label="Settings" 
            onClick={() => { onSettingsClick?.(); setIsOpen(false); }}
          />

          {user && (
             <>
               <div style={{ height: 1, background: 'var(--border-color)', margin: '0.2rem 0' }} />
               <MenuItem 
                   label="Log Out" 
                   onClick={() => { onLogout?.(); setIsOpen(false); }}
               />
             </>
          )}
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

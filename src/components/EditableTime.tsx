import React, { useState, useEffect, useRef } from 'react';

interface EditableTimeProps {
  label: string;
  value: number;
  max: number;
  onChange: (newValue: number) => void;
}

export const EditableTime: React.FC<EditableTimeProps> = ({ label, value, max, onChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [mins, setMins] = useState('0');
  const [secs, setSecs] = useState('00');
  const containerRef = useRef<HTMLDivElement>(null);

  // Initial sync from props
  useEffect(() => {
    const m = Math.floor(value / 60);
    const s = Math.floor(value % 60);
    setMins(m.toString());
    setSecs(s.toString().padStart(2, '0'));
  }, [value]);

  // Handle click outside to close edit mode
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        commitChanges();
        setIsEditing(false);
      }
    };

    if (isEditing) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, mins, secs]);

  const commitChanges = () => {
    let m = parseInt(mins, 10) || 0;
    let s = parseInt(secs, 10) || 0;

    // Basic clamps
    if (m < 0) m = 0;
    if (s < 0) s = 0;
    if (s > 59) {
        m += Math.floor(s / 60);
        s = s % 60;
    }

    let total = m * 60 + s;
    if (total > max) total = max;
    if (total < 0) total = 0;

    onChange(total);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitChanges();
      setIsEditing(false);
    }
  };

  // Format for display
  const displayMins = Math.floor(value / 60);
  const displaySecs = Math.floor(value % 60).toString().padStart(2, '0');

  if (isEditing) {
    return (
      <div ref={containerRef} style={{ display: 'inline-flex', alignItems: 'center' }}>
        <span style={{ fontWeight: 600 }}>{label}: </span>
        <span style={{ fontFamily: 'monospace', fontSize: '1rem', display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            value={mins}
            onChange={(e) => setMins(e.target.value.replace(/\D/g, ''))}
            onKeyDown={handleKeyDown}
            autoFocus
            style={{ 
              width: `${Math.max(1, mins.length) * 0.6}em`,
              background: 'transparent', 
              border: 'none', 
              borderRadius: 0,
              boxShadow: 'none',
              color: 'var(--text-color)', 
              textAlign: 'right' as const,
              fontSize: '1rem',
              fontFamily: 'monospace',
              outline: 'none',
              padding: 0,
              margin: 0,
            }}
          />
          <span>:</span>
          <input
            type="text"
            value={secs}
            onChange={(e) => setSecs(e.target.value.replace(/\D/g, '').slice(0, 2))}
            onKeyDown={handleKeyDown}
            style={{ 
              width: '1.2em',
              background: 'transparent', 
              border: 'none', 
              borderRadius: 0,
              boxShadow: 'none',
              color: 'var(--text-color)', 
              fontSize: '1rem',
              fontFamily: 'monospace',
              outline: 'none',
              padding: 0,
              margin: 0,
            }}
          />
        </span>
      </div>
    );
  }

  return (
    <div 
        onClick={() => setIsEditing(true)} 
        style={{ 
            cursor: 'pointer', 
            padding: '2px 6px', 
            borderRadius: '4px', 
            transition: 'background 0.2s',
            userSelect: 'none'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        title="Click to edit time"
    >
      <span style={{ fontWeight: 600 }}>{label}: </span>
      <span style={{ fontFamily: 'monospace', fontSize: '1rem' }}>
        {displayMins}:{displaySecs}
      </span>
    </div>
  );
};

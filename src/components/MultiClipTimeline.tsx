import React, { useState, useCallback, useEffect } from 'react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { Plus, Trash2, Maximize2, X, Lock } from 'lucide-react';

// Segment colors
const SEGMENT_COLORS = [
  '#FFD60A', // Orange/Gold (Primary)
  '#00BCD4', // Cyan
  '#4CAF50', // Green
  '#9C27B0', // Purple
  '#E91E63', // Pink
];

export interface ClipSegment {
  id: string;
  start: number;
  end: number;
}

interface MultiClipTimelineProps {
  duration: number;
  segments: ClipSegment[];
  onSegmentsChange: (segments: ClipSegment[]) => void;
  isPro: boolean;
  onProRequired?: () => void;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const generateId = (): string => {
  return `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const MultiClipTimeline: React.FC<MultiClipTimelineProps> = ({
  duration,
  segments,
  onSegmentsChange,
  isPro,
  onProRequired,
}) => {
  const [expanded, setExpanded] = useState(false);
  const maxSegments = 5;

  // Disable body scroll when modal is expanded
  useEffect(() => {
    if (expanded) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [expanded]);

  const addSegment = useCallback(() => {
    if (!isPro) {
      onProRequired?.();
      return;
    }
    
    if (segments.length >= maxSegments) return;
    
    // Find a gap or add at the end
    const lastEnd = segments.length > 0 
      ? Math.max(...segments.map(s => s.end))
      : 0;
    
    const newStart = Math.min(lastEnd, duration - 10);
    const newEnd = Math.min(newStart + 10, duration);
    
    const newSegment: ClipSegment = {
      id: generateId(),
      start: newStart,
      end: newEnd,
    };
    
    onSegmentsChange([...segments, newSegment]);
  }, [segments, duration, isPro, onProRequired, onSegmentsChange]);

  const removeSegment = useCallback((id: string) => {
    onSegmentsChange(segments.filter(s => s.id !== id));
  }, [segments, onSegmentsChange]);

  const updateSegment = useCallback((id: string, start: number, end: number) => {
    onSegmentsChange(segments.map(s => 
      s.id === id ? { ...s, start, end } : s
    ));
  }, [segments, onSegmentsChange]);

  const handleSliderChange = useCallback((id: string, val: number | number[]) => {
    if (Array.isArray(val) && val.length === 2) {
      updateSegment(id, val[0], val[1]);
    }
  }, [updateSegment]);

  const totalDuration = segments.reduce((acc, s) => acc + (s.end - s.start), 0);

  const renderTimeline = (isExpanded: boolean) => (
    <div className={`multi-clip-container ${isExpanded ? 'expanded' : ''}`}>
      {/* Header */}
      <div className="multi-clip-header">
        <h3>
          Multi-Clip Mode
          {!isPro && <span className="pro-badge-inline">PRO</span>}
        </h3>
        <div className="multi-clip-actions">
          <button 
            className="add-clip-btn"
            onClick={addSegment}
            disabled={segments.length >= maxSegments}
            title={segments.length >= maxSegments ? 'Maximum 5 clips' : 'Add another clip'}
          >
            {segments.length >= maxSegments ? <Lock size={16} /> : <Plus size={16} />}
            Add Clip
          </button>
          {!isExpanded && (
            <button 
              className="expand-btn"
              onClick={() => setExpanded(true)}
              title="Expand timeline"
            >
              <Maximize2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Visual Timeline Overview */}
      <div className="timeline-overview">
        <div className="timeline-track">
          {segments.map((segment, index) => {
            const left = (segment.start / duration) * 100;
            const width = ((segment.end - segment.start) / duration) * 100;
            return (
              <div
                key={segment.id}
                className="timeline-segment-marker"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
                }}
                title={`Clip ${index + 1}: ${formatTime(segment.start)} - ${formatTime(segment.end)}`}
              />
            );
          })}
        </div>
        <div className="timeline-ticks">
          <span>0:00</span>
          <span>{formatTime(duration / 2)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Segment List */}
      <div className="segments-list">
        {segments.length === 0 ? (
          <div className="segments-empty">
            <p>No clips yet. Click "Add Clip" to create your first segment.</p>
          </div>
        ) : (
          segments.map((segment, index) => (
            <div 
              key={segment.id} 
              className="segment-card"
              style={{ borderLeftColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
            >
              <div className="segment-header">
                <span 
                  className="segment-color-dot"
                  style={{ backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
                />
                <span className="segment-title">Clip {index + 1}</span>
                <span className="segment-duration">
                  {formatTime(segment.end - segment.start)}
                </span>
                <button 
                  className="segment-remove-btn"
                  onClick={() => removeSegment(segment.id)}
                  title="Remove clip"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              
              <div className="segment-slider">
                <Slider
                  range
                  min={0}
                  max={duration}
                  value={[segment.start, segment.end]}
                  onChange={(val) => handleSliderChange(segment.id, val)}
                  trackStyle={[{ 
                    backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
                    opacity: 0.8 
                  }]}
                  handleStyle={[
                    { borderColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length], backgroundColor: 'var(--surface-color)' },
                    { borderColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length], backgroundColor: 'var(--surface-color)' }
                  ]}
                  railStyle={{ backgroundColor: 'var(--border-color)' }}
                />
              </div>
              
              <div className="segment-times">
                <span>{formatTime(segment.start)}</span>
                <span>→</span>
                <span>{formatTime(segment.end)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      <div className="multi-clip-summary">
        <span>{segments.length} clip{segments.length !== 1 ? 's' : ''}</span>
        <span>•</span>
        <span>Total: {formatTime(totalDuration)}</span>
      </div>
    </div>
  );

  return (
    <>
      {/* Compact View */}
      <div className="card multi-clip-card">
        {renderTimeline(false)}
      </div>

      {/* Expanded Modal */}
      {expanded && (
        <div className="multi-clip-modal-overlay" onClick={() => setExpanded(false)}>
          <div className="multi-clip-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close-btn"
              onClick={() => setExpanded(false)}
            >
              <X size={24} />
            </button>
            <h2>Precision Clip Editor</h2>
            {renderTimeline(true)}
          </div>
        </div>
      )}
    </>
  );
};

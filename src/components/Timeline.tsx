import React from 'react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { EditableTime } from './EditableTime';

interface TimelineProps {
  duration: number;
  range: [number, number];
  onChange: (range: [number, number]) => void;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const Timeline: React.FC<TimelineProps> = ({ duration, range, onChange }) => {
  const handleSliderChange = (val: number | number[]) => {
    if (Array.isArray(val) && val.length === 2) {
      onChange([val[0], val[1]]);
    }
  };

  return (
    <div className="card">
        <h3>Select Clip Range</h3>
        <div style={{ padding: '0 10px' }}>
            <Slider
                range
                min={0}
                max={duration}
                value={range}
                onChange={handleSliderChange as any}
                trackStyle={[{ backgroundColor: 'var(--primary-color)' }]}
                handleStyle={[
                    { borderColor: 'var(--primary-color)', backgroundColor: 'var(--surface-color)' },
                    { borderColor: 'var(--primary-color)', backgroundColor: 'var(--surface-color)' }
                ]}
                railStyle={{ backgroundColor: 'var(--border-color)' }}
            />
        </div>
        
        <div className="range-labels" style={{ gap: '1rem' }}>
            <EditableTime 
              label="Start" 
              value={range[0]} 
              max={range[1]} 
              onChange={(newStart) => {
                const s = Math.max(0, Math.min(newStart, range[1] - 1));
                onChange([s, range[1]]);
              }} 
            />
            <EditableTime 
              label="End" 
              value={range[1]} 
              max={duration} 
              onChange={(newEnd) => {
                const e = Math.min(duration, Math.max(newEnd, range[0] + 1));
                onChange([range[0], e]);
              }} 
            />
        </div>
        <div className="range-labels">
             <span>Duration: {formatTime(range[1] - range[0])}</span>
             <span>Total: {formatTime(duration)}</span>
        </div>
    </div>
  );
};

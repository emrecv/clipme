import React, { useState, useEffect } from 'react';
import { Upload, FileVideo } from 'lucide-react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { open } from '@tauri-apps/plugin-dialog';

interface FileDropZoneProps {
  onFileSelect: (path: string) => void;
  onError: (message: string) => void;
  isPro: boolean;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({ onFileSelect, onError, isPro }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  // Global drag detection
  useEffect(() => {
    const unlisten = getCurrentWebviewWindow().onDragDropEvent((event) => {
        if (event.payload.type === 'enter') {
            setIsDragOver(true);
        } else if (event.payload.type === 'leave') {
            setIsDragOver(false);
        } else if (event.payload.type === 'drop') {
             setIsDragOver(false);
             if (event.payload.paths && event.payload.paths.length > 0) {
                 const path = event.payload.paths[0];
                 // Basic check for video extension
                 if (path.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
                     onFileSelect(path);
                 } else {
                     onError("Invalid file format. Please drop a video file (mp4, mov, avi, mkv, webm).");
                 }
             }
        }
    });

    return () => {
        unlisten.then(f => f());
    }
  }, [onFileSelect, onError]);


  const handleClick = async () => {
    try {
        const selected = await open({
            multiple: false,
            filters: [{
                name: 'Video',
                extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm']
            }]
        });
        if (selected && typeof selected === 'string') {
            onFileSelect(selected);
        }
    } catch (err) {
        console.error("Failed to open file dialog", err);
    }
  };

  return (
    <>
      {/* Full Screen Drag Popup */}
      <div 
        className={`drag-popup-overlay ${isDragOver ? 'visible' : ''}`}
      >
        <div className="drag-popup-content">
            <div className="popup-icon-circle">
                <Upload size={48} strokeWidth={1.5} />
            </div>
            <h2>Drop Video Here</h2>
            <p>Transcode & Clip Local Files {isPro ? '✨' : ''}</p>
        </div>
      </div>

      {/* Persistent Pill Button */}
      <div 
        className="file-dropzone-pill"
        onClick={handleClick}
      >
        <div className="pill-content">
           <FileVideo size={18} className="pill-icon" />
           <span className="pill-text">Open Local File</span>
        </div>
      </div>
    </>
  );
};

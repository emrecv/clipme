import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';

interface CelebrationProps {
  show: boolean;
  onComplete?: () => void;
}

export function Celebration({ show, onComplete }: CelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) {
      setVisible(false);
      return;
    }
    
    if (!canvasRef.current) return;

    setVisible(true);

    // Create confetti instance on our canvas
    const myConfetti = confetti.create(canvasRef.current, {
      resize: true,
      useWorker: true,
    });

    // Epic confetti sequence
    const duration = 3000;
    const animationEnd = Date.now() + duration;

    // Initial big burst
    myConfetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#FFD60A', '#E5C009', '#ffffff', '#f4e9b8', '#ffd700'],
      startVelocity: 45,
      gravity: 0.8,
    });

    // Side bursts
    setTimeout(() => {
      myConfetti({
        particleCount: 80,
        angle: 60,
        spread: 80,
        origin: { x: 0, y: 0.7 },
        colors: ['#FFD60A', '#E5C009', '#ffffff'],
      });
      myConfetti({
        particleCount: 80,
        angle: 120,
        spread: 80,
        origin: { x: 1, y: 0.7 },
        colors: ['#FFD60A', '#E5C009', '#ffffff'],
      });
    }, 200);

    // Continuous celebration
    const interval = setInterval(() => {
      if (Date.now() > animationEnd) {
        clearInterval(interval);
        // Start fade out
        setVisible(false);
        
        // Wait for fade out animation (1s) then unmount
        setTimeout(() => {
          onComplete?.();
        }, 1000);
        return;
      }

      myConfetti({
        particleCount: 30,
        spread: 60,
        origin: { 
          x: Math.random(),
          y: Math.random() * 0.4 
        },
        colors: ['#FFD60A', '#E5C009', '#ffffff', '#f4e9b8'],
        startVelocity: 25,
      });
    }, 150);

    return () => {
      clearInterval(interval);
      myConfetti.reset?.();
    };
  }, [show, onComplete]);

  if (!visible && !show) return null;

  return (
    <div className={`celebration-overlay ${visible ? 'active' : ''}`}>
      <canvas ref={canvasRef} className="celebration-canvas" />
      <div className="celebration-message">
        <div className="celebration-icon">🎉</div>
        <h2>Welcome to Pro!</h2>
        <p>All features unlocked</p>
      </div>
    </div>
  );
}

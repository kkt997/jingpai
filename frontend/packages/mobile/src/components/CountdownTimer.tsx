import { useEffect, useState } from 'react';
import { timeSync } from '@jingpai/shared';

interface Props {
  endTime: number;
}

export default function CountdownTimer({ endTime }: Props) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!endTime) return;
    let rafId: number;
    const tick = () => {
      setRemaining(timeSync.remaining(endTime));
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [endTime]);

  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const ms = Math.floor((remaining % 1000) / 10);
  const isUrgent = totalSeconds <= 10 && totalSeconds > 0;

  return (
    <div className={`mt-3 font-mono tabular-nums transition-colors ${isUrgent ? 'text-red-500 animate-pulse text-3xl' : 'text-white/80 text-2xl'}`}>
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}.
      {String(ms).padStart(2, '0')}
    </div>
  );
}

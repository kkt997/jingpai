import { useEffect, useState } from 'react';
import { timeSync } from '@jingpai/shared';
import { Timer } from 'lucide-react';

interface Props {
  endTime: number;
  compact?: boolean;
}

export default function CountdownTimer({ endTime, compact }: Props) {
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

  const totalSeconds = Math.max(0, Math.floor(remaining / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const ms = Math.max(0, Math.floor((remaining % 1000) / 10));
  const isUrgent = totalSeconds <= 10 && totalSeconds > 0;

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono font-bold tabular-nums border transition-all ${
          isUrgent
            ? 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse'
            : 'bg-brand/20 text-brand border-brand/50'
        }`}
      >
        <Timer className="w-3 h-3" />
        <span>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 font-mono tabular-nums ${
        isUrgent
          ? 'border-brand/40 bg-brand/5 text-brand animate-pulse text-2xl font-bold shadow-lg shadow-brand/10'
          : 'border-zinc-800 bg-zinc-900/40 text-zinc-100 text-lg font-semibold'
      }`}
    >
      <Timer className={`w-4.5 h-4.5 ${isUrgent ? 'animate-bounce text-brand' : 'text-zinc-400'}`} />
      <span>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}.
        <span className="text-xs opacity-75">{String(ms).padStart(2, '0')}</span>
      </span>
    </div>
  );
}

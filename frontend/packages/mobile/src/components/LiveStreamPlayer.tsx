import { useState, useRef, useEffect, useCallback } from 'react';

interface Props {
  streamUrl?: string;
  roomTitle?: string;
  onlineCount: number;
  connectionStatus: string;
}

const DEMO_VIDEO = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4';

function isLocalFilePath(url: string) {
  return /^file:\/\//i.test(url) || /^[a-zA-Z]:[\\\/]/.test(url);
}

export default function LiveStreamPlayer({ streamUrl, roomTitle, onlineCount, connectionStatus }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const hasValidStream = !!streamUrl && !isLocalFilePath(streamUrl);
  const src = hasValidStream && !useFallback ? streamUrl : DEMO_VIDEO;

  const handleError = useCallback(() => {
    if (hasValidStream && !useFallback) {
      setUseFallback(true);
    }
  }, [hasValidStream, useFallback]);

  useEffect(() => {
    setUseFallback(false);
    setIsPlaying(false);
  }, [streamUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, [src]);

  return (
    <div className="relative h-52 bg-black overflow-hidden">
      <video
        ref={videoRef}
        src={src}
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover"
        onError={handleError}
        onPlaying={() => setIsPlaying(true)}
      />

      {/* Dimming overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40 pointer-events-none" />

      {/* LIVE badge — left-12 to leave room for external back button */}
      <div className="absolute top-3 left-12 flex items-center gap-2">
        <div className="bg-red-600 px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 shadow-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          LIVE
        </div>
        {roomTitle && (
          <div className="bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-md text-xs max-w-[160px] truncate">
            {roomTitle}
          </div>
        )}
      </div>

      {/* Online count */}
      <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-xs flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5 opacity-70" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
        </svg>
        {onlineCount} 人观看
      </div>

      {/* Connection status */}
      {connectionStatus !== 'connected' && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-yellow-500/90 px-3 py-1 rounded-full text-xs text-black font-medium shadow-lg">
          {connectionStatus === 'reconnecting' ? '重连中...' : '连接断开'}
        </div>
      )}

      {/* Not playing hint */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black/60 rounded-full p-4 backdrop-blur-sm">
            <svg className="w-8 h-8 opacity-60" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

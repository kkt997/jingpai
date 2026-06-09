import { useState, useRef, useEffect, useCallback } from 'react';

interface Props {
  streamUrl?: string;
}

const DEMO_VIDEO = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4';

function isLocalFilePath(url: string) {
  return /^file:\/\//i.test(url) || /^[a-zA-Z]:[\\\/]/.test(url);
}

export default function LiveStreamPlayer({ streamUrl }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const hasValidStream = !!streamUrl && !isLocalFilePath(streamUrl);
  const src = hasValidStream && !useFallback ? streamUrl : DEMO_VIDEO;

  const handleError = useCallback(() => {
    if (hasValidStream && !useFallback) setUseFallback(true);
  }, [hasValidStream, useFallback]);

  useEffect(() => { setUseFallback(false); setIsPlaying(false); }, [streamUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, [src]);

  return (
    <>
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
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black/60 rounded-full p-4 backdrop-blur-sm">
            <svg className="w-8 h-8 opacity-60" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
    </>
  );
}

import { useEffect, useRef } from "react";

type NativeVideoPlayerProps = {
  src: string;
  playbackRate: number;
  subtitleUrl: string;
  onReady: (video: HTMLVideoElement) => void;
  onError: () => void;
};

export function NativeVideoPlayer({ src, playbackRate, subtitleUrl, onReady, onError }: NativeVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  return (
    <video ref={videoRef} controls autoPlay playsInline src={src} onLoadedData={(event) => onReady(event.currentTarget)} onError={onError}>
      {subtitleUrl ? <track key={subtitleUrl} kind="subtitles" src={subtitleUrl} srcLang="zh" label="字幕" default /> : null}
    </video>
  );
}

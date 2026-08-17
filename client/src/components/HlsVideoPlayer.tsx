import Hls from "hls.js";
import { useEffect, useRef } from "react";

type HlsVideoPlayerProps = {
  src: string;
  playbackRate?: number;
  subtitleUrl?: string;
  onReady: (video: HTMLVideoElement) => void;
  onError: (message: string) => void;
};

export function HlsVideoPlayer({ src, playbackRate = 1, subtitleUrl = "", onReady, onError }: HlsVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);

  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = playbackRate; }, [playbackRate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let hls: Hls | null = null;
    const startPlayback = () => {
      onReadyRef.current(video);
      void video.play().catch(() => undefined);
    };
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.addEventListener("loadeddata", startPlayback, { once: true });
      video.addEventListener("error", () => onErrorRef.current("此 HLS 流无法由浏览器原生播放，可能需要登录、授权、特定地区或允许跨域访问。"), { once: true });
      video.load();
      return () => { video.removeAttribute("src"); video.load(); };
    }
    if (!Hls.isSupported()) {
      onErrorRef.current("当前浏览器不支持 HLS 自适应流播放。请切换网页模式，或尝试可公开访问的 MP4/WebM 地址。");
      return;
    }
    hls = new Hls({ enableWorker: true, lowLatencyMode: true });
    hls.loadSource(src);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, startPlayback);
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      onErrorRef.current("此 HLS 流未能播放。它可能被跨域策略、访问令牌、DRM、地区或登录要求保护。");
      hls?.destroy();
      hls = null;
    });
    return () => hls?.destroy();
  }, [src]);

  return <video ref={videoRef} controls autoPlay playsInline aria-label="HLS 视频播放器">{subtitleUrl ? <track key={subtitleUrl} kind="subtitles" src={subtitleUrl} srcLang="zh" label="字幕" default /> : null}</video>;
}

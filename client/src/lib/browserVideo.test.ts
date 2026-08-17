import { describe, expect, it } from "vitest";
import { resolveBrowserVideo } from "./browserVideo";

describe("resolveBrowserVideo", () => {
  it("plays public video files directly", () => {
    expect(resolveBrowserVideo("https://cdn.example.com/clip.mp4?quality=hd")).toMatchObject({ kind: "direct", provider: "公开视频" });
  });

  it("creates privacy-friendly YouTube embeds", () => {
    expect(resolveBrowserVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toMatchObject({ kind: "embed", provider: "YouTube", src: expect.stringContaining("youtube-nocookie.com/embed/dQw4w9WgXcQ") });
  });

  it("creates Bilibili player embeds", () => {
    expect(resolveBrowserVideo("https://www.bilibili.com/video/BV1xx411c7mD")).toMatchObject({ kind: "embed", provider: "Bilibili", src: expect.stringContaining("bvid=BV1xx411c7mD") });
  });

  it("routes HLS manifests through the adaptive player", () => {
    expect(resolveBrowserVideo("https://cdn.example.com/live/index.m3u8?token=abc")).toMatchObject({ kind: "hls", provider: "HLS" });
  });

  it("creates embeds for additional public platforms", () => {
    expect(resolveBrowserVideo("https://www.dailymotion.com/video/x7tgad0")).toMatchObject({ kind: "embed", provider: "Dailymotion", src: expect.stringContaining("/embed/video/x7tgad0") });
    expect(resolveBrowserVideo("https://www.loom.com/share/abc123")).toMatchObject({ kind: "embed", provider: "Loom", src: expect.stringContaining("/embed/abc123") });
    expect(resolveBrowserVideo("https://www.ted.com/talks/kate_raworth_a_healthy_economy_should_be_designed_to_thrive_not_grow")).toMatchObject({ kind: "embed", provider: "TED", src: expect.stringContaining("embed.ted.com/talks/") });
  });

  it("adds Twitch parent domain required by its official player", () => {
    expect(resolveBrowserVideo("https://www.twitch.tv/videos/40464143")).toMatchObject({ kind: "embed", provider: "Twitch", src: expect.stringContaining("video=v40464143") });
    expect(resolveBrowserVideo("https://clips.twitch.tv/IncredulousAbstemiousFennelImGlitch")).toMatchObject({ kind: "embed", provider: "Twitch", src: expect.stringContaining("parent=") });
  });

  it("labels known login and DRM-first platforms instead of falsely promising playback", () => {
    expect(resolveBrowserVideo("https://v.qq.com/x/cover/example.html")).toMatchObject({ kind: "restricted", provider: "腾讯视频" });
    expect(resolveBrowserVideo("https://www.netflix.com/watch/123")).toMatchObject({ kind: "restricted", provider: "受 DRM 保护的视频服务" });
  });

  it("does not treat ordinary web pages as videos", () => {
    expect(resolveBrowserVideo("https://example.com/article")).toBeNull();
  });
});

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
    expect(resolveBrowserVideo("https://example.wistia.com/medias/abcde12345")).toMatchObject({ kind: "embed", provider: "Wistia", src: expect.stringContaining("fast.wistia.net/embed/iframe/abcde12345") });
    expect(resolveBrowserVideo("https://www.facebook.com/FacebookDevelopers/videos/10152454700553553/")).toMatchObject({ kind: "embed", provider: "Facebook", src: expect.stringContaining("facebook.com/plugins/video.php") });
    expect(resolveBrowserVideo("https://www.tiktok.com/@scout2015/video/6718335390845095173")).toMatchObject({ kind: "embed", provider: "TikTok", src: expect.stringContaining("tiktok.com/player/v1/6718335390845095173") });
    expect(resolveBrowserVideo("https://v.youku.com/v_show/id_XNDYwMTEzMTY0.html")).toMatchObject({ kind: "embed", provider: "优酷", src: expect.stringContaining("player.youku.com/embed/XNDYwMTEzMTY0") });
    expect(resolveBrowserVideo("https://rumble.com/v5yexample-title.html")).toMatchObject({ kind: "embed", provider: "Rumble", src: expect.stringContaining("rumble.com/embed/v5yexample") });
  });

  it("recognizes common Youku share, mobile, player and query URL variants", () => {
    const variants = [
      "https://v.youku.com/v_show/id_XNDYwMTEzMTY0.html",
      "https://m.youku.com/alipay_video/id_XNDYwMTEzMTY0.html",
      "https://player.youku.com/embed/XNDYwMTEzMTY0",
      "https://player.youku.com/player.php/sid/XNDYwMTEzMTY0/v.swf",
      "https://www.youku.com/video?vid=XNDYwMTEzMTY0",
      "https://www.youku.com/video?videoId=XNDYwMTEzMTY0",
    ];
    variants.forEach((url) => expect(resolveBrowserVideo(url)).toMatchObject({ kind: "embed", provider: "优酷", src: expect.stringContaining("player.youku.com/embed/XNDYwMTEzMTY0") }));
  });

  it("recognizes additional browser-playable direct media suffixes", () => {
    expect(resolveBrowserVideo("https://cdn.example.com/preview.m4v?download=1")).toMatchObject({ kind: "direct", provider: "公开视频" });
  });

  it("adds Twitch parent domain required by its official player", () => {
    expect(resolveBrowserVideo("https://www.twitch.tv/videos/40464143")).toMatchObject({ kind: "embed", provider: "Twitch", src: expect.stringContaining("video=v40464143") });
    expect(resolveBrowserVideo("https://clips.twitch.tv/IncredulousAbstemiousFennelImGlitch")).toMatchObject({ kind: "embed", provider: "Twitch", src: expect.stringContaining("parent=") });
  });

  it("labels known login and DRM-first platforms instead of falsely promising playback", () => {
    expect(resolveBrowserVideo("https://v.qq.com/x/cover/example.html")).toMatchObject({ kind: "restricted", provider: "腾讯视频" });
    expect(resolveBrowserVideo("https://www.netflix.com/watch/123")).toMatchObject({ kind: "restricted", provider: "受 DRM 保护的视频服务" });
    expect(resolveBrowserVideo("https://v.youku.com/v_show/without_an_embed_id.html")).toMatchObject({ kind: "restricted", provider: "优酷" });
  });

  it("does not treat ordinary web pages as videos", () => {
    expect(resolveBrowserVideo("https://example.com/article")).toBeNull();
  });
});

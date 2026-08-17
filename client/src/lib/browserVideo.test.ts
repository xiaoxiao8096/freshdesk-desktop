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

  it("does not treat ordinary web pages as videos", () => {
    expect(resolveBrowserVideo("https://example.com/article")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { extractReaderImages, extractReaderLinks, safeBrowserUrl } from "./routers/browser";

describe("browser reader helpers", () => {
  it("rejects local and non-web URLs", () => {
    expect(() => safeBrowserUrl("file:///etc/passwd")).toThrow();
    expect(() => safeBrowserUrl("http://localhost:3000")).toThrow();
    expect(() => safeBrowserUrl("http://127.0.0.1")).toThrow();
  });

  it("extracts unique absolute HTTP links from readable markup", () => {
    const html = '<a href="/next">下一页</a><a href="/next">重复</a><a href="https://example.org/a">文章</a>';
    expect(extractReaderLinks(html, "https://example.com/start")).toEqual([
      { title: "下一页", url: "https://example.com/next" },
      { title: "文章", url: "https://example.org/a" },
    ]);
  });

  it("extracts absolute images from social metadata and image markup", () => {
    const html = '<meta property="og:image" content="/cover.jpg"><img src="/cover.jpg" alt="重复"><img src="https://cdn.example.org/photo.png" alt="正文图片">';
    expect(extractReaderImages(html, "https://example.com/article")).toEqual([
      { src: "https://example.com/cover.jpg", alt: "网页图片" },
      { src: "https://cdn.example.org/photo.png", alt: "正文图片" },
    ]);
  });

  it("skips navigation icons and tiny decorative images in article galleries", () => {
    const html = '<img src="/static/images/site-icon.svg" alt="图标"><img src="/thumb/20px-control.png" alt="控件"><img src="/photos/hero.jpg" alt="正文大图">';
    expect(extractReaderImages(html, "https://example.com/article")).toEqual([
      { src: "https://example.com/photos/hero.jpg", alt: "正文大图" },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { extractReaderLinks, safeBrowserUrl } from "./routers/browser";

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
});

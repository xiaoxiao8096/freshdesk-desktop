import { describe, expect, it } from "vitest";
import { desktopBrowserOpenMode, desktopSearchUrl, shouldAutoOpenReader } from "./desktopBrowserMode";

describe("desktop Chromium browser mode", () => {
  it("always keeps recognized video URLs in the normal webview on Electron", () => {
    expect(desktopBrowserOpenMode(true, true)).toBe("web");
    expect(desktopBrowserOpenMode(false, true)).toBe("video");
  });

  it("opens typed search words in a real search-engine webpage", () => {
    expect(desktopSearchUrl("OpenAI 浏览器")).toBe("https://www.bing.com/search?q=OpenAI%20%E6%B5%8F%E8%A7%88%E5%99%A8");
  });

  it("never automatically switches Electron browsing to reader mode", () => {
    expect(shouldAutoOpenReader(true, true)).toBe(false);
    expect(shouldAutoOpenReader(false, true)).toBe(true);
  });
});

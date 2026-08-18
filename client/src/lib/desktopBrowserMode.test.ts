import { describe, expect, it } from "vitest";
import { desktopBrowserOpenMode, desktopSearchUrl, shouldAutoOpenReader } from "./desktopBrowserMode";

describe("desktop Chromium browser mode", () => {
  it("keeps every recognized URL category in the current Chromium webview", () => {
    expect(desktopBrowserOpenMode()).toBe("web");
  });

  it("opens typed search words in a real search-engine webpage", () => {
    expect(desktopSearchUrl("OpenAI 浏览器")).toBe("https://www.bing.com/search?q=OpenAI%20%E6%B5%8F%E8%A7%88%E5%99%A8");
  });

  it("never automatically switches any browsing session to reader mode", () => {
    expect(shouldAutoOpenReader()).toBe(false);
  });
});

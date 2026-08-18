import { describe, expect, it } from "vitest";
import { appendNavigationRoute, getNavigationStep, synchronizeGuestHistoryStep } from "./browserNavigation";

describe("appendNavigationRoute", () => {
  it("keeps a reader route before a same-address direct attempt so back returns to the article", () => {
    const reader = { url: "https://example.com/article", title: "阅读：example.com", mode: "reader" as const };
    const direct = { url: "https://example.com/article", title: "example.com", mode: "web" as const };
    const result = appendNavigationRoute([{ url: "about:blank", mode: "search" }, reader], 1, direct);
    expect(result.historyIndex).toBe(2);
    expect(result.history[1]).toEqual(reader);
    expect(result.history[2]).toEqual(direct);
  });

  it("replaces a repeated route instead of growing a duplicate navigation entry", () => {
    const route = { url: "https://example.com", title: "example.com", mode: "web" as const };
    const result = appendNavigationRoute([route], 0, { ...route, title: "页面已刷新" });
    expect(result.history).toEqual([{ ...route, title: "页面已刷新" }]);
    expect(result.historyIndex).toBe(0);
  });

  it("keeps successive in-site reader links in one current-tab path for back navigation", () => {
    const home = { url: "https://news.example.com/home", title: "新闻首页", mode: "reader" as const };
    const article = { url: "https://news.example.com/article/42", title: "深度报道", mode: "reader" as const };
    const video = { url: "https://news.example.com/video/9", title: "现场视频", mode: "reader" as const };
    const afterArticle = appendNavigationRoute([home], 0, article);
    const afterVideo = appendNavigationRoute(afterArticle.history, afterArticle.historyIndex, video);
    expect(afterVideo.history.map((route) => route.url)).toEqual([home.url, article.url, video.url]);
    expect(afterVideo.historyIndex).toBe(2);
  });

  it("retains platform-specific video metadata through the navigation stack", () => {
    const route = { url: "https://example.com/live.m3u8", mode: "video" as const, sourceKind: "hls" };
    const result = appendNavigationRoute([], -1, route);
    expect(result.history[0]).toEqual(route);
  });

  it("returns the exact route index used to synchronize Electron guest back and forward navigation", () => {
    const history = [
      { url: "https://example.com/one", mode: "web" as const },
      { url: "https://example.com/two", mode: "web" as const },
      { url: "https://example.com/three", mode: "web" as const },
    ];
    expect(getNavigationStep(history, 1, -1)).toMatchObject({ index: 0, route: { url: "https://example.com/one" } });
    expect(getNavigationStep(history, 1, 1)).toMatchObject({ index: 2, route: { url: "https://example.com/three" } });
    expect(getNavigationStep(history, 0, -1)).toBeNull();
  });

  it("synchronizes the Electron guest page, address bar and history index after a native back step", () => {
    const history = [
      { url: "https://example.com/one", title: "第一页", mode: "web" as const },
      { url: "https://example.com/two", title: "第二页", mode: "web" as const },
    ];
    const tab = { id: "tab-a", url: history[1].url, address: history[1].url, title: history[1].title, loading: true, history, historyIndex: 1, mode: "web" as const };
    expect(synchronizeGuestHistoryStep(tab, { tabId: "tab-a", index: 0 }, history[0].url, "第一页 · 站点标题")).toMatchObject({
      url: history[0].url,
      address: history[0].url,
      title: "第一页 · 站点标题",
      historyIndex: 0,
      loading: false,
    });
  });

  it("synchronizes the Electron guest page, address bar and history index after a native forward step", () => {
    const history = [
      { url: "https://example.com/one", title: "第一页", mode: "web" as const },
      { url: "https://example.com/two", title: "第二页", mode: "web" as const },
      { url: "https://example.com/three", title: "第三页", mode: "web" as const },
    ];
    const tab = { id: "tab-a", url: history[1].url, address: history[1].url, title: history[1].title, loading: true, history, historyIndex: 1, mode: "web" as const };
    const step = getNavigationStep(history, tab.historyIndex, 1);
    const guestStep = { tabId: tab.id, ...step! };

    expect(guestStep).toMatchObject({ tabId: "tab-a", index: 2, route: { url: history[2].url } });
    expect(synchronizeGuestHistoryStep(tab, guestStep, history[2].url, "第三页 · 站点标题")).toMatchObject({
      url: history[2].url,
      address: history[2].url,
      title: "第三页 · 站点标题",
      historyIndex: 2,
      loading: false,
    });
  });
});

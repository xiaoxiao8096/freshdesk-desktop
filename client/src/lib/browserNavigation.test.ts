import { describe, expect, it } from "vitest";
import { appendNavigationRoute } from "./browserNavigation";

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
});

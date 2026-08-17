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
});

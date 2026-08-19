import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("Electron Chromium 网页视图 target 链接接管", () => {
  it("保留 webview 宿主侧 new-window 回退接管，并交由当前标签加载", () => {
    expect(homeSource).toContain('webview.addEventListener("new-window", routeGuestPopupInCurrentTab);');
    expect(homeSource).toContain("const popupUrl = popup.url ?? popup.detail?.url;");
    expect(homeSource).toContain("popup.preventDefault?.();");
    expect(homeSource).toContain("guest.loadURL?.(popupUrl).catch(() => undefined);");
  });

  it("只接管 http 和 https 网页请求，保留非网页协议的安全边界", () => {
    expect(homeSource).toContain(String.raw`if (!popupUrl || !/^https?:\/\//i.test(popupUrl)) return;`);
  });

  it("显式允许网页视图提交窗口请求，但由主进程隐藏接管而非显示新窗口", () => {
    expect(homeSource).toContain('allowpopups: "true"');
  });

  it("不依赖 guest 预加载可用性，并始终创建受 sandbox 保护的 Chromium 网页视图", () => {
    expect(homeSource).not.toContain("electronGuestPreloadUrl");
    expect(homeSource).not.toContain("preload: electronGuestPreloadUrl");
    expect(homeSource).toContain('webpreferences: "contextIsolation=yes, sandbox=yes"');
  });
});

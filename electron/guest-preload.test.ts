import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const preloadSource = readFileSync(resolve(process.cwd(), "electron/guest-preload.mjs"), "utf8");

describe("Electron guest target 链接同标签接管", () => {
  it("在文档捕获阶段将普通 target 链接交回当前 Chromium guest", () => {
    expect(preloadSource).toContain('document.addEventListener("click"');
    expect(preloadSource).toContain("window.location.assign(url);");
    expect(preloadSource).toContain("data-freshdesk-same-tab-handler");
  });

  it("不接管下载、非 HTTP(S)、已阻止事件或带修饰键的点击", () => {
    expect(preloadSource).toContain("event.defaultPrevented || event.button !== 0");
    expect(preloadSource).toContain('anchor.hasAttribute("download")');
    expect(preloadSource).toContain("!/^https?:/i.test(url)");
  });

  it("不暴露 Node、Electron 或 IPC 接口", () => {
    expect(preloadSource).not.toMatch(/\b(require|ipcRenderer|contextBridge|process)\b/);
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const refreshStyles = readFileSync(resolve(process.cwd(), "client/src/ux-refresh.css"), "utf8");
const entrySource = readFileSync(resolve(process.cwd(), "client/src/main.tsx"), "utf8");

describe("Freshdesk Desktop UX Refresh", () => {
  it("以独立高优先级样式层加载新的工作区视觉语言", () => {
    expect(entrySource).toContain('import "./ux-refresh.css";');
    expect(refreshStyles).toContain("--fd-canvas");
    expect(refreshStyles).toContain("--fd-blue");
    expect(refreshStyles).toContain(".window-layer.is-key-window .app-window");
    expect(refreshStyles).toContain(".app-window { border: 1px");
  });

  it("将四点状态语言用于菜单栏、Dock 和欢迎入口", () => {
    expect(homeSource).toContain("menubar-system-state");
    expect(homeSource).toContain("Workspace online");
    expect(refreshStyles).toContain(".menubar-system-state i");
    expect(refreshStyles).toContain(".dock-app i");
    expect(refreshStyles).toContain(".setup-status > span");
  });

  it("将欢迎层变成具有清晰主次动作的工作区入口", () => {
    expect(homeSource).toContain("现在，开始");
    expect(homeSource).toContain("配置工作区");
    expect(homeSource).toContain("查看总览");
    expect(homeSource).toContain("本地优先");
  });

  it("为高频 Finder、浏览器、媒体与窗口总览保持一致的工作区层级", () => {
    expect(refreshStyles).toContain(".finder-window, .browser-window, .music-window, .photos-window");
    expect(refreshStyles).toContain(".finder-sidebar, .browser-safari-sidebar, .music-sidebar");
    expect(refreshStyles).toContain(".browser-tabstrip");
    expect(refreshStyles).toContain(".music-hero");
    expect(refreshStyles).toContain(".photos-body");
    expect(refreshStyles).toContain(".mission-control");
  });
});

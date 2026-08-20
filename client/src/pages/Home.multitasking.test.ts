import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const desktopStyles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("桌面多任务体验", () => {
  it("持久化窗口组并保留 Mission Control 的键盘与菜单入口", () => {
    expect(homeSource).toContain("windowGroups: DesktopWindowGroup[]");
    expect(homeSource).toContain("const [windowGroups, setWindowGroups]");
    expect(homeSource).toContain('event.key === "F3"');
    expect(homeSource).toContain('setActivePanel("mission")');
    expect(homeSource).toContain('aria-label="Mission Control 窗口总览"');
  });

  it("提供窗口组创建、分配、聚焦、最小化与解散操作", () => {
    expect(homeSource).toContain("createWindowGroup");
    expect(homeSource).toContain("assignAppToWindowGroup");
    expect(homeSource).toContain("focusWindowGroup");
    expect(homeSource).toContain("minimizeWindowGroup");
    expect(homeSource).toContain("deleteWindowGroup");
  });

  it("将视觉交通灯与实际点击范围分离，并对 Mission Control 保留焦点样式", () => {
    expect(desktopStyles).toContain("width: 28px; height: 28px; background: transparent !important;");
    expect(desktopStyles).toContain(".traffic-light::before");
    expect(desktopStyles).toContain(".mission-control button:focus-visible");
  });

  it("将拖拽和缩放的窗口状态更新合并到动画帧，并在交互期间降低材料成本", () => {
    expect(homeSource).toContain("const queueInteractionFrame");
    expect(homeSource).toContain("window.requestAnimationFrame(() =>");
    expect(homeSource).toContain("flushInteractionFrame();");
    expect(homeSource).toContain('classList.add("is-interacting")');
    expect(homeSource).toContain('classList.remove("is-interacting")');
    expect(readFileSync(resolve(process.cwd(), "client/src/local-media.css"), "utf8")).toContain(".app-window.is-interacting");
  });
});

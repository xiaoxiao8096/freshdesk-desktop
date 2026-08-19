import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("Electron 原生 Chromium 网页视图", () => {
  it("通过 WebContentsView IPC 显示并调整原生网页内容区域", () => {
    expect(homeSource).toContain("const nativeBrowserFrameRef = useRef<HTMLDivElement | null>(null);");
    expect(homeSource).toContain("desktop.nativeBrowserShow({ tabId: activeBrowserTab.id, url: activeBrowserTab.url, bounds })");
    expect(homeSource).toContain("desktop.nativeBrowserHide()");
    expect(homeSource).toContain("new ResizeObserver(updateBounds)");
  });

  it("将原生导航、标题与加载状态同步回当前 Safari 风格标签", () => {
    expect(homeSource).toContain("window.freshdeskDesktop.onNativeBrowserStatus");
    expect(homeSource).toContain("synchronizeGuestHistoryStep(tab, pendingHistoryStep, url, title)");
    expect(homeSource).toContain('status.type === "failed"');
  });

  it("将前进、后退、刷新与聚焦交由主进程原生 Chromium 内容视图", () => {
    expect(homeSource).toContain('command: direction === -1 ? "back" : "forward"');
    expect(homeSource).toContain('command: "reload"');
    expect(homeSource).toContain('command: "focus"');
  });

  it("将 Safari 地址栏提交交给统一地址解析，并在 Electron 中继续使用当前原生标签", () => {
    expect(homeSource).toContain('import { resolveSafariAddress } from "@/lib/browserAddress";');
    expect(homeSource).toContain("const resolution = resolveSafariAddress(value, activeBrowserTab?.url ?? \"about:blank\");");
    expect(homeSource).toContain('onSubmit={(event) => { event.preventDefault(); navigateBrowser(activeBrowserTab.address); }}');
    expect(homeSource).toContain('aria-label="Safari 风格智能搜索栏"');
  });

  it("不再创建 webview，而以原生内容区域承接 Chromium 视图", () => {
    expect(homeSource).toContain('className="browser-webview native-browser-surface"');
    expect(homeSource).not.toContain('createElement("webview"');
  });
});

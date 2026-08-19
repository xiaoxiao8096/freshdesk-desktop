import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mainProcessSource = readFileSync(resolve(process.cwd(), "electron/main.mjs"), "utf8");
const preloadBridgeSource = readFileSync(resolve(process.cwd(), "electron/preload.mjs"), "utf8");

describe("Electron 主进程依赖加载", () => {
  it("以默认导入兼容 CommonJS 版 electron-updater", () => {
    expect(mainProcessSource).toContain('import electronUpdater from "electron-updater";');
    expect(mainProcessSource).toContain("const { autoUpdater } = electronUpdater;");
    expect(mainProcessSource).not.toContain('import { autoUpdater } from "electron-updater";');
  });

  it("只为受控 IPC 暴露下载取消与本地备份文件操作", () => {
    expect(mainProcessSource).toContain('ipcMain.handle("freshdesk:start-download"');
    expect(mainProcessSource).toContain('ipcMain.handle("freshdesk:cancel-download"');
    expect(mainProcessSource).toContain('ipcMain.handle("freshdesk:export-desktop-state"');
    expect(mainProcessSource).toContain('ipcMain.handle("freshdesk:backup-desktop-state"');
    expect(mainProcessSource).toContain('ipcMain.handle("freshdesk:open-desktop-backup"');
    expect(mainProcessSource).toContain("function validateDownloadRequest(request)");
    expect(mainProcessSource).toContain("function validateBackupPayload(payload)");
  });

  it("通过 Chromium Page.windowOpen 将目标链接安全交回当前 guest，而不创建外部窗口", () => {
    expect(mainProcessSource).toContain('guestParams.allowpopups = "true";');
    expect(mainProcessSource).toContain("const routePopupInCurrentGuest = (url, source) => {");
    expect(mainProcessSource).toContain('if (method === "Page.windowOpen") routePopupInCurrentGuest(params?.url, "Page.windowOpen");');
    expect(mainProcessSource).toContain('guestDebugger.attach("1.3");');
    expect(mainProcessSource).toContain('guestDebugger.sendCommand("Page.enable")');
    expect(mainProcessSource).toContain("contents.setWindowOpenHandler(({ url }) => {");
    expect(mainProcessSource).toContain('routePopupInCurrentGuest(url, "window-open fallback");');
    expect(mainProcessSource).toContain('return { action: "deny" };');
    expect(mainProcessSource).toContain("contents.loadURL(targetUrl)");
    expect(mainProcessSource).toContain("guestPreferences.contextIsolation = true;");
    expect(mainProcessSource).toContain("guestPreferences.sandbox = true;");
  });

  it("保持 guest 禁用 Node 并启用上下文隔离与 Chromium sandbox", () => {
    expect(mainProcessSource).toContain("guestPreferences.nodeIntegration = false;");
    expect(mainProcessSource).toContain("guestPreferences.contextIsolation = true;");
    expect(mainProcessSource).toContain("guestPreferences.sandbox = true;");
  });
});

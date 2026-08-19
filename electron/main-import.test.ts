import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mainProcessSource = readFileSync(resolve(process.cwd(), "electron/main.mjs"), "utf8");
const preloadBridgeSource = readFileSync(resolve(process.cwd(), "electron/preload.cjs"), "utf8");

describe("Electron 主进程依赖加载", () => {
  it("以默认导入兼容 CommonJS 版 electron-updater", () => {
    expect(mainProcessSource).toContain('import electronUpdater from "electron-updater";');
    expect(mainProcessSource).toContain("const { autoUpdater } = electronUpdater;");
    expect(mainProcessSource).not.toContain('import { autoUpdater } from "electron-updater";');
    expect(mainProcessSource).toContain('preload: path.join(__dirname, "preload.cjs"),');
    expect(preloadBridgeSource).toContain('contextBridge.exposeInMainWorld("freshdeskDesktop"');
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

  it("使用原生 WebContentsView 将 target 链接安全留在当前 Chromium 标签", () => {
    expect(mainProcessSource).toContain('import { app, BrowserWindow, dialog, ipcMain, session, shell, WebContentsView } from "electron";');
    expect(mainProcessSource).toContain("const view = new WebContentsView({");
    expect(mainProcessSource).toContain('partition: NATIVE_BROWSER_PARTITION,');
    expect(mainProcessSource).toContain('preload: path.join(__dirname, "guest-preload.cjs"),');
    expect(mainProcessSource).toContain("mainWindow.contentView.addChildView(view);");
    expect(mainProcessSource).toContain('contents.on("dom-ready", installCurrentTabTargetHandler);');
    expect(mainProcessSource).toContain("contents.executeJavaScript(source)");
    expect(mainProcessSource).toContain("window.location.assign(url);");
    expect(mainProcessSource).toContain('contents.on("new-window", (event, url) => {');
    expect(mainProcessSource).toContain("event.preventDefault();");
    expect(mainProcessSource).toContain("contents.setWindowOpenHandler(({ url }) => {");
    expect(mainProcessSource).toContain("void contents.loadURL(url)");
    expect(mainProcessSource).toContain('return { action: "deny" };');
    expect(mainProcessSource).toContain('ipcMain.handle("freshdesk:native-browser-show"');
    expect(mainProcessSource).toContain('ipcMain.handle("freshdesk:native-browser-navigate"');
    expect(mainProcessSource).toContain('ipcMain.handle("freshdesk:native-browser-command"');
  });

  it("保持原生浏览内容禁用 Node、启用上下文隔离与 sandbox", () => {
    expect(mainProcessSource).toContain("nodeIntegration: false,");
    expect(mainProcessSource).toContain("contextIsolation: true,");
    expect(mainProcessSource).toContain("sandbox: true,");
    expect(mainProcessSource).toContain("webviewTag: true,");
    expect(mainProcessSource).toContain('guestPreferences.preload = path.join(__dirname, "guest-preload.cjs");');
    expect(mainProcessSource).toContain("function isDesktopRenderer(event)");
  });
});

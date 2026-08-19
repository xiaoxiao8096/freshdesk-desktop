import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mainProcessSource = readFileSync(resolve(process.cwd(), "electron/main.mjs"), "utf8");

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

  it("将网站的新窗口请求限制在当前 Chromium 网页视图内，而不阻断站内确认后的跳转", () => {
    expect(mainProcessSource).toContain('guestParams.allowpopups = "true";');
    expect(mainProcessSource).toContain('contents.on("dom-ready", installSameTabTargetHandler);');
    expect(mainProcessSource).toContain('window.location.assign(anchor.href);');
    expect(mainProcessSource).toContain('event.stopImmediatePropagation();');
    expect(mainProcessSource).toContain("contents.setWindowOpenHandler(({ url }) => {");
    expect(mainProcessSource).toContain("setTimeout(() => contents.loadURL(url).catch(() => undefined), 24);");
    expect(mainProcessSource).toContain('return { action: "deny" };');
  });
});

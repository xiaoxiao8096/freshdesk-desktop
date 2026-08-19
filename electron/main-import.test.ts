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

  it("将网站的新窗口请求限制在当前 Chromium 网页视图内，而不阻断站内确认后的跳转", () => {
    expect(mainProcessSource).toContain('guestParams.allowpopups = "false";');
    expect(mainProcessSource).toContain("contents.setWindowOpenHandler(({ url }) => {");
    expect(mainProcessSource).toContain('return { action: "deny" };');
  });

  it("仅为 guest 配置无 Node/Electron 接口的同标签导航预加载，并保留 Chromium 安全边界", () => {
    expect(mainProcessSource).toContain('const guestPreloadUrl = pathToFileURL(path.join(__dirname, "guest-preload.cjs")).toString();');
    expect(mainProcessSource).toContain("guestPreferences.preload = guestPreloadUrl;");
    expect(mainProcessSource).toContain("guestParams.preload = guestPreloadUrl;");
    expect(mainProcessSource).toContain("guestPreferences.nodeIntegration = false;");
    expect(mainProcessSource).toContain("guestPreferences.contextIsolation = true;");
    expect(mainProcessSource).toContain("guestPreferences.sandbox = true;");
  });

  it("仅从本地 Electron 资源向前端提供固定 guest 预加载 URL", () => {
    expect(preloadBridgeSource).toContain('browserGuestPreloadUrl: new URL("./guest-preload.cjs", import.meta.url).toString(),');
  });
});

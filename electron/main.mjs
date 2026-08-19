import { app, BrowserWindow, dialog, ipcMain, session, shell } from "electron";
import electronUpdater from "electron-updater";
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { autoUpdater } = electronUpdater;
let mainWindow = null;
let serverProcess = null;
const pendingDownloads = new Map();
const activeDownloads = new Map();

function sendUpdateStatus(status) {
  mainWindow?.webContents.send("freshdesk:update-status", status);
}

function sendDownloadStatus(status) {
  mainWindow?.webContents.send("freshdesk:download-status", status);
}

function safeDownloadName(value) {
  const normalized = String(value || "download").replace(/[\\/:*?"<>|]/g, "-").trim();
  return normalized.slice(0, 120) || "download";
}

function setupDownloads() {
  session.defaultSession.on("will-download", (_event, item) => {
    const sourceUrl = item.getURL();
    const matched = [...pendingDownloads.values()].find((request) => request.url === sourceUrl);
    if (matched) pendingDownloads.delete(matched.id);
    const id = matched?.id ?? `guest-download-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const title = safeDownloadName(matched?.title || item.getFilename());
    const savePath = path.join(app.getPath("downloads"), title);
    item.setSavePath(savePath);
    activeDownloads.set(id, item);
    sendDownloadStatus({ id, state: "downloading", title, url: sourceUrl, progress: 0, receivedBytes: 0, totalBytes: item.getTotalBytes?.() ?? 0 });
    item.on("updated", (_updatedEvent, state) => {
      if (state === "interrupted") {
        sendDownloadStatus({ id, state: "failed", title, url: sourceUrl, progress: 0, message: "下载被系统中断" });
        return;
      }
      const totalBytes = item.getTotalBytes();
      const receivedBytes = item.getReceivedBytes();
      const progress = totalBytes > 0 ? Math.min(99, Math.round((receivedBytes / totalBytes) * 100)) : 0;
      sendDownloadStatus({ id, state: "downloading", title, url: sourceUrl, progress, receivedBytes, totalBytes });
    });
    item.once("done", (_doneEvent, state) => {
      activeDownloads.delete(id);
      const completed = state === "completed";
      sendDownloadStatus({ id, state: completed ? "completed" : state === "cancelled" ? "cancelled" : "failed", title, url: sourceUrl, progress: completed ? 100 : 0, path: item.getSavePath(), message: completed ? "已保存到系统下载目录" : state === "cancelled" ? "已取消下载" : "下载未完成" });
    });
  });
}

function validateDownloadRequest(request) {
  if (!request || typeof request !== "object" || typeof request.id !== "string" || typeof request.url !== "string") throw new Error("下载请求无效。");
  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("仅支持 HTTP 或 HTTPS 下载链接。");
  return { id: request.id.slice(0, 160), url: url.toString(), title: safeDownloadName(request.title || path.basename(url.pathname) || "download") };
}

function validateBackupPayload(payload) {
  if (!payload || typeof payload !== "object") throw new Error("备份内容无效。");
  const serialized = JSON.stringify(payload);
  if (serialized.length > 5 * 1024 * 1024) throw new Error("备份内容过大，未写入本地文件。");
  return serialized;
}

function backupName(prefix = "Freshdesk-Desktop-backup") {
  return `${prefix}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
}

function configureAutoUpdates() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () => sendUpdateStatus({ state: "checking", message: "正在检查更新…" }));
  autoUpdater.on("update-not-available", () => sendUpdateStatus({ state: "current", message: "已经是最新版本" }));
  autoUpdater.on("download-progress", (progress) => sendUpdateStatus({ state: "downloading", message: `正在下载更新 ${Math.round(progress.percent)}%` }));
  autoUpdater.on("update-downloaded", async () => {
    sendUpdateStatus({ state: "ready", message: "更新已下载，重启应用即可完成升级" });
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "info",
      buttons: ["立即重启升级", "稍后"],
      defaultId: 0,
      cancelId: 1,
      title: "Freshdesk Desktop 更新已就绪",
      message: "新版本已下载完成。重启后将自动完成安装。",
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on("error", (error) => {
    startupLog(`Auto update error: ${error.message}`);
    sendUpdateStatus({ state: "error", message: "暂时无法检查更新，请稍后再试。" });
  });
  setTimeout(() => void autoUpdater.checkForUpdates(), 3_500);
}

function startupLog(message) {
  try {
    const logDirectory = app.getPath("userData");
    mkdirSync(logDirectory, { recursive: true });
    appendFileSync(path.join(logDirectory, "freshdesk-startup.log"), `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // Logging must never prevent the desktop application from opening.
  }
}

function showStartupFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  startupLog(`Startup failed: ${message}`);
  mainWindow = new BrowserWindow({ width: 760, height: 460, backgroundColor: "#0d1424", title: "Freshdesk Desktop — 启动诊断" });
  const escaped = message.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const logPath = path.join(app.getPath("userData"), "freshdesk-startup.log").replace(/\\/g, "\\\\");
  void mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><body style="margin:0;background:#0d1424;color:#eaf1ff;font:16px system-ui;padding:42px"><h1>Freshdesk Desktop 未能启动</h1><p>应用已经保留了诊断日志。请将以下内容截图或复制给开发者：</p><pre style="white-space:pre-wrap;background:#151f35;padding:16px;border-radius:10px">${escaped}</pre><p>日志位置：<code>${logPath}</code></p><p>请确认应用已完整解压，且没有从压缩包内部直接运行。</p></body></html>`)}`);
}

function startEmbeddedServer() {
  const serverEntry = path.join(app.getAppPath(), "dist", "index.js");
  const port = process.env.FRESHDESK_PORT || "49320";
  startupLog(`Starting local server from ${serverEntry} on port ${port}.`);

  return new Promise((resolve, reject) => {
    let resolved = false;
    const fail = (error) => {
      if (resolved) return;
      clearTimeout(timeout);
      reject(error);
    };
    const timeout = setTimeout(() => fail(new Error("Freshdesk 本地服务启动超时。")), 15_000);
    const { NODE_OPTIONS: _nodeOptions, ELECTRON_RUN_AS_NODE: _runAsNode, ...inheritedEnvironment } = process.env;
    serverProcess = spawn(process.execPath, [serverEntry], {
      env: { ...inheritedEnvironment, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PORT: port, FRESHDESK_FONT_DIR: path.join(process.resourcesPath, "fonts") },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const onOutput = (chunk) => {
      const message = String(chunk);
      const matched = message.match(/Server running on (http:\/\/localhost:\d+)\//);
      if (matched?.[1]) {
        resolved = true;
        clearTimeout(timeout);
        startupLog(`Local server ready at ${matched[1]}.`);
        resolve(matched[1]);
      }
    };

    serverProcess.stdout.on("data", onOutput);
    serverProcess.stderr.on("data", (chunk) => {
      const message = String(chunk);
      startupLog(`Server stderr: ${message.trim()}`);
      console.error("[Freshdesk server]", message);
    });
    serverProcess.once("error", (error) => {
      startupLog(`Server spawn error: ${error.message}`);
      fail(error);
    });
    serverProcess.once("exit", (code) => {
      if (code !== 0) {
        const error = new Error(`Freshdesk 本地服务提前退出（代码 ${code ?? "未知"}）。`);
        startupLog(error.message);
        fail(error);
      }
    });
  });
}

function wireGuestNavigation(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    // 不创建任何原生弹窗。前端 webview 的 new-window 监听器会获取 url，
    // 并调用当前 guest 的 loadURL，使所有 target 链接留在当前标签。
    return { action: "deny" };
  });
}

async function createWindow() {
  const startUrl = process.env.ELECTRON_START_URL || (await startEmbeddedServer());
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: "#0d1424",
    title: "Freshdesk Desktop",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
    },
  });

  mainWindow.webContents.on("will-attach-webview", (_event, guestPreferences, guestParams) => {
    // 预加载仅在隔离 guest 世界捕获普通 target 链接；不向网页公开任何 Node/Electron 接口。
    const guestPreloadUrl = pathToFileURL(path.join(__dirname, "guest-preload.cjs")).toString();
    guestPreferences.preload = guestPreloadUrl;
    guestParams.preload = guestPreloadUrl;
    guestPreferences.nodeIntegration = false;
    guestPreferences.contextIsolation = true;
    guestPreferences.sandbox = true;
    guestParams.allowpopups = "false";
  });
  mainWindow.webContents.on("did-attach-webview", (_event, contents) => wireGuestNavigation(contents));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => undefined);
    return { action: "deny" };
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  await mainWindow.loadURL(startUrl);
  configureAutoUpdates();
}

ipcMain.handle("freshdesk:check-for-updates", () => app.isPackaged ? autoUpdater.checkForUpdates() : null);
ipcMain.handle("freshdesk:install-update", () => {
  if (app.isPackaged) autoUpdater.quitAndInstall();
});
ipcMain.handle("freshdesk:start-download", (_event, request) => {
  const download = validateDownloadRequest(request);
  pendingDownloads.set(download.id, download);
  mainWindow?.webContents.downloadURL(download.url);
  return { accepted: true, id: download.id };
});
ipcMain.handle("freshdesk:cancel-download", (_event, id) => {
  const item = activeDownloads.get(id);
  if (!item) return false;
  item.cancel();
  return true;
});
ipcMain.handle("freshdesk:export-desktop-state", async (_event, payload) => {
  const serialized = validateBackupPayload(payload);
  const target = await dialog.showSaveDialog(mainWindow, {
    title: "导出 Freshdesk Desktop 数据",
    defaultPath: path.join(app.getPath("downloads"), backupName("Freshdesk-Desktop-export")),
    filters: [{ name: "Freshdesk Desktop 备份", extensions: ["json"] }],
  });
  if (target.canceled || !target.filePath) return { saved: false };
  writeFileSync(target.filePath, serialized, "utf8");
  return { saved: true, path: target.filePath };
});
ipcMain.handle("freshdesk:backup-desktop-state", (_event, payload) => {
  const serialized = validateBackupPayload(payload);
  const backupDirectory = path.join(app.getPath("documents"), "Freshdesk Desktop Backups");
  mkdirSync(backupDirectory, { recursive: true });
  const filePath = path.join(backupDirectory, backupName());
  writeFileSync(filePath, serialized, "utf8");
  return { saved: true, path: filePath };
});
ipcMain.handle("freshdesk:open-desktop-backup", async () => {
  const selected = await dialog.showOpenDialog(mainWindow, {
    title: "选择 Freshdesk Desktop 备份",
    properties: ["openFile"],
    filters: [{ name: "Freshdesk Desktop 备份", extensions: ["json"] }],
  });
  if (selected.canceled || !selected.filePaths[0]) return { selected: false };
  const raw = readFileSync(selected.filePaths[0], "utf8");
  if (raw.length > 5 * 1024 * 1024) throw new Error("备份文件过大，未导入。");
  return { selected: true, raw, path: selected.filePaths[0] };
});

app.whenReady().then(() => {
  setupDownloads();
  return createWindow();
}).catch((error) => {
  console.error(error);
  showStartupFailure(error);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});

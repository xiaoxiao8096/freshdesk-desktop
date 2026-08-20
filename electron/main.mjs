import { app, BrowserWindow, dialog, ipcMain, net, protocol, session, shell, WebContentsView } from "electron";
import electronUpdater from "electron-updater";
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { autoUpdater } = electronUpdater;
let mainWindow = null;
let serverProcess = null;
let nativeBrowserView = null;
let nativeBrowserTabId = null;
const pendingDownloads = new Map();
const activeDownloads = new Map();
const NATIVE_BROWSER_PARTITION = "persist:freshdesk-browser";
const localFolderGrants = new Map();
const localMediaLibrary = new Map();
const localMediaTokens = new Map();
const LOCAL_MEDIA_SCHEME = "freshdesk-media";
const LOCAL_MEDIA_KINDS = {
  music: { extensions: ["mp3", "m4a", "aac", "wav", "ogg", "flac", "opus"], filterName: "音频" },
  photo: { extensions: ["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"], filterName: "图片" },
};

protocol.registerSchemesAsPrivileged([{ scheme: LOCAL_MEDIA_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

function sendUpdateStatus(status) {
  mainWindow?.webContents.send("freshdesk:update-status", status);
}

function sendDownloadStatus(status) {
  mainWindow?.webContents.send("freshdesk:download-status", status);
}

function isWebUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function sendNativeBrowserStatus(state) {
  if (!nativeBrowserTabId || !mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("freshdesk:native-browser-status", { tabId: nativeBrowserTabId, ...state });
}

function getNativeBrowserView() {
  if (nativeBrowserView && !nativeBrowserView.webContents.isDestroyed()) return nativeBrowserView;
  if (!mainWindow || mainWindow.isDestroyed()) throw new Error("桌面窗口尚未准备就绪。");

  const view = new WebContentsView({
    webPreferences: {
      partition: NATIVE_BROWSER_PARTITION,
      preload: path.join(__dirname, "guest-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  view.setBackgroundColor("#ffffff");
  view.setVisible(false);
  mainWindow.contentView.addChildView(view);

  const contents = view.webContents;
  const installCurrentTabTargetHandler = () => {
    const source = `(() => {
      if (window.__freshdeskCurrentTabTargetHandler) return;
      window.__freshdeskCurrentTabTargetHandler = true;
      document.documentElement?.setAttribute('data-freshdesk-same-tab-handler', 'active');
      window.addEventListener('click', (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const candidate = event.composedPath().find((node) => node?.nodeType === 1 && typeof node.closest === 'function' && node.closest('a[href]'));
        const anchor = candidate?.closest?.('a[href]');
        const target = anchor?.getAttribute('target')?.trim().toLowerCase();
        const url = anchor?.href;
        if (!anchor || !target || target === '_self' || anchor.hasAttribute('download') || !url || !/^https?:/i.test(url)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        window.location.assign(url);
      }, true);
    })()`;
    void contents.executeJavaScript(source).catch((error) => startupLog(`Native browser target handler failed: ${error.message}`));
  };
  contents.on("dom-ready", installCurrentTabTargetHandler);
  contents.on("new-window", (event, url) => {
    event.preventDefault();
    if (isWebUrl(url)) void contents.loadURL(url).catch((error) => startupLog(`Native browser legacy popup navigation failed: ${error.message}`));
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) {
      void contents.loadURL(url).catch((error) => startupLog(`Native browser popup navigation failed: ${error.message}`));
      return { action: "deny" };
    }
    return { action: "deny" };
  });
  contents.on("did-start-loading", () => sendNativeBrowserStatus({ type: "loading", url: contents.getURL() }));
  contents.on("did-stop-loading", () => sendNativeBrowserStatus({ type: "stopped", url: contents.getURL(), title: contents.getTitle() }));
  contents.on("did-navigate", (_event, url) => sendNativeBrowserStatus({ type: "navigated", url, title: contents.getTitle() }));
  contents.on("did-navigate-in-page", (_event, url) => sendNativeBrowserStatus({ type: "navigated", url, title: contents.getTitle() }));
  contents.on("page-title-updated", (_event, title) => sendNativeBrowserStatus({ type: "title", url: contents.getURL(), title }));
  contents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame && errorCode !== -3) sendNativeBrowserStatus({ type: "failed", url: validatedURL, message: errorDescription });
  });
  contents.once("destroyed", () => {
    if (nativeBrowserView === view) {
      nativeBrowserView = null;
      nativeBrowserTabId = null;
    }
  });
  nativeBrowserView = view;
  return view;
}

function validateNativeBrowserPayload(payload, requireUrl = true) {
  if (!payload || typeof payload !== "object" || typeof payload.tabId !== "string") throw new Error("浏览器请求无效。");
  const tabId = payload.tabId.slice(0, 160);
  const url = payload.url === undefined ? undefined : String(payload.url);
  if (requireUrl && !isWebUrl(url)) throw new Error("仅允许 HTTP 或 HTTPS 网页地址。");
  const rawBounds = payload.bounds;
  const bounds = rawBounds && typeof rawBounds === "object" ? {
    x: Math.max(-10_000, Math.min(10_000, Math.round(Number(rawBounds.x) || 0))),
    y: Math.max(-10_000, Math.min(10_000, Math.round(Number(rawBounds.y) || 0))),
    width: Math.max(1, Math.min(20_000, Math.round(Number(rawBounds.width) || 0))),
    height: Math.max(1, Math.min(20_000, Math.round(Number(rawBounds.height) || 0))),
  } : null;
  return { tabId, url, bounds };
}

function isDesktopRenderer(event) {
  return event.sender === mainWindow?.webContents;
}

function localLibraryPath() {
  return path.join(app.getPath("userData"), "freshdesk-local-media-library.json");
}

function loadLocalMediaLibrary() {
  try {
    const raw = JSON.parse(readFileSync(localLibraryPath(), "utf8"));
    if (!Array.isArray(raw)) return;
    raw.filter((item) => item && typeof item.id === "string" && typeof item.sourcePath === "string" && LOCAL_MEDIA_KINDS[item.kind]).forEach((item) => localMediaLibrary.set(item.id, item));
  } catch {
    // The library is optional. A missing or damaged catalog must not block startup.
  }
}

function saveLocalMediaLibrary() {
  const entries = [...localMediaLibrary.values()].map(({ id, sourcePath, kind, name, extension, size, importedAt }) => ({ id, sourcePath, kind, name, extension, size, importedAt }));
  writeFileSync(localLibraryPath(), JSON.stringify(entries, null, 2), "utf8");
}

function safeRelativePath(value) {
  if (typeof value !== "string" || value.length > 480 || value.includes("\0")) throw new Error("本地路径请求无效。");
  const normalized = value.replace(/\\/g, "/").replace(/^\.\//, "");
  if (normalized.startsWith("/") || normalized.split("/").some((part) => part === "..")) throw new Error("只能访问已授权位置内的文件。");
  return normalized;
}

function isPathWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function validateFolderGrant(grantId) {
  const grant = localFolderGrants.get(grantId);
  if (!grant) throw new Error("此文件夹授权已失效，请重新选择文件夹。");
  return grant;
}

function resolveGrantedPath(payload) {
  if (!payload || typeof payload !== "object" || typeof payload.grantId !== "string") throw new Error("本地文件请求无效。");
  const grant = validateFolderGrant(payload.grantId);
  const relativePath = safeRelativePath(payload.relativePath || "");
  const fullPath = path.resolve(grant.root, relativePath);
  if (!isPathWithin(grant.root, fullPath)) throw new Error("只能访问已授权文件夹内的内容。");
  return { grant, relativePath, fullPath };
}

function localFileExtension(filePath) {
  return path.extname(filePath).replace(/^\./, "").toLowerCase();
}

function isLocalMediaExtension(extension) {
  return Object.values(LOCAL_MEDIA_KINDS).some((kind) => kind.extensions.includes(extension));
}

function createLocalMediaUrl(filePath, scope) {
  const token = randomUUID();
  localMediaTokens.set(token, { filePath, scope });
  return `${LOCAL_MEDIA_SCHEME}://local/${token}`;
}

function clearLocalMediaTokens(predicate) {
  for (const [token, record] of localMediaTokens.entries()) {
    if (predicate(record)) localMediaTokens.delete(token);
  }
}

function mediaDescriptor(record) {
  if (!existsSync(record.sourcePath)) return null;
  return {
    id: record.id,
    title: record.name,
    extension: record.extension,
    size: record.size,
    importedAt: record.importedAt,
    mediaUrl: createLocalMediaUrl(record.sourcePath, { type: "library", id: record.id }),
  };
}

function validateMediaKind(kind) {
  if (kind !== "music" && kind !== "photo") throw new Error("不支持的媒体类型。");
  return kind;
}

function setupLocalMediaProtocol() {
  protocol.handle(LOCAL_MEDIA_SCHEME, (request) => {
    const token = new URL(request.url).pathname.slice(1);
    const record = localMediaTokens.get(token);
    if (!record || !existsSync(record.filePath)) return new Response("Not found", { status: 404 });
    if (record.scope.type === "grant" && !localFolderGrants.has(record.scope.grantId)) return new Response("Authorization expired", { status: 403 });
    if (record.scope.type === "library" && !localMediaLibrary.has(record.scope.id)) return new Response("Media removed", { status: 404 });
    return net.fetch(pathToFileURL(record.filePath).toString());
  });
}

function safeDownloadName(value) {
  const normalized = String(value || "download").replace(/[\\/:*?"<>|]/g, "-").trim();
  return normalized.slice(0, 120) || "download";
}

function setupDownloads() {
  const registerDownloadSession = (downloadSession) => downloadSession.on("will-download", (_event, item) => {
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
  registerDownloadSession(session.defaultSession);
  registerDownloadSession(session.fromPartition(NATIVE_BROWSER_PARTITION));
}

function configureBrowserSession() {
  const browserSession = session.fromPartition(NATIVE_BROWSER_PARTITION);
  browserSession.setPermissionCheckHandler((_webContents, permission) => {
    startupLog(`Blocked browser permission check: ${permission}`);
    return false;
  });
  browserSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    startupLog(`Blocked browser permission request: ${permission}`);
    callback(false);
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
  const isWebUrl = (url) => /^https?:\/\//i.test(url);
  let lastPopupUrl = "";
  let lastPopupAt = 0;
  const routePopupInCurrentGuest = (url, source) => {
    if (!isWebUrl(url) || contents.isDestroyed()) return false;
    const targetUrl = new URL(url).toString();
    const now = Date.now();
    if (targetUrl === lastPopupUrl && now - lastPopupAt < 400) return true;
    lastPopupUrl = targetUrl;
    lastPopupAt = now;
    startupLog(`Guest ${source}: ${targetUrl}`);
    setImmediate(() => {
      if (contents.isDestroyed()) return;
      contents.loadURL(targetUrl)
        .then(() => startupLog(`Guest current-tab navigation complete: ${contents.getURL()}`))
        .catch((error) => startupLog(`Guest current-tab navigation failed: ${error.message}`));
    });
    return true;
  };

  // Electron 的 webview 对 target=_blank 锚点可能不会触发原生 window-open
  // 回调。Chromium 本身会稳定发出 Page.windowOpen，因此只在主进程内部订阅
  // 该事件，并将合规的 http(s) 目标交回同一个受 sandbox 保护的 guest。
  try {
    const guestDebugger = contents.debugger;
    guestDebugger.on("message", (_event, method, params) => {
      if (method === "Page.windowOpen") routePopupInCurrentGuest(params?.url, "Page.windowOpen");
    });
    guestDebugger.on("detach", (_event, reason) => startupLog(`Guest debugger detached: ${reason}`));
    guestDebugger.attach("1.3");
    guestDebugger.sendCommand("Page.enable")
      .then(() => startupLog("Guest Page.windowOpen routing enabled."))
      .catch((error) => startupLog(`Guest Page.enable failed: ${error.message}`));
  } catch (error) {
    startupLog(`Guest debugger attach failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  contents.setWindowOpenHandler(({ url }) => {
    routePopupInCurrentGuest(url, "window-open fallback");
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
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
    },
  });

  mainWindow.webContents.on("will-attach-webview", (_event, guestPreferences, guestParams) => {
    guestPreferences.nodeIntegration = false;
    guestPreferences.contextIsolation = true;
    guestPreferences.sandbox = true;
    guestPreferences.webSecurity = true;
    guestPreferences.partition = NATIVE_BROWSER_PARTITION;
    guestPreferences.preload = path.join(__dirname, "guest-preload.cjs");
    guestParams.partition = NATIVE_BROWSER_PARTITION;
    guestParams.allowpopups = "true";
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
ipcMain.handle("freshdesk:native-browser-show", (event, payload) => {
  if (!isDesktopRenderer(event)) throw new Error("未授权的浏览器请求。");
  const { tabId, url, bounds } = validateNativeBrowserPayload(payload);
  if (!bounds) throw new Error("浏览器显示区域无效。");
  const view = getNativeBrowserView();
  nativeBrowserTabId = tabId;
  view.setBounds(bounds);
  view.setVisible(true);
  view.webContents.focus();
  if (view.webContents.getURL() !== url) void view.webContents.loadURL(url).catch((error) => startupLog(`Native browser load failed: ${error.message}`));
  return { shown: true };
});
ipcMain.handle("freshdesk:native-browser-hide", (event) => {
  if (!isDesktopRenderer(event)) throw new Error("未授权的浏览器请求。");
  if (nativeBrowserView && !nativeBrowserView.webContents.isDestroyed()) nativeBrowserView.setVisible(false);
  nativeBrowserTabId = null;
  return { hidden: true };
});
ipcMain.handle("freshdesk:native-browser-bounds", (event, payload) => {
  if (!isDesktopRenderer(event)) throw new Error("未授权的浏览器请求。");
  const { tabId, bounds } = validateNativeBrowserPayload(payload, false);
  if (!bounds || !nativeBrowserView || nativeBrowserTabId !== tabId) return { updated: false };
  nativeBrowserView.setBounds(bounds);
  return { updated: true };
});
ipcMain.handle("freshdesk:native-browser-navigate", (event, payload) => {
  if (!isDesktopRenderer(event)) throw new Error("未授权的浏览器请求。");
  const { tabId, url } = validateNativeBrowserPayload(payload);
  const view = getNativeBrowserView();
  nativeBrowserTabId = tabId;
  return view.webContents.loadURL(url).then(() => ({ navigated: true })).catch((error) => { throw new Error(`网页无法载入：${error.message}`); });
});
ipcMain.handle("freshdesk:native-browser-command", (event, payload) => {
  if (!isDesktopRenderer(event) || !payload || typeof payload !== "object") throw new Error("未授权的浏览器请求。");
  if (!nativeBrowserView || nativeBrowserView.webContents.isDestroyed() || nativeBrowserTabId !== payload.tabId) return { handled: false };
  const contents = nativeBrowserView.webContents;
  if (payload.command === "back" && contents.canGoBack()) contents.goBack();
  else if (payload.command === "forward" && contents.canGoForward()) contents.goForward();
  else if (payload.command === "reload") contents.reloadIgnoringCache();
  else if (payload.command === "focus") contents.focus();
  else return { handled: false };
  return { handled: true };
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
ipcMain.handle("freshdesk:authorize-local-folder", async (event) => {
  if (!isDesktopRenderer(event)) throw new Error("未授权的本地文件请求。");
  const selected = await dialog.showOpenDialog(mainWindow, {
    title: "选择允许 Freshdesk 管理的文件夹",
    properties: ["openDirectory"],
  });
  if (selected.canceled || !selected.filePaths[0]) return { authorized: false };
  const root = path.resolve(selected.filePaths[0]);
  const grant = { id: randomUUID(), root, name: path.basename(root) || root, grantedAt: new Date().toISOString() };
  localFolderGrants.set(grant.id, grant);
  return { authorized: true, grant: { id: grant.id, name: grant.name, grantedAt: grant.grantedAt } };
});
ipcMain.handle("freshdesk:revoke-local-folder", (event, grantId) => {
  if (!isDesktopRenderer(event) || typeof grantId !== "string") throw new Error("未授权的本地文件请求。");
  localFolderGrants.delete(grantId);
  clearLocalMediaTokens((record) => record.scope.type === "grant" && record.scope.grantId === grantId);
  return { revoked: true };
});
ipcMain.handle("freshdesk:list-authorized-folder", (event, payload) => {
  if (!isDesktopRenderer(event)) throw new Error("未授权的本地文件请求。");
  const { grant, relativePath, fullPath } = resolveGrantedPath(payload);
  const target = statSync(fullPath);
  if (!target.isDirectory()) throw new Error("请选择已授权文件夹中的目录。");
  const entries = readdirSync(fullPath, { withFileTypes: true }).filter((entry) => !entry.isSymbolicLink()).slice(0, 400).map((entry) => {
    const entryPath = path.join(fullPath, entry.name);
    const details = statSync(entryPath);
    const extension = entry.isDirectory() ? "" : localFileExtension(entry.name);
    const mediaUrl = !entry.isDirectory() && isLocalMediaExtension(extension) ? createLocalMediaUrl(entryPath, { type: "grant", grantId: grant.id }) : undefined;
    return { name: entry.name, relativePath: path.posix.join(relativePath.replace(/\\/g, "/"), entry.name), kind: entry.isDirectory() ? "directory" : "file", extension, size: details.size, modifiedAt: details.mtime.toISOString(), mediaUrl };
  }).sort((left, right) => Number(right.kind === "directory") - Number(left.kind === "directory") || left.name.localeCompare(right.name));
  return { grant: { id: grant.id, name: grant.name, grantedAt: grant.grantedAt }, relativePath, entries };
});
ipcMain.handle("freshdesk:read-authorized-text", (event, payload) => {
  if (!isDesktopRenderer(event)) throw new Error("未授权的本地文件请求。");
  const { fullPath } = resolveGrantedPath(payload);
  const details = statSync(fullPath);
  const extension = localFileExtension(fullPath);
  if (!details.isFile() || !["txt", "md", "json", "csv", "log", "yml", "yaml"].includes(extension)) throw new Error("仅可预览已授权的文本文件。");
  if (details.size > 1024 * 1024) throw new Error("文本文件超过 1 MB，未在应用内读取。");
  return { content: readFileSync(fullPath, "utf8"), size: details.size };
});
ipcMain.handle("freshdesk:rename-authorized-entry", (event, payload) => {
  if (!isDesktopRenderer(event) || !payload || typeof payload.name !== "string") throw new Error("未授权的本地文件请求。");
  const { grant, relativePath, fullPath } = resolveGrantedPath(payload);
  const name = payload.name.trim();
  if (!name || name.length > 180 || /[\\/:*?"<>|]/.test(name) || name === "." || name === "..") throw new Error("请输入有效的新名称。");
  const target = path.resolve(path.dirname(fullPath), name);
  if (!isPathWithin(grant.root, target) || existsSync(target)) throw new Error("目标名称不可用或超出授权范围。");
  renameSync(fullPath, target);
  for (const record of localMediaLibrary.values()) if (record.sourcePath === fullPath) record.sourcePath = target;
  saveLocalMediaLibrary();
  return { renamed: true, relativePath: path.posix.join(path.posix.dirname(relativePath), name) };
});
ipcMain.handle("freshdesk:trash-authorized-entry", async (event, payload) => {
  if (!isDesktopRenderer(event)) throw new Error("未授权的本地文件请求。");
  const { fullPath } = resolveGrantedPath(payload);
  await shell.trashItem(fullPath);
  for (const [id, record] of localMediaLibrary.entries()) if (record.sourcePath === fullPath) localMediaLibrary.delete(id);
  saveLocalMediaLibrary();
  return { trashed: true };
});
ipcMain.handle("freshdesk:import-local-media", async (event, rawKind) => {
  if (!isDesktopRenderer(event)) throw new Error("未授权的本地媒体请求。");
  const kind = validateMediaKind(rawKind);
  const spec = LOCAL_MEDIA_KINDS[kind];
  const selected = await dialog.showOpenDialog(mainWindow, { title: kind === "music" ? "导入本地音乐" : "导入本地照片", properties: ["openFile", "multiSelections"], filters: [{ name: spec.filterName, extensions: spec.extensions }] });
  if (selected.canceled) return { imported: [], skipped: [] };
  const imported = [];
  const skipped = [];
  for (const sourcePath of selected.filePaths.slice(0, 300)) {
    const extension = localFileExtension(sourcePath);
    if (!spec.extensions.includes(extension)) { skipped.push(path.basename(sourcePath)); continue; }
    const existing = [...localMediaLibrary.values()].find((record) => record.kind === kind && record.sourcePath === sourcePath);
    const details = statSync(sourcePath);
    const record = existing ?? { id: `local-${kind}-${randomUUID()}`, sourcePath, kind, name: path.basename(sourcePath), extension, size: details.size, importedAt: new Date().toISOString() };
    localMediaLibrary.set(record.id, record);
    const descriptor = mediaDescriptor(record);
    if (descriptor) imported.push(descriptor);
  }
  saveLocalMediaLibrary();
  return { imported, skipped };
});
ipcMain.handle("freshdesk:list-local-media", (event, rawKind) => {
  if (!isDesktopRenderer(event)) throw new Error("未授权的本地媒体请求。");
  const kind = validateMediaKind(rawKind);
  const missing = [];
  const items = [];
  for (const [id, record] of localMediaLibrary.entries()) {
    if (record.kind !== kind) continue;
    const descriptor = mediaDescriptor(record);
    if (descriptor) items.push(descriptor); else missing.push(id);
  }
  missing.forEach((id) => localMediaLibrary.delete(id));
  if (missing.length) saveLocalMediaLibrary();
  return items.sort((left, right) => right.importedAt.localeCompare(left.importedAt));
});
ipcMain.handle("freshdesk:remove-local-media", (event, id) => {
  if (!isDesktopRenderer(event) || typeof id !== "string") throw new Error("未授权的本地媒体请求。");
  localMediaLibrary.delete(id);
  clearLocalMediaTokens((record) => record.scope.type === "library" && record.scope.id === id);
  saveLocalMediaLibrary();
  return { removed: true };
});

app.whenReady().then(() => {
  setupLocalMediaProtocol();
  loadLocalMediaLibrary();
  configureBrowserSession();
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

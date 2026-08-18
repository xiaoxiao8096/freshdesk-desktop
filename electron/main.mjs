import { app, BrowserWindow, shell } from "electron";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow = null;
let serverProcess = null;

function startEmbeddedServer() {
  const serverEntry = path.join(app.getAppPath(), "dist", "index.js");
  const port = process.env.FRESHDESK_PORT || "49320";

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Freshdesk 本地服务启动超时。")), 15_000);
    serverProcess = spawn(process.execPath, [serverEntry], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PORT: port },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const onOutput = (chunk) => {
      const message = String(chunk);
      const matched = message.match(/Server running on (http:\/\/localhost:\d+)\//);
      if (matched?.[1]) {
        clearTimeout(timeout);
        resolve(matched[1]);
      }
    };

    serverProcess.stdout.on("data", onOutput);
    serverProcess.stderr.on("data", (chunk) => console.error("[Freshdesk server]", String(chunk)));
    serverProcess.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    serverProcess.once("exit", (code) => {
      if (code && code !== 0) console.error(`[Freshdesk server] exited with code ${code}`);
    });
  });
}

function wireGuestNavigation(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    contents.loadURL(url).catch(() => undefined);
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
    delete guestPreferences.preload;
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
}

app.whenReady().then(createWindow).catch((error) => {
  console.error(error);
  app.quit();
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

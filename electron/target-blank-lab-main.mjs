import { app, BrowserWindow } from "electron";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let windowRef;

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  appendFileSync(path.join(app.getPath("userData"), "target-blank-lab.log"), line, "utf8");
  console.log(line.trim());
}

app.whenReady().then(async () => {
  windowRef = new BrowserWindow({
    width: 1180,
    height: 820,
    webPreferences: {
      webviewTag: true,
      preload: path.join(__dirname, "target-blank-lab-window-preload.cjs"),
      nativeWindowOpen: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  windowRef.webContents.on("will-attach-webview", (_event, prefs, params) => {
    prefs.nodeIntegration = false;
    prefs.contextIsolation = true;
    prefs.sandbox = true;
    prefs.preload = path.join(__dirname, "target-blank-lab-guest-preload.cjs");
    params.allowpopups = "true";
    log(`will-attach allowpopups=${params.allowpopups} nativeWindowOpen=false`);
  });
  windowRef.webContents.on("did-attach-webview", (_event, contents) => {
    log(`did-attach-webview id=${contents.id}`);
    contents.setWindowOpenHandler(({ url }) => {
      log(`guest setWindowOpenHandler url=${url}`);
      return { action: "deny" };
    });
    contents.on("new-window", (_event, url) => log(`guest legacy new-window url=${url}`));
    contents.on("did-navigate", (_event, url) => log(`guest did-navigate url=${url}`));
  });
  await windowRef.loadFile(path.join(__dirname, "target-blank-lab.html"));
  log("lab-ready");
});

app.on("window-all-closed", () => app.quit());

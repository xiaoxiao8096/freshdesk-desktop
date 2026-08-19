const { contextBridge, ipcRenderer } = require("electron");
const desktopPlatform = process.platform;
const electronVersion = process.versions.electron;

contextBridge.exposeInMainWorld("freshdeskDesktop", {
  isElectron: true,
  platform: desktopPlatform,
  version: electronVersion,
  nativeBrowserShow: (payload) => ipcRenderer.invoke("freshdesk:native-browser-show", payload),
  nativeBrowserHide: () => ipcRenderer.invoke("freshdesk:native-browser-hide"),
  nativeBrowserBounds: (payload) => ipcRenderer.invoke("freshdesk:native-browser-bounds", payload),
  nativeBrowserNavigate: (payload) => ipcRenderer.invoke("freshdesk:native-browser-navigate", payload),
  nativeBrowserCommand: (payload) => ipcRenderer.invoke("freshdesk:native-browser-command", payload),
  checkForUpdates: () => ipcRenderer.invoke("freshdesk:check-for-updates"),
  installUpdate: () => ipcRenderer.invoke("freshdesk:install-update"),
  startDownload: (request) => ipcRenderer.invoke("freshdesk:start-download", request),
  cancelDownload: (id) => ipcRenderer.invoke("freshdesk:cancel-download", id),
  exportDesktopState: (payload) => ipcRenderer.invoke("freshdesk:export-desktop-state", payload),
  backupDesktopState: (payload) => ipcRenderer.invoke("freshdesk:backup-desktop-state", payload),
  openDesktopBackup: () => ipcRenderer.invoke("freshdesk:open-desktop-backup"),
  onUpdateStatus: (listener) => {
    const handler = (_event, status) => listener(status);
    ipcRenderer.on("freshdesk:update-status", handler);
    return () => ipcRenderer.removeListener("freshdesk:update-status", handler);
  },
  onDownloadStatus: (listener) => {
    const handler = (_event, status) => listener(status);
    ipcRenderer.on("freshdesk:download-status", handler);
    return () => ipcRenderer.removeListener("freshdesk:download-status", handler);
  },
  onNativeBrowserStatus: (listener) => {
    const handler = (_event, status) => listener(status);
    ipcRenderer.on("freshdesk:native-browser-status", handler);
    return () => ipcRenderer.removeListener("freshdesk:native-browser-status", handler);
  },
});

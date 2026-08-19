import { contextBridge, ipcRenderer, process } from "electron";

contextBridge.exposeInMainWorld("freshdeskDesktop", {
  isElectron: true,
  platform: process.platform,
  version: process.versions.electron,
  browserGuestPreloadUrl: new URL("./guest-preload.cjs", import.meta.url).toString(),
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
});

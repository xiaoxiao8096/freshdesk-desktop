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
  authorizeLocalFolder: () => ipcRenderer.invoke("freshdesk:authorize-local-folder"),
  revokeLocalFolder: (grantId) => ipcRenderer.invoke("freshdesk:revoke-local-folder", grantId),
  listAuthorizedFolder: (payload) => ipcRenderer.invoke("freshdesk:list-authorized-folder", payload),
  readAuthorizedText: (payload) => ipcRenderer.invoke("freshdesk:read-authorized-text", payload),
  renameAuthorizedEntry: (payload) => ipcRenderer.invoke("freshdesk:rename-authorized-entry", payload),
  trashAuthorizedEntry: (payload) => ipcRenderer.invoke("freshdesk:trash-authorized-entry", payload),
  importLocalMedia: (kind) => ipcRenderer.invoke("freshdesk:import-local-media", kind),
  listLocalMedia: (kind) => ipcRenderer.invoke("freshdesk:list-local-media", kind),
  removeLocalMedia: (id) => ipcRenderer.invoke("freshdesk:remove-local-media", id),
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

import { contextBridge, ipcRenderer, process } from "electron";

contextBridge.exposeInMainWorld("freshdeskDesktop", {
  isElectron: true,
  platform: process.platform,
  version: process.versions.electron,
  checkForUpdates: () => ipcRenderer.invoke("freshdesk:check-for-updates"),
  installUpdate: () => ipcRenderer.invoke("freshdesk:install-update"),
  onUpdateStatus: (listener) => {
    const handler = (_event, status) => listener(status);
    ipcRenderer.on("freshdesk:update-status", handler);
    return () => ipcRenderer.removeListener("freshdesk:update-status", handler);
  },
});

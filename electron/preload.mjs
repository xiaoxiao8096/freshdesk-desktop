import { contextBridge, process } from "electron";

contextBridge.exposeInMainWorld("freshdeskDesktop", {
  isElectron: true,
  platform: process.platform,
  version: process.versions.electron,
});

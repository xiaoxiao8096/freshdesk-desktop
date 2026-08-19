const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("freshdeskPreloadProbe", { active: true });

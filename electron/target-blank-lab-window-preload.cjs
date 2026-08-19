const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("targetBlankLabBridge", { active: true });

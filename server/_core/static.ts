import type { Express } from "express";
import express from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");
  const fontPath = process.env.FRESHDESK_FONT_DIR;
  if (!fs.existsSync(distPath)) {
    console.error("Could not find the build directory: " + distPath + ", make sure to build the client first");
  }
  if (fontPath && fs.existsSync(fontPath)) {
    app.use("/freshdesk-fonts", express.static(fontPath, { immutable: true, maxAge: "1y" }));
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

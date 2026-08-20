import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const localMediaStyles = readFileSync(resolve(process.cwd(), "client/src/local-media.css"), "utf8");

describe("本地 Finder 与媒体资料库", () => {
  it("通过用户触发的授权和导入动作连接本地内容", () => {
    expect(homeSource).toContain("const authorizeLocalFinder = async");
    expect(homeSource).toContain("window.freshdeskDesktop?.authorizeLocalFolder");
    expect(homeSource).toContain('void importLocalMedia("music")');
    expect(homeSource).toContain('void importLocalMedia("photo")');
    expect(homeSource).toContain("本地文件授权仅在 Windows 桌面版中可用");
  });

  it("提供授权范围内的预览、改名、系统回收站和可撤销授权", () => {
    expect(homeSource).toContain("listAuthorizedFolder");
    expect(homeSource).toContain("readAuthorizedText");
    expect(homeSource).toContain("renameAuthorizedEntry");
    expect(homeSource).toContain("trashAuthorizedEntry");
    expect(homeSource).toContain("revokeLocalFolder");
    expect(homeSource).toContain("原文件将由 Windows 回收站保留");
  });

  it("为授权、资料库和本地预览提供清晰的材料、焦点与空状态", () => {
    expect(localMediaStyles).toContain(".local-finder-panel");
    expect(localMediaStyles).toContain(".local-finder-preview");
    expect(localMediaStyles).toContain(".local-media-library");
    expect(localMediaStyles).toContain(".local-media-empty");
  });
});

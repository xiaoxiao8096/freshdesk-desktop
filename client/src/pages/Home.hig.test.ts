import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const higStyles = readFileSync(resolve(process.cwd(), "client/src/macos-hig.css"), "utf8");

describe("macOS HIG 高频应用层级", () => {
  it("保留高频应用的原生工具栏、侧边栏、列表和输入操作结构", () => {
    expect(homeSource).toContain('className="music-sidebar"');
    expect(homeSource).toContain('className={`note-list-item ${item.id === activeNote.id ? "active" : ""}`}');
    expect(homeSource).toContain('className="photos-view-actions"');
    expect(homeSource).toContain('className="calendar-app-sidebar"');
    expect(homeSource).toContain('className="reminder-add"');
    expect(homeSource).toContain('className="terminal-input-row"');
  });

  it("为六个高频应用统一材料、选中态、输入焦点和终端深色层级", () => {
    expect(higStyles).toContain("/* 第三阶段：高频应用沿用同一工具栏、侧边栏和列表语法");
    expect(higStyles).toContain(".music-window,");
    expect(higStyles).toContain(".notes-sidebar .note-list-item.active");
    expect(higStyles).toContain(".photos-view-actions");
    expect(higStyles).toContain(".calendar-app-content > header form:focus-within");
    expect(higStyles).toContain(".reminder-list article.done .reminder-check");
    expect(higStyles).toContain(".terminal-input-row:focus-within");
  });
});

import { describe, expect, it } from "vitest";
import { DESKTOP_BACKUP_FORMAT, DESKTOP_BACKUP_VERSION, createDesktopBackup, desktopBackupFilename, parseDesktopBackup } from "./desktopBackup";

describe("desktop backup", () => {
  it("wraps desktop state in a versioned export envelope", () => {
    const backup = createDesktopBackup({ notes: [{ id: "note-1" }] }, new Date("2026-08-18T10:00:00.000Z"));
    expect(backup).toEqual({
      format: DESKTOP_BACKUP_FORMAT,
      version: DESKTOP_BACKUP_VERSION,
      exportedAt: "2026-08-18T10:00:00.000Z",
      snapshot: { notes: [{ id: "note-1" }] },
    });
  });

  it("accepts only valid Freshdesk backup envelopes", () => {
    const valid = JSON.stringify(createDesktopBackup({ systemAppearance: "dark" }, new Date("2026-08-18T10:00:00.000Z")));
    expect(parseDesktopBackup<{ systemAppearance: string }>(valid)?.snapshot).toEqual({ systemAppearance: "dark" });
    expect(parseDesktopBackup("{not-json")).toBeNull();
    expect(parseDesktopBackup(JSON.stringify({ format: DESKTOP_BACKUP_FORMAT, version: 99, exportedAt: "2026-08-18", snapshot: {} }))).toBeNull();
  });

  it("generates a filesystem-safe JSON filename", () => {
    expect(desktopBackupFilename(new Date("2026-08-18T10:00:00.000Z"))).toBe("Freshdesk-Desktop-export-2026-08-18T10-00-00-000Z.json");
  });
});

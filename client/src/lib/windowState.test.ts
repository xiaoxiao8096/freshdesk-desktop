import { describe, expect, it } from "vitest";
import { closeWindowById, sanitizeRestoredWindows, topVisibleWindow } from "./windowState";

const windows = [
  { id: "finder", minimized: false, zIndex: 26 },
  { id: "browser", minimized: false, zIndex: 30 },
  { id: "notes", minimized: true, zIndex: 32 },
];

describe("window state", () => {
  it("removes every matching window when an app is closed", () => {
    expect(closeWindowById(windows, "browser").map((windowItem) => windowItem.id)).toEqual(["finder", "notes"]);
  });

  it("targets the highest visible window for the global close shortcut", () => {
    expect(topVisibleWindow(windows)?.id).toBe("browser");
  });

  it("removes duplicate entries from a restored desktop snapshot", () => {
    expect(sanitizeRestoredWindows([...windows, { id: "browser", minimized: false, zIndex: 42 }]).map((windowItem) => windowItem.id)).toEqual(["finder", "browser", "notes"]);
  });
});

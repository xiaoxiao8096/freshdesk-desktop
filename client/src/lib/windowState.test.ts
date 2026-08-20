import { describe, expect, it } from "vitest";
import { assignWindowToGroup, bringWindowGroupToFront, bringWindowToFront, clampRestoredWindowBounds, closeAllWindows, closeWindowById, minimizeAllWindows, nextVisibleWindowAfterAction, orderWindowsByZIndex, removeWindowGroup, sanitizeRestoredWindows, setWindowGroupMinimized, topVisibleWindow, windowIdsForGroup } from "./windowState";

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

  it("supports bulk close, bulk minimize and manager ordering", () => {
    expect(closeAllWindows<typeof windows[number]>()).toEqual([]);
    expect(minimizeAllWindows(windows).every((windowItem) => windowItem.minimized)).toBe(true);
    expect(orderWindowsByZIndex(windows).map((windowItem) => windowItem.id)).toEqual(["notes", "browser", "finder"]);
  });

  it("keeps restored windows reachable after a smaller viewport is used", () => {
    expect(clampRestoredWindowBounds({ x: 1600, y: -30, width: 1600, height: 900 }, 1280, 720)).toEqual({ x: 1130, y: 30, width: 1264, height: 678 });
  });

  it("chooses the next visible top window after the focused window closes or minimizes", () => {
    expect(nextVisibleWindowAfterAction(windows, "browser", "close")?.id).toBe("finder");
    expect(nextVisibleWindowAfterAction(windows, "browser", "minimize")?.id).toBe("finder");
  });

  it("raises the browser window above other windows when its webview receives focus", () => {
    const focused = bringWindowToFront(windows, "finder");
    expect(topVisibleWindow(focused)?.id).toBe("finder");
  });

  it("does not rewrite window state when an already frontmost browser receives another input focus event", () => {
    expect(bringWindowToFront(windows, "browser")).toBe(windows);
  });

  it("can assign, inspect and remove a window group without closing its members", () => {
    const grouped = assignWindowToGroup(assignWindowToGroup(windows, "finder", "research"), "browser", "research");
    expect(windowIdsForGroup(grouped, "research")).toEqual(["finder", "browser"]);
    expect(removeWindowGroup(grouped, "research").every((windowItem) => !windowItem.groupId)).toBe(true);
  });

  it("raises or minimizes every member of a window group together", () => {
    const grouped = windows.map((windowItem) => windowItem.id === "finder" || windowItem.id === "notes" ? { ...windowItem, groupId: "writing" } : windowItem);
    const focused = bringWindowGroupToFront(grouped, "writing");
    expect(topVisibleWindow(focused)?.id).toBe("notes");
    expect(setWindowGroupMinimized(focused, "writing", true).filter((windowItem) => windowItem.groupId === "writing").every((windowItem) => windowItem.minimized)).toBe(true);
  });
});

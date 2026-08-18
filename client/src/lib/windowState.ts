export type WindowStateItem = {
  id: string;
  minimized: boolean;
  zIndex: number;
};

export type RestoredWindowBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function clampRestoredWindowBounds(bounds: RestoredWindowBounds, viewportWidth: number, viewportHeight: number): RestoredWindowBounds {
  const safeWidth = Math.max(720, viewportWidth);
  const safeHeight = Math.max(520, viewportHeight);
  const width = Math.min(Math.max(360, bounds.width), safeWidth - 16);
  const height = Math.min(Math.max(240, bounds.height), safeHeight - 42);
  return {
    x: Math.min(Math.max(8, bounds.x), Math.max(8, safeWidth - 150)),
    y: Math.min(Math.max(30, bounds.y), Math.max(30, safeHeight - 105)),
    width,
    height,
  };
}

export function closeWindowById<T extends WindowStateItem>(windows: T[], id: T["id"]) {
  return windows.filter((windowItem) => windowItem.id !== id);
}

export function closeAllWindows<T extends WindowStateItem>() {
  return [] as T[];
}

export function minimizeAllWindows<T extends WindowStateItem>(windows: T[]) {
  return windows.map((windowItem) => ({ ...windowItem, minimized: true }));
}

export function orderWindowsByZIndex<T extends WindowStateItem>(windows: T[]) {
  return [...windows].sort((left, right) => right.zIndex - left.zIndex);
}

export function topVisibleWindow<T extends WindowStateItem>(windows: T[]) {
  return orderWindowsByZIndex(windows.filter((windowItem) => !windowItem.minimized))[0] ?? null;
}

export function bringWindowToFront<T extends WindowStateItem>(windows: T[], id: T["id"]) {
  const currentTop = topVisibleWindow(windows);
  const target = windows.find((windowItem) => windowItem.id === id);
  if (target && !target.minimized && currentTop?.id === id) return windows;
  const top = Math.max(25, ...windows.map((windowItem) => windowItem.zIndex));
  return windows.map((windowItem) => windowItem.id === id ? { ...windowItem, minimized: false, zIndex: top + 1 } : windowItem);
}

export function nextVisibleWindowAfterAction<T extends WindowStateItem>(windows: T[], id: T["id"], action: "close" | "minimize") {
  const nextWindows = action === "close" ? closeWindowById(windows, id) : minimizeAllBut(windows, id);
  return topVisibleWindow(nextWindows);
}

function minimizeAllBut<T extends WindowStateItem>(windows: T[], id: T["id"]) {
  return windows.map((windowItem) => windowItem.id === id ? { ...windowItem, minimized: true } : windowItem);
}

export function sanitizeRestoredWindows<T extends WindowStateItem>(windows: T[] | undefined) {
  const seen = new Set<string>();
  return (windows ?? []).filter((windowItem) => {
    if (!windowItem?.id || seen.has(windowItem.id)) return false;
    seen.add(windowItem.id);
    return true;
  });
}

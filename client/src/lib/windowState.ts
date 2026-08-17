export type WindowStateItem = {
  id: string;
  minimized: boolean;
  zIndex: number;
};

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

export function sanitizeRestoredWindows<T extends WindowStateItem>(windows: T[] | undefined) {
  const seen = new Set<string>();
  return (windows ?? []).filter((windowItem) => {
    if (!windowItem?.id || seen.has(windowItem.id)) return false;
    seen.add(windowItem.id);
    return true;
  });
}

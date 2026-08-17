export type WindowStateItem = {
  id: string;
  minimized: boolean;
  zIndex: number;
};

export function closeWindowById<T extends WindowStateItem>(windows: T[], id: T["id"]) {
  return windows.filter((windowItem) => windowItem.id !== id);
}

export function topVisibleWindow<T extends WindowStateItem>(windows: T[]) {
  return windows.filter((windowItem) => !windowItem.minimized).sort((left, right) => right.zIndex - left.zIndex)[0] ?? null;
}

export function sanitizeRestoredWindows<T extends WindowStateItem>(windows: T[] | undefined) {
  const seen = new Set<string>();
  return (windows ?? []).filter((windowItem) => {
    if (!windowItem?.id || seen.has(windowItem.id)) return false;
    seen.add(windowItem.id);
    return true;
  });
}

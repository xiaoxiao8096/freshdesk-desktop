export type SnapshotStorage = Pick<Storage, "getItem">;

export function loadStoredSnapshot<T extends object>(storage: SnapshotStorage | null | undefined, key: string): T | null {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as T;
    return snapshot && typeof snapshot === "object" ? snapshot : null;
  } catch {
    return null;
  }
}

export const DESKTOP_BACKUP_FORMAT = "freshdesk-desktop-backup";
export const DESKTOP_BACKUP_VERSION = 1;

export type DesktopBackupEnvelope<T> = {
  format: typeof DESKTOP_BACKUP_FORMAT;
  version: typeof DESKTOP_BACKUP_VERSION;
  exportedAt: string;
  snapshot: T;
};

export function createDesktopBackup<T>(snapshot: T, now = new Date()): DesktopBackupEnvelope<T> {
  return {
    format: DESKTOP_BACKUP_FORMAT,
    version: DESKTOP_BACKUP_VERSION,
    exportedAt: now.toISOString(),
    snapshot,
  };
}

export function parseDesktopBackup<T>(raw: string): DesktopBackupEnvelope<T> | null {
  try {
    const value = JSON.parse(raw) as Partial<DesktopBackupEnvelope<T>>;
    if (value.format !== DESKTOP_BACKUP_FORMAT || value.version !== DESKTOP_BACKUP_VERSION || typeof value.exportedAt !== "string" || !value.snapshot || typeof value.snapshot !== "object") return null;
    if (Number.isNaN(Date.parse(value.exportedAt))) return null;
    return value as DesktopBackupEnvelope<T>;
  } catch {
    return null;
  }
}

export function desktopBackupFilename(now = new Date(), prefix = "Freshdesk-Desktop-export") {
  return `${prefix}-${now.toISOString().replace(/[:.]/g, "-")}.json`;
}

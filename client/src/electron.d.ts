export {};

declare global {
  type FreshdeskDownloadStatus = {
    id: string;
    state: "downloading" | "completed" | "cancelled" | "failed";
    title: string;
    url: string;
    progress: number;
    receivedBytes?: number;
    totalBytes?: number;
    path?: string;
    message?: string;
  };

  type FreshdeskBackupResult = { saved: boolean; path?: string };

  interface Window {
    freshdeskDesktop?: {
      isElectron: boolean;
      platform: string;
      version: string;
      browserGuestPreloadUrl: string;
      checkForUpdates: () => Promise<unknown>;
      installUpdate: () => Promise<void>;
      startDownload: (request: { id: string; url: string; title?: string }) => Promise<{ accepted: boolean; id: string }>;
      cancelDownload: (id: string) => Promise<boolean>;
      exportDesktopState: (payload: unknown) => Promise<FreshdeskBackupResult>;
      backupDesktopState: (payload: unknown) => Promise<FreshdeskBackupResult>;
      openDesktopBackup: () => Promise<{ selected: boolean; raw?: string; path?: string }>;
      onUpdateStatus: (listener: (status: { state: "checking" | "current" | "downloading" | "ready" | "error"; message: string }) => void) => () => void;
      onDownloadStatus: (listener: (status: FreshdeskDownloadStatus) => void) => () => void;
    };
  }
}

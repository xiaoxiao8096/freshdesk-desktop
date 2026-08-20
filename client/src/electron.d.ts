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
  type FreshdeskNativeBrowserBounds = { x: number; y: number; width: number; height: number };
  type FreshdeskNativeBrowserStatus = { tabId: string; type: "loading" | "stopped" | "navigated" | "title" | "failed"; url?: string; title?: string; message?: string };
  type FreshdeskLocalFolderGrant = { id: string; name: string; grantedAt: string };
  type FreshdeskLocalFileEntry = { name: string; relativePath: string; kind: "directory" | "file"; extension: string; size: number; modifiedAt: string; mediaUrl?: string };
  type FreshdeskLocalMediaItem = { id: string; title: string; extension: string; size: number; importedAt: string; mediaUrl: string };

  interface Window {
    freshdeskDesktop?: {
      isElectron: boolean;
      platform: string;
      version: string;
      nativeBrowserShow: (payload: { tabId: string; url: string; bounds: FreshdeskNativeBrowserBounds }) => Promise<{ shown: boolean }>;
      nativeBrowserHide: () => Promise<{ hidden: boolean }>;
      nativeBrowserBounds: (payload: { tabId: string; bounds: FreshdeskNativeBrowserBounds }) => Promise<{ updated: boolean }>;
      nativeBrowserNavigate: (payload: { tabId: string; url: string }) => Promise<{ navigated: boolean }>;
      nativeBrowserCommand: (payload: { tabId: string; command: "back" | "forward" | "reload" | "focus" }) => Promise<{ handled: boolean }>;
      checkForUpdates: () => Promise<unknown>;
      installUpdate: () => Promise<void>;
      startDownload: (request: { id: string; url: string; title?: string }) => Promise<{ accepted: boolean; id: string }>;
      cancelDownload: (id: string) => Promise<boolean>;
      exportDesktopState: (payload: unknown) => Promise<FreshdeskBackupResult>;
      backupDesktopState: (payload: unknown) => Promise<FreshdeskBackupResult>;
      openDesktopBackup: () => Promise<{ selected: boolean; raw?: string; path?: string }>;
      authorizeLocalFolder: () => Promise<{ authorized: boolean; grant?: FreshdeskLocalFolderGrant }>;
      revokeLocalFolder: (grantId: string) => Promise<{ revoked: boolean }>;
      listAuthorizedFolder: (payload: { grantId: string; relativePath?: string }) => Promise<{ grant: FreshdeskLocalFolderGrant; relativePath: string; entries: FreshdeskLocalFileEntry[] }>;
      readAuthorizedText: (payload: { grantId: string; relativePath: string }) => Promise<{ content: string; size: number }>;
      renameAuthorizedEntry: (payload: { grantId: string; relativePath: string; name: string }) => Promise<{ renamed: boolean; relativePath: string }>;
      trashAuthorizedEntry: (payload: { grantId: string; relativePath: string }) => Promise<{ trashed: boolean }>;
      importLocalMedia: (kind: "music" | "photo") => Promise<{ imported: FreshdeskLocalMediaItem[]; skipped: string[] }>;
      listLocalMedia: (kind: "music" | "photo") => Promise<FreshdeskLocalMediaItem[]>;
      removeLocalMedia: (id: string) => Promise<{ removed: boolean }>;
      onUpdateStatus: (listener: (status: { state: "checking" | "current" | "downloading" | "ready" | "error"; message: string }) => void) => () => void;
      onDownloadStatus: (listener: (status: FreshdeskDownloadStatus) => void) => () => void;
      onNativeBrowserStatus: (listener: (status: FreshdeskNativeBrowserStatus) => void) => () => void;
    };
  }
}

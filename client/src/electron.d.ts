export {};

declare global {
  interface Window {
    freshdeskDesktop?: {
      isElectron: boolean;
      platform: string;
      version: string;
      checkForUpdates: () => Promise<unknown>;
      installUpdate: () => Promise<void>;
      onUpdateStatus: (listener: (status: { state: "checking" | "current" | "downloading" | "ready" | "error"; message: string }) => void) => () => void;
    };
  }
}

export {};

declare global {
  interface Window {
    freshdeskDesktop?: {
      isElectron: boolean;
      platform: string;
      version: string;
    };
  }
}

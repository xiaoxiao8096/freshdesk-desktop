export type BrowserOpenMode = "web" | "video";

export function desktopBrowserOpenMode(isElectronDesktop: boolean, hasRecognizedVideo: boolean): BrowserOpenMode {
  return isElectronDesktop || !hasRecognizedVideo ? "web" : "video";
}

export function desktopSearchUrl(query: string) {
  return `https://www.bing.com/search?q=${encodeURIComponent(query.trim())}`;
}

export function shouldAutoOpenReader(isElectronDesktop: boolean, embedIsRestricted: boolean) {
  return !isElectronDesktop && embedIsRestricted;
}

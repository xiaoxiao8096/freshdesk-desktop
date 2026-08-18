export type BrowserOpenMode = "web";

export function desktopBrowserOpenMode(): BrowserOpenMode {
  return "web";
}

export function desktopSearchUrl(query: string) {
  return `https://www.bing.com/search?q=${encodeURIComponent(query.trim())}`;
}

export function shouldAutoOpenReader() {
  return false;
}

export type NavigationMode = "web" | "search" | "reader" | "video";

export type NavigationRoute = {
  url: string;
  address?: string;
  title?: string;
  mode: NavigationMode;
};

export function appendNavigationRoute<T extends NavigationRoute>(history: T[], historyIndex: number, route: T) {
  const current = history[historyIndex];
  if (current?.url === route.url && current.mode === route.mode) {
    return { history: [...history.slice(0, historyIndex), route, ...history.slice(historyIndex + 1)], historyIndex };
  }
  const nextHistory = [...history.slice(0, historyIndex + 1), route];
  return { history: nextHistory, historyIndex: nextHistory.length - 1 };
}

export function getNavigationStep<T extends NavigationRoute>(history: T[], historyIndex: number, direction: -1 | 1) {
  const nextIndex = historyIndex + direction;
  if (nextIndex < 0 || nextIndex >= history.length) return null;
  return { index: nextIndex, route: history[nextIndex] };
}

export function synchronizeGuestHistoryStep<T extends { id: string; url: string; address: string; title: string; loading: boolean; history: NavigationRoute[]; historyIndex: number }>(
  tab: T,
  pending: { tabId: string; index: number } | null,
  url: string,
  title: string,
) {
  if (!pending || pending.tabId !== tab.id) return null;
  const route = tab.history[pending.index];
  if (!route || route.mode !== "web") return null;
  return { ...tab, url, address: url, title: title || route.title || tab.title, historyIndex: pending.index, loading: false };
}

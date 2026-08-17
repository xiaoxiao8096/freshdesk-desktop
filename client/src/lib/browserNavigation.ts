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

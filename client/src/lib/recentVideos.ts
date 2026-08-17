export function recordRecentVideo<T extends { url: string }>(items: T[], next: T, limit = 18) {
  return [next, ...items.filter((item) => item.url !== next.url)].slice(0, limit);
}

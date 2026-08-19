import { desktopSearchUrl } from "./desktopBrowserMode";

export type SafariAddressResolution = {
  url: string;
  kind: "web" | "search" | "empty";
  query?: string;
};

export function resolveSafariAddress(value: string, fallbackUrl = "about:blank"): SafariAddressResolution {
  const trimmed = value.trim();
  if (!trimmed) return { url: fallbackUrl, kind: "empty" };
  if (/^https?:\/\//i.test(trimmed)) return { url: trimmed, kind: "web" };

  const looksLikeSearch = trimmed.includes(" ") || (!trimmed.includes(".") && !trimmed.includes("/") && !trimmed.includes(":"));
  if (looksLikeSearch) return { url: desktopSearchUrl(trimmed), kind: "search", query: trimmed };
  return { url: `https://${trimmed}`, kind: "web" };
}

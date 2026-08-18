import { TRPCError } from "@trpc/server";
import { isIP } from "node:net";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

type ReaderLink = { title: string; url: string };
type ReaderImage = { src: string; alt: string };
type ReaderVideo = { src: string; title: string; kind: "direct" | "embed" };

const browserInput = z.object({ url: z.string().trim().min(1).max(2048) });
const searchInput = z.object({ query: z.string().trim().min(1).max(240) });

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function textFromHtml(value: string) {
  return decodeEntities(value.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, " ").replace(/\s+/g, " ").trim());
}

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "metadata.google.internal" || isIP(host) !== 0;
}

export function safeBrowserUrl(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "请输入有效的 http 或 https 地址。" });
  }
  if (!/^https?:$/.test(parsed.protocol) || isBlockedHost(parsed.hostname)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "该地址不适合在浏览器兼容模式中访问。" });
  }
  return parsed;
}

export function evaluateEmbedPolicy(xFrameOptions: string | null, contentSecurityPolicy: string | null) {
  const xfo = (xFrameOptions ?? "").toLowerCase();
  if (/\bdeny\b/.test(xfo)) return { canEmbed: false, reason: "该网站通过 X-Frame-Options: DENY 禁止被其他网页嵌入。" };
  if (/\bsameorigin\b/.test(xfo)) return { canEmbed: false, reason: "该网站仅允许在自身域名内嵌入页面。" };
  const frameAncestors = contentSecurityPolicy?.match(/(?:^|;)\s*frame-ancestors\s+([^;]+)/i)?.[1]?.trim();
  if (frameAncestors && !/(?:^|\s)(?:\*|https:)(?:\s|$)/i.test(frameAncestors)) {
    return { canEmbed: false, reason: "该网站的内容安全策略禁止在当前桌面窗口中嵌入。" };
  }
  return { canEmbed: true, reason: "未检测到阻止嵌入的响应头。" };
}

export function detectEmbedConsentGate(html: string) {
  return /(?:site_agreed|安全环境检测|安全确认|(?:src|href)=["'][^"']*(?:guard|verify|security)[^"']*\.(?:js|php))/i.test(html);
}

function absoluteUrl(href: string, baseUrl: string) {
  try {
    const url = new URL(href, baseUrl);
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function extractReaderLinks(html: string, baseUrl: string, maximum = 14) {
  const parsedBase = new URL(baseUrl);
  const candidates: Array<ReaderLink & { score: number; order: number }> = [];
  const seen = new Set<string>();
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  const matches = Array.from(html.matchAll(anchorPattern));
  for (let order = 0; order < matches.length; order += 1) {
    const match = matches[order];
    const attributes = match[1];
    const url = absoluteUrl(decodeEntities(attributeFromTag(attributes, "href")), baseUrl);
    const imageAlt = match[2].match(/<img\b[^>]*\balt\s*=\s*["']([^"']+)["'][^>]*>/i)?.[1] ?? "";
    const title = textFromHtml(match[2]) || textFromHtml(attributeFromTag(attributes, "title")) || textFromHtml(attributeFromTag(attributes, "aria-label")) || textFromHtml(decodeEntities(imageAlt));
    if (!url || !title || seen.has(url) || title.length < 2) continue;
    seen.add(url);
    const parsedUrl = new URL(url);
    const isVideo = /\/(?:video|play)\/(?:BV[a-zA-Z0-9]+|av\d+)|youtu\.be\/|youtube\.com\/watch|vimeo\.com\/\d+/i.test(url);
    const looksLikeUtility = /\b(?:login|register|signup|privacy|terms|cookie|download|about|contact|help|search|setting|profile|account)\b/i.test(`${title} ${parsedUrl.pathname}`);
    const looksLikeMetadata = /^(?:\d+\s+(?:minute|hour|day|month|year)s?\s+ago|\d+\s+comments?|\d+\s+points?|hide)$/i.test(title.trim()) || /\/(?:item|user|hide)(?:\?|$)/i.test(parsedUrl.pathname + parsedUrl.search);
    const looksLikeContent = isVideo || (title.length >= 20 && !looksLikeUtility && !looksLikeMetadata);
    const score = (isVideo ? 100 : 0) + (looksLikeContent ? 50 : 0) + (parsedUrl.hostname === parsedBase.hostname ? 18 : 0) + (title.length >= 12 ? 4 : 0) - (looksLikeUtility ? 18 : 0) - (looksLikeMetadata ? 30 : 0);
    candidates.push({ title: title.slice(0, 140), url, score, order });
  }
  return candidates
    .sort((left, right) => right.score - left.score || left.order - right.order)
    .slice(0, maximum)
    .map(({ title, url }) => ({ title, url }));
}

function attributeFromTag(tag: string, name: string) {
  const expression = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i");
  return tag.match(expression)?.[1] ?? "";
}

export function extractReaderImages(html: string, baseUrl: string, maximum = 20) {
  const images: ReaderImage[] = [];
  const seen = new Set<string>();
  const add = (rawSrc: string, rawAlt = "") => {
    const src = absoluteUrl(decodeEntities(rawSrc), baseUrl);
    if (!src || seen.has(src)) return;
    seen.add(src);
    images.push({ src, alt: textFromHtml(decodeEntities(rawAlt)).slice(0, 120) || "网页图片" });
  };
  for (const match of Array.from(html.matchAll(/<meta\b[^>]*>/gi))) {
    const tag = match[0];
    const property = attributeFromTag(tag, "property").toLowerCase();
    if (property === "og:image" || property === "twitter:image") add(attributeFromTag(tag, "content"));
    if (images.length >= maximum) return images;
  }
  for (const match of Array.from(html.matchAll(/<img\b[^>]*>/gi))) {
    const tag = match[0];
    const src = attributeFromTag(tag, "src");
    const width = Number(attributeFromTag(tag, "width"));
    const height = Number(attributeFromTag(tag, "height"));
    const decorative = /\/static\/images\/|(?:20|25|32|40|50)px-|(?:icon|wordmark|tagline)/i.test(src) || (Number.isFinite(width) && width > 0 && width < 70) || (Number.isFinite(height) && height > 0 && height < 70);
    if (!decorative) add(src, attributeFromTag(tag, "alt"));
    if (images.length >= maximum) break;
  }
  return images;
}

export function extractReaderVideos(html: string, baseUrl: string, maximum = 10) {
  const videos: ReaderVideo[] = [];
  const seen = new Set<string>();
  const add = (rawSrc: string, title: string, kind: ReaderVideo["kind"]) => {
    const src = absoluteUrl(decodeEntities(rawSrc), baseUrl);
    if (!src || seen.has(src)) return;
    seen.add(src);
    videos.push({ src, title: textFromHtml(decodeEntities(title)).slice(0, 120) || "网页视频", kind });
  };
  for (const match of Array.from(html.matchAll(/<meta\b[^>]*>/gi))) {
    const tag = match[0];
    const property = attributeFromTag(tag, "property").toLowerCase() || attributeFromTag(tag, "name").toLowerCase();
    const src = attributeFromTag(tag, "content");
    if (/^(?:og:video(?::url)?|twitter:player:stream)$/i.test(property) && src) {
      add(src, attributeFromTag(tag, "title") || "网页视频", /\.(?:mp4|webm|ogg|ogv|m4v|mov|m3u8)(?:$|[?#])/i.test(src) ? "direct" : "embed");
    }
    if (videos.length >= maximum) return videos;
  }
  for (const match of Array.from(html.matchAll(/<(?:video|source)\b[^>]*>/gi))) {
    const tag = match[0];
    const src = attributeFromTag(tag, "src") || attributeFromTag(tag, "data-src");
    if (/\.(?:mp4|webm|ogg|ogv|m4v|mov|m3u8)(?:$|[?#])/i.test(src)) add(src, attributeFromTag(tag, "title") || attributeFromTag(tag, "aria-label"), "direct");
    if (videos.length >= maximum) return videos;
  }
  for (const match of Array.from(html.matchAll(/<iframe\b[^>]*>/gi))) {
    const tag = match[0];
    const src = attributeFromTag(tag, "src") || attributeFromTag(tag, "data-src");
    if (/(?:youtube(?:-nocookie)?\.com\/(?:embed|watch)|youtu\.be\/|player\.vimeo\.com|player\.bilibili\.com|tiktok\.com\/player\/v1|player\.youku\.com|player\.twitch\.tv|dailymotion\.com\/embed|wistia\.net\/embed|archive\.org\/embed)/i.test(src)) add(src, attributeFromTag(tag, "title") || attributeFromTag(tag, "aria-label"), "embed");
    if (videos.length >= maximum) return videos;
  }
  return videos;
}

export function extractReaderBody(html: string, maximum = 6200) {
  const article = html.match(/<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/i)?.[1]
    ?? html.match(/<(?:div|section)\b[^>]*(?:id|class)=["'][^"']*\b(?:main|content|article|post|entry)\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i)?.[1]
    ?? html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]
    ?? html;
  return textFromHtml(article).slice(0, maximum) || "该网页没有可提取的正文内容。";
}

export function enrichBilibiliVideoTitles(links: ReaderLink[], images: ReaderImage[]) {
  const cardTitles = images.map((image) => image.alt).filter((alt) => alt && alt !== "网页图片");
  let cardIndex = 0;
  return links.map((link) => {
    const isBilibiliVideo = /(?:^|\.)bilibili\.com\/video\/BV[a-zA-Z0-9]+/i.test(link.url);
    const looksLikeMetrics = /^(?:[\d.]+万\s+)?\d+\s+\d{1,2}:\d{2}$/.test(link.title.trim());
    if (!isBilibiliVideo || !looksLikeMetrics) return link;
    const cardTitle = cardTitles[cardIndex];
    cardIndex += 1;
    return cardTitle ? { ...link, title: cardTitle.slice(0, 140) } : link;
  });
}

function titleFromHtml(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? textFromHtml(match[1]).slice(0, 160) : "未命名页面";
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "FreshdeskDesktop/1.0 (+https://manus.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) throw new Error(`网页返回 ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) throw new Error("该链接不是可阅读的网页内容");
    const html = await response.text();
    if (html.length > 5_000_000) throw new Error("网页内容过大，请尝试直连浏览或打开更具体的页面。");
    return { html, finalUrl: response.url };
  } finally {
    clearTimeout(timeout);
  }
}

async function inspectEmbedPolicy(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "FreshdeskDesktop/1.0 (+https://manus.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const policy = evaluateEmbedPolicy(response.headers.get("x-frame-options"), response.headers.get("content-security-policy"));
    const contentType = response.headers.get("content-type") ?? "";
    const html = /text\/html|application\/xhtml\+xml/i.test(contentType) ? await response.text() : "";
    return { ...policy, url: response.url, requiresUserConsent: detectEmbedConsentGate(html) };
  } finally {
    clearTimeout(timeout);
  }
}

function unwrapDuckDuckGo(url: string) {
  try {
    const parsed = new URL(url, "https://html.duckduckgo.com");
    return parsed.hostname.endsWith("duckduckgo.com") ? parsed.searchParams.get("uddg") ?? url : url;
  } catch {
    return url;
  }
}

export const browserRouter = router({
  inspectEmbed: publicProcedure.input(browserInput).query(async ({ input }) => {
    const parsed = safeBrowserUrl(input.url);
    try {
      return await inspectEmbedPolicy(parsed.toString());
    } catch {
      return { canEmbed: true, reason: "暂时无法预检嵌入策略，将继续尝试在当前标签加载。", url: parsed.toString(), requiresUserConsent: false };
    }
  }),
  readPage: publicProcedure.input(browserInput).query(async ({ input }) => {
    const parsed = safeBrowserUrl(input.url);
    try {
      const { html, finalUrl } = await fetchHtml(parsed.toString());
      const images = extractReaderImages(html, finalUrl);
      const videos = extractReaderVideos(html, finalUrl);
      const links = enrichBilibiliVideoTitles(extractReaderLinks(html, finalUrl, 80), images);
      return {
        url: finalUrl,
        title: titleFromHtml(html),
        summary: extractReaderBody(html, 1100),
        body: extractReaderBody(html),
        links,
        images,
        videos,
      };
    } catch (error) {
      throw new TRPCError({ code: "BAD_GATEWAY", message: error instanceof Error ? error.message : "暂时无法读取该网页。" });
    }
  }),
  search: publicProcedure.input(searchInput).query(async ({ input }) => {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(input.query)}`;
    try {
      const { html } = await fetchHtml(searchUrl);
      const results = extractReaderLinks(html, searchUrl, 24)
        .map((item) => ({ ...item, url: unwrapDuckDuckGo(item.url) }))
        .filter((item) => /^https?:\/\//i.test(item.url) && !item.url.includes("duckduckgo.com"))
        .slice(0, 10)
        .map((item) => ({ ...item, snippet: "在当前标签的兼容阅读模式中打开" }));
      return { results };
    } catch (error) {
      throw new TRPCError({ code: "BAD_GATEWAY", message: error instanceof Error ? error.message : "搜索服务暂时不可用。" });
    }
  }),
});

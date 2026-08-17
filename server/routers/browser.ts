import { TRPCError } from "@trpc/server";
import { isIP } from "node:net";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

type ReaderLink = { title: string; url: string };

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

function absoluteUrl(href: string, baseUrl: string) {
  try {
    const url = new URL(href, baseUrl);
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function extractReaderLinks(html: string, baseUrl: string, maximum = 14) {
  const links: ReaderLink[] = [];
  const seen = new Set<string>();
  const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of Array.from(html.matchAll(anchorPattern))) {
    const url = absoluteUrl(decodeEntities(match[1]), baseUrl);
    const title = textFromHtml(match[2]);
    if (!url || !title || seen.has(url) || title.length < 2) continue;
    seen.add(url);
    links.push({ title: title.slice(0, 140), url });
    if (links.length >= maximum) break;
  }
  return links;
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
    if (html.length > 2_000_000) throw new Error("网页内容过大");
    return { html, finalUrl: response.url };
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
  readPage: publicProcedure.input(browserInput).query(async ({ input }) => {
    const parsed = safeBrowserUrl(input.url);
    try {
      const { html, finalUrl } = await fetchHtml(parsed.toString());
      const text = textFromHtml(html);
      return {
        url: finalUrl,
        title: titleFromHtml(html),
        summary: text.slice(0, 1100) || "该网页没有可提取的文本内容。",
        links: extractReaderLinks(html, finalUrl),
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

export type BrowserVideoSource = {
  kind: "direct" | "embed";
  src: string;
  title: string;
  provider: string;
};

const directVideoPattern = /\.(mp4|webm|ogg|ogv|m3u8)(?:$|[?#])/i;

export function resolveBrowserVideo(url: string): BrowserVideoSource | null {
  if (directVideoPattern.test(url)) return { kind: "direct", src: url, title: "公开视频", provider: "公开视频" };
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`, title: "YouTube 视频", provider: "YouTube" } : null;
    }
    if (host.endsWith("youtube.com")) {
      const id = parsed.searchParams.get("v") ?? parsed.pathname.match(/\/(?:shorts|embed)\/([^/?#]+)/)?.[1];
      return id ? { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`, title: "YouTube 视频", provider: "YouTube" } : null;
    }
    if (host.endsWith("bilibili.com")) {
      const id = parsed.pathname.match(/\/video\/(BV[\w-]+|av\d+)/i)?.[1];
      if (!id) return null;
      const parameter = /^av/i.test(id) ? `aid=${id.slice(2)}` : `bvid=${id}`;
      return { kind: "embed", src: `https://player.bilibili.com/player.html?${parameter}&autoplay=1`, title: "Bilibili 视频", provider: "Bilibili" };
    }
    if (host === "vimeo.com" || host.endsWith("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).find((part) => /^\d+$/.test(part));
      return id ? { kind: "embed", src: `https://player.vimeo.com/video/${id}?autoplay=1`, title: "Vimeo 视频", provider: "Vimeo" } : null;
    }
  } catch { /* non-URL values are not videos */ }
  return null;
}

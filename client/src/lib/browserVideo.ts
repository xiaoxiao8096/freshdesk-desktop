export type BrowserVideoSource = {
  kind: "direct" | "hls" | "embed" | "restricted";
  src: string;
  title: string;
  provider: string;
  restriction?: string;
};

const directVideoPattern = /\.(mp4|webm|ogg|ogv|m4v|mov)(?:$|[?#])/i;
const hlsVideoPattern = /\.m3u8(?:$|[?#])/i;

const currentEmbedParent = () => typeof window === "undefined" ? "localhost" : window.location.hostname;

const restrictedHosts: Array<{ hosts: string[]; provider: string; restriction: string }> = [
  { hosts: ["v.qq.com", "video.qq.com"], provider: "腾讯视频", restriction: "腾讯视频的多数内容需要官网登录、会员授权或地区校验，当前标签不能绕过这些限制。" },
  { hosts: ["iqiyi.com"], provider: "爱奇艺", restriction: "爱奇艺内容通常受会员、地区或 DRM 保护，需要在官网网页模式中按站点规则播放。" },
  { hosts: ["youku.com"], provider: "优酷", restriction: "此优酷链接未包含可公开嵌入的视频编号，或内容依赖官网授权、广告或版权控制。" },
  { hosts: ["douyin.com"], provider: "抖音", restriction: "抖音播放页通常需要站点脚本、登录或反嵌入校验，已保留网页模式入口。" },
  { hosts: ["kuaishou.com"], provider: "快手", restriction: "快手播放页可能需要登录、地区校验或站点脚本，已保留网页模式入口。" },
  { hosts: ["netflix.com", "disneyplus.com", "primevideo.com"], provider: "受 DRM 保护的视频服务", restriction: "此服务使用受保护播放与账号授权，浏览器原型不能绕过 DRM、登录或订阅限制。" },
];

function getRestrictedSource(host: string, url: string): BrowserVideoSource | null {
  const match = restrictedHosts.find((item) => item.hosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`)));
  return match ? { kind: "restricted", src: url, title: `${match.provider} 视频`, provider: match.provider, restriction: match.restriction } : null;
}

function getYoukuVideoId(parsed: URL) {
  const pathname = decodeURIComponent(parsed.pathname);
  const pathMatch = pathname.match(/(?:id_|embed\/|sid\/)(X[\w=]+)/i)?.[1];
  const queryId = ["vid", "videoId", "video_id", "id"].map((key) => parsed.searchParams.get(key)).find((value) => /^X[\w=]+$/i.test(value ?? ""));
  return pathMatch ?? queryId ?? null;
}

export function resolveBrowserVideo(url: string): BrowserVideoSource | null {
  if (hlsVideoPattern.test(url)) return { kind: "hls", src: url, title: "HLS 直播/点播", provider: "HLS" };
  if (directVideoPattern.test(url)) return { kind: "direct", src: url, title: "公开视频", provider: "公开视频" };
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (host.endsWith("tiktok.com")) {
      const id = parsed.pathname.match(/\/video\/(\d+)/)?.[1] ?? parsed.pathname.match(/\/player\/v1\/(\d+)/)?.[1];
      return id ? { kind: "embed", src: `https://www.tiktok.com/player/v1/${id}?controls=1&autoplay=1&music_info=1&description=1&closed_caption=1`, title: "TikTok 视频", provider: "TikTok" } : null;
    }
    if (host.endsWith("youku.com")) {
      const id = getYoukuVideoId(parsed);
      if (id) return { kind: "embed", src: `https://player.youku.com/embed/${id}?autoplay=1`, title: "优酷视频", provider: "优酷" };
    }
    if (host.endsWith("rumble.com")) {
      const id = parsed.pathname.match(/\/(v[\w-]+)(?:[./]|$)/i)?.[1] ?? parsed.pathname.match(/\/embed\/([\w-]+)/i)?.[1];
      return id ? { kind: "embed", src: `https://rumble.com/embed/${id}/?autoplay=1`, title: "Rumble 视频", provider: "Rumble" } : null;
    }
    const restricted = getRestrictedSource(host, url);
    if (restricted) return restricted;
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
    if (host === "dai.ly" || host.endsWith("dailymotion.com")) {
      const id = host === "dai.ly" ? parsed.pathname.split("/").filter(Boolean)[0] : parsed.pathname.match(/\/video\/([\w-]+)/)?.[1];
      return id ? { kind: "embed", src: `https://www.dailymotion.com/embed/video/${id}?autoplay=1`, title: "Dailymotion 视频", provider: "Dailymotion" } : null;
    }
    if (host.endsWith("twitch.tv")) {
      const parent = encodeURIComponent(currentEmbedParent());
      if (host === "clips.twitch.tv") {
        const clip = parsed.pathname.split("/").filter(Boolean)[0];
        return clip ? { kind: "embed", src: `https://clips.twitch.tv/embed?clip=${encodeURIComponent(clip)}&parent=${parent}&autoplay=true`, title: "Twitch Clip", provider: "Twitch" } : null;
      }
      const videoId = parsed.pathname.match(/\/videos\/(\d+)/)?.[1];
      const channel = parsed.pathname.split("/").filter(Boolean)[0];
      const parameter = videoId ? `video=v${videoId}` : channel ? `channel=${encodeURIComponent(channel)}` : null;
      return parameter ? { kind: "embed", src: `https://player.twitch.tv/?${parameter}&parent=${parent}&autoplay=true`, title: "Twitch 视频", provider: "Twitch" } : null;
    }
    if (host.endsWith("loom.com")) {
      const id = parsed.pathname.match(/\/(?:share|embed)\/([\w-]+)/)?.[1];
      return id ? { kind: "embed", src: `https://www.loom.com/embed/${id}?autoplay=1`, title: "Loom 视频", provider: "Loom" } : null;
    }
    if (host.endsWith("streamable.com")) {
      const id = parsed.pathname.match(/\/(?:e\/)?([\w-]+)$/)?.[1];
      return id ? { kind: "embed", src: `https://streamable.com/e/${id}?autoplay=1`, title: "Streamable 视频", provider: "Streamable" } : null;
    }
    if (host.endsWith("wistia.com") || host.endsWith("wistia.net")) {
      const id = parsed.pathname.match(/\/(?:medias|embed\/iframe)\/([\w-]+)/)?.[1];
      return id ? { kind: "embed", src: `https://fast.wistia.net/embed/iframe/${id}?autoPlay=true&playbackRateControl=true`, title: "Wistia 视频", provider: "Wistia" } : null;
    }
    if (host.endsWith("facebook.com") && /\/(?:videos|reel)\//.test(parsed.pathname) || host === "fb.watch") {
      return { kind: "embed", src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true`, title: "Facebook 视频", provider: "Facebook" };
    }
    if (host.endsWith("ted.com")) {
      const slug = parsed.pathname.match(/\/talks\/([\w-]+)/)?.[1];
      return slug ? { kind: "embed", src: `https://embed.ted.com/talks/${slug}`, title: "TED 演讲", provider: "TED" } : null;
    }
    if (host.endsWith("archive.org")) {
      const identifier = parsed.pathname.match(/\/details\/([^/?#]+)/)?.[1];
      return identifier ? { kind: "embed", src: `https://archive.org/embed/${identifier}`, title: "Internet Archive 视频", provider: "Internet Archive" } : null;
    }
  } catch { /* non-URL values are not videos */ }
  return null;
}

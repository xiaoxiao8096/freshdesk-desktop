import { describe, expect, it } from "vitest";
import { enrichBilibiliVideoTitles, evaluateEmbedPolicy, extractReaderBody, extractReaderImages, extractReaderLinks, extractReaderVideos, safeBrowserUrl } from "./routers/browser";

describe("browser reader helpers", () => {
  it("rejects local and non-web URLs", () => {
    expect(() => safeBrowserUrl("file:///etc/passwd")).toThrow();
    expect(() => safeBrowserUrl("http://localhost:3000")).toThrow();
    expect(() => safeBrowserUrl("http://127.0.0.1")).toThrow();
  });

  it("identifies X-Frame-Options and CSP policies that forbid iframe embedding", () => {
    expect(evaluateEmbedPolicy("DENY", null)).toMatchObject({ canEmbed: false, reason: expect.stringContaining("DENY") });
    expect(evaluateEmbedPolicy("SAMEORIGIN", null)).toMatchObject({ canEmbed: false, reason: expect.stringContaining("自身域名") });
    expect(evaluateEmbedPolicy(null, "default-src 'self'; frame-ancestors 'none'")).toMatchObject({ canEmbed: false, reason: expect.stringContaining("内容安全策略") });
    expect(evaluateEmbedPolicy(null, "frame-ancestors https:")).toMatchObject({ canEmbed: true });
  });

  it("extracts unique absolute HTTP links from readable markup", () => {
    const html = '<a href="/next">下一页</a><a href="/next">重复</a><a href="https://example.org/a">文章</a>';
    expect(extractReaderLinks(html, "https://example.com/start")).toEqual([
      { title: "下一页", url: "https://example.com/next" },
      { title: "文章", url: "https://example.org/a" },
    ]);
  });

  it("retains a wide, click-ready list of relative and target-blank links for current-tab navigation", () => {
    const html = Array.from({ length: 24 }, (_, index) => `<a href="/story/${index}" target="_blank">新闻条目 ${index}</a>`).join("");
    const links = extractReaderLinks(html, "https://news.example.com/home", 80);
    expect(links).toHaveLength(24);
    expect(links[0]).toEqual({ title: "新闻条目 0", url: "https://news.example.com/story/0" });
    expect(links[23]).toEqual({ title: "新闻条目 23", url: "https://news.example.com/story/23" });
  });

  it("uses accessible and image labels for story cards whose anchor text is otherwise empty", () => {
    const html = '<a href="/video/BV1xx" title="B 站视频标题"><img src="/cover.jpg" alt="封面图"></a><a href="/story/2" aria-label="第二篇报道"></a>';
    expect(extractReaderLinks(html, "https://www.bilibili.com/")).toEqual([
      { title: "B 站视频标题", url: "https://www.bilibili.com/video/BV1xx" },
      { title: "第二篇报道", url: "https://www.bilibili.com/story/2" },
    ]);
  });

  it("prioritizes a later in-site Bilibili video card ahead of utility navigation", () => {
    const html = '<a href="/account/login">登录</a><a href="/about">关于我们</a><a href="/video/BV1ab411c7xY">值得观看的视频</a>';
    expect(extractReaderLinks(html, "https://www.bilibili.com/", 3)[0]).toEqual({ title: "值得观看的视频", url: "https://www.bilibili.com/video/BV1ab411c7xY" });
  });

  it("prioritizes a news headline ahead of timestamps, comments, and user-page metadata", () => {
    const html = '<a href="/item?id=1">10 hours ago</a><a href="/user?id=anna">anna</a><a href="https://example.org/report">A detailed report that readers can continue opening in the current tab</a><a href="/item?id=1">222 comments</a>';
    expect(extractReaderLinks(html, "https://news.example.com/", 4)[0]).toEqual({ title: "A detailed report that readers can continue opening in the current tab", url: "https://example.org/report" });
  });

  it("relabels Bilibili BV links from metrics to their corresponding visible card titles", () => {
    const links = [
      { title: "4.7万 124 06:39", url: "https://www.bilibili.com/video/BV1VGb86mEDg" },
      { title: "119.6万 433 01:24", url: "https://www.bilibili.com/video/BV1Lqby6oE7i" },
      { title: "热门", url: "https://www.bilibili.com/v/popular/all" },
    ];
    const images = [
      { src: "https://i0.hdslb.com/banner.png", alt: "网页图片" },
      { src: "https://i0.hdslb.com/first.jpg", alt: "化刀坞李缨宁拜见前辈！" },
      { src: "https://i0.hdslb.com/second.jpg", alt: "体验91项目喵✨️" },
    ];
    expect(enrichBilibiliVideoTitles(links, images)).toEqual([
      { title: "化刀坞李缨宁拜见前辈！", url: "https://www.bilibili.com/video/BV1VGb86mEDg" },
      { title: "体验91项目喵✨️", url: "https://www.bilibili.com/video/BV1Lqby6oE7i" },
      { title: "热门", url: "https://www.bilibili.com/v/popular/all" },
    ]);
  });

  it("extracts absolute images from social metadata and image markup", () => {
    const html = '<meta property="og:image" content="/cover.jpg"><img src="/cover.jpg" alt="重复"><img src="https://cdn.example.org/photo.png" alt="正文图片">';
    expect(extractReaderImages(html, "https://example.com/article")).toEqual([
      { src: "https://example.com/cover.jpg", alt: "网页图片" },
      { src: "https://cdn.example.org/photo.png", alt: "正文图片" },
    ]);
  });

  it("skips navigation icons and tiny decorative images in article galleries", () => {
    const html = '<img src="/static/images/site-icon.svg" alt="图标"><img src="/thumb/20px-control.png" alt="控件"><img src="/photos/hero.jpg" alt="正文大图">';
    expect(extractReaderImages(html, "https://example.com/article")).toEqual([
      { src: "https://example.com/photos/hero.jpg", alt: "正文大图" },
    ]);
  });

  it("extracts an article body and public direct or official embedded videos for mixed-media reading", () => {
    const html = '<header>站点导航</header><article><h1>图文视频报道</h1><p>正文内容应该保留在同一标签。</p><video title="现场视频" src="/media/report.mp4"></video><iframe title="公开视频" src="https://www.youtube.com/embed/abc123"></iframe></article>';
    expect(extractReaderBody(html)).toContain("正文内容应该保留在同一标签");
    expect(extractReaderVideos(html, "https://news.example.com/story")).toEqual([
      { src: "https://news.example.com/media/report.mp4", title: "现场视频", kind: "direct" },
      { src: "https://www.youtube.com/embed/abc123", title: "公开视频", kind: "embed" },
    ]);
  });

  it("keeps social video metadata and prefers an identified content area over surrounding navigation", () => {
    const html = '<nav>无关导航</nav><section id="article-content"><h1>报道正文</h1><p>这里是更聚焦的正文。</p></section><meta property="og:video" content="/media/preview.m3u8">';
    expect(extractReaderBody(html)).toContain("这里是更聚焦的正文");
    expect(extractReaderVideos(html, "https://example.com/report")).toEqual([
      { src: "https://example.com/media/preview.m3u8", title: "网页视频", kind: "direct" },
    ]);
  });
});

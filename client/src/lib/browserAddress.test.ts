import { describe, expect, it } from "vitest";
import { resolveSafariAddress } from "./browserAddress";

describe("Safari 风格智能搜索栏地址解析", () => {
  it("保留带协议的完整网页地址，供当前 Chromium 标签直接载入", () => {
    expect(resolveSafariAddress("https://example.com/library/article?id=7")).toEqual({
      url: "https://example.com/library/article?id=7",
      kind: "web",
    });
  });

  it("将无协议的域名和路径补全为 HTTPS 网页地址，而不是搜索页", () => {
    expect(resolveSafariAddress("291728.d606h3v.cc/pw/html_data/14/2608/8910618.html")).toEqual({
      url: "https://291728.d606h3v.cc/pw/html_data/14/2608/8910618.html",
      kind: "web",
    });
  });

  it("仅将普通自然语言输入提交为 Bing 搜索", () => {
    expect(resolveSafariAddress("今天的天气")).toEqual({
      url: "https://www.bing.com/search?q=%E4%BB%8A%E5%A4%A9%E7%9A%84%E5%A4%A9%E6%B0%94",
      kind: "search",
      query: "今天的天气",
    });
  });

  it("在地址栏为空时保留当前标签网址而不触发新导航", () => {
    expect(resolveSafariAddress("   ", "https://example.com/current")).toEqual({
      url: "https://example.com/current",
      kind: "empty",
    });
  });
});

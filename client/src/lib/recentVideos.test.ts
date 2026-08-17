import { describe, expect, it } from "vitest";
import { recordRecentVideo } from "./recentVideos";

describe("recent videos", () => {
  it("moves a reopened video to the front without duplication", () => {
    const items = [
      { url: "https://example.com/a", title: "A" },
      { url: "https://example.com/b", title: "B" },
    ];
    expect(recordRecentVideo(items, { url: "https://example.com/a", title: "A（继续观看）" })).toEqual([
      { url: "https://example.com/a", title: "A（继续观看）" },
      { url: "https://example.com/b", title: "B" },
    ]);
  });

  it("keeps the most recent bounded set", () => {
    const items = [{ url: "https://example.com/a" }, { url: "https://example.com/b" }];
    expect(recordRecentVideo(items, { url: "https://example.com/c" }, 2).map((item) => item.url)).toEqual(["https://example.com/c", "https://example.com/a"]);
  });
});

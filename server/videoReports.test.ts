import { describe, expect, it } from "vitest";
import { reportInput } from "./routers/videoReports";

describe("video playback report input", () => {
  it("accepts a bounded public video report", () => {
    expect(reportInput.parse({ url: "https://example.com/video/123", title: "示例视频", provider: "Example", reason: "playback_failed" })).toMatchObject({ provider: "Example" });
  });

  it("rejects non-web report addresses", () => {
    expect(() => reportInput.parse({ url: "file:///private/video.mp4", title: "本地文件", provider: "Local" })).toThrow();
  });
});

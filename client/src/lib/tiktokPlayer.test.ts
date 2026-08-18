import { describe, expect, it, vi } from "vitest";
import { createTikTokPlayerMessage, postTikTokPlayerCommand } from "./tiktokPlayer";

describe("TikTok embedded player controls", () => {
  it("creates the official postMessage payload for playback commands", () => {
    expect(createTikTokPlayerMessage("play")).toEqual({ type: "play", value: undefined, "x-tiktok-player": true });
    expect(createTikTokPlayerMessage("pause")).toEqual({ type: "pause", value: undefined, "x-tiktok-player": true });
    expect(createTikTokPlayerMessage("mute")).toEqual({ type: "mute", value: undefined, "x-tiktok-player": true });
  });

  it("sends playback commands only to TikTok's official origin", () => {
    const postMessage = vi.fn();
    postTikTokPlayerCommand({ postMessage }, "mute");
    expect(postMessage).toHaveBeenCalledWith({ type: "mute", value: undefined, "x-tiktok-player": true }, "https://www.tiktok.com");
  });
});

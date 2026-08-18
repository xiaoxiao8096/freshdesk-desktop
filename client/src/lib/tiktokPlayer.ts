export type TikTokPlayerCommand = "play" | "pause" | "mute";

export function createTikTokPlayerMessage(command: TikTokPlayerCommand) {
  return { type: command, value: undefined, "x-tiktok-player": true };
}

export function postTikTokPlayerCommand(target: Pick<Window, "postMessage">, command: TikTokPlayerCommand) {
  target.postMessage(createTikTokPlayerMessage(command), "https://www.tiktok.com");
}

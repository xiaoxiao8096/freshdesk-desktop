# 官方视频嵌入来源记录

本轮浏览器播放器只使用平台公开的嵌入能力，不尝试绕过登录、DRM、地区、反爬或 `frame-ancestors` 限制。

| 平台 | 当前解析策略 | 官方依据 |
|---|---|---|
| Facebook | 将公开 `/videos/`、`/reel/` 与 `fb.watch` 链接解析为 `plugins/video.php?href=` 播放器地址 | https://developers.facebook.com/docs/plugins/embedded-video-player/ |
| Wistia | 将公开 `/medias/{id}` 或 iframe 地址解析为 `fast.wistia.net/embed/iframe/{id}`；保留平台自身速度、全屏等控件 | https://docs.wistia.com/docs/embed-options-and-plugins |
| Twitch | 保留官方嵌入播放器要求的 `parent` 参数 | https://dev.twitch.tv/docs/embed/video-and-clips/ |

Facebook 官方文档要求视频或直播内容为公开可嵌入的帖子；Wistia 文档说明 iframe 可使用播放器选项，嵌入平台的播放能力仍由其自身策略控制。

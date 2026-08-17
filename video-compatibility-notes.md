# 内置视频兼容性说明

本轮播放器采用分层策略。公开 MP4、WebM、Ogg 与 OGV 文件由原生视频元素播放；公开 `.m3u8` 清单由 `hls.js` 处理，以覆盖 Chromium 默认不直接播放 HLS 的情况。HLS 仍要求媒体源允许浏览器访问，受令牌、CORS、DRM、地区或登录保护的流不能被绕过。

公开嵌入平台覆盖 YouTube、Bilibili、Vimeo、Dailymotion、Twitch、Loom、Streamable、TED 与 Internet Archive。Twitch 嵌入地址会自动带入当前页面的 `parent` 域名；这是其官方播放器的必需参数。[1]

已实际验证 Dailymotion 示例 `https://www.dailymotion.com/video/x7tgad0` 进入当前标签嵌入播放器；公开 HLS 示例 `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8` 被识别为 HLS 播放器且视频元数据加载完成。跨平台视频后退会恢复 Dailymotion 嵌入来源而非错误保留 HLS 播放器。腾讯视频示例会立即显示限制原因及“在当前标签打开官网”和“查看公开页面信息”两个出口，不再处于无限连接状态。

腾讯视频、爱奇艺、优酷、抖音、快手及常见订阅流媒体服务会被标记为受限模式，直接说明其会员、登录、DRM、地区或反嵌入约束，并仅提供同标签网页模式和公开页面信息入口。该界面不会宣称能够规避平台的访问控制。

## 参考资料

[1] [Twitch: Embedding Video and Clips](https://dev.twitch.tv/docs/embed/video-and-clips/)

[2] [Dailymotion: Embed with oEmbed](https://developers.dailymotion.com/docs/embed-with-oembed)

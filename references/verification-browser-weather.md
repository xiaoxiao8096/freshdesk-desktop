# 浏览器与天气验证记录

- Freshdesk 浏览器地址栏输入关键词 `OpenAI` 后，会在当前标签中请求 DuckDuckGo Instant Answer API 并渲染窗口内搜索结果；点击结果可在同一应用窗口打开页面。
- 直接输入 `https://www.baidu.com` 后，宿主页面 URL 保持为 Freshdesk Desktop 预览地址，百度页面出现在浏览器 iframe 中。
- 在内嵌百度输入 `Mac 桌面小组件` 并提交后，百度结果页仍显示在 iframe 内，未跳出桌面应用。
- 天气应用输入 `深圳` 后，通过 Open-Meteo 地理编码和天气接口更新为“深圳 · 中国”的实时温度、体感、湿度、风速和小时预报。
- 从 Finder 拖动 `README.md` 到 Dock 回收站后，文件从虚拟目录移除并出现在回收站；点击“恢复”后文件重新出现。

# Electron `target=_blank` 导航调研记录

## 关键结论

Electron 官方文档说明，带有 `target=_blank` 的链接和 `window.open()` 都属于渲染器创建窗口的路径；主进程可通过 `webContents.setWindowOpenHandler()` 决定允许或拒绝创建。[1]

Electron 官方同时警告，`<webview>` 基于正在大幅变化的 Chromium 架构，其渲染、导航与事件路由稳定性会受影响，并建议优先考虑 WebContentsView 或避免嵌入式内容架构。[2]

公开复现表明，`nativeWindowOpen` 与 `<webview>` 的 `target=_blank` / `new-window` 事件之间存在版本与平台相关的兼容性问题；因此，Freshdesk 不再把任何 webview 事件回调当作已验证前提。[3]

## 最小复现约束

1. 使用项目锁定的 Electron 35.7.5。
2. 分别验证普通 `BrowserWindow`、`WebContentsView` 与 `<webview>`。
3. 对每个容器分别记录：锚点物理鼠标点击、`Page.windowOpen`、`setWindowOpenHandler`、`new-window`、文档捕获监听与实际 URL 是否变化。
4. 只有 URL 确认变为目标地址的路径，才允许集成回主应用。

## 来源

[1] Electron, *Opening windows from the renderer*: https://www.electronjs.org/docs/latest/api/window-open/

[2] Electron, *`<webview>` Tag*: https://www.electronjs.org/docs/latest/api/webview-tag

[3] Stack Overflow, *target=_blank based link in webview in electron.js are not opening when nativeWindowOpen true*: https://stackoverflow.com/questions/69206387/target-blank-based-link-in-webview-in-electron-js-are-not-opening-when-nativewi

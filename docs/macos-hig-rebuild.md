# Freshdesk Desktop macOS HIG 系统重构规格

## 设计目标

Freshdesk Desktop 不试图伪造 macOS 的系统级身份，而是采用 macOS 熟悉的窗口、层级、工具栏和侧边栏交互语法，使用户在多窗口、长时间使用和精细指针操作中获得稳定、可预测的桌面体验。[1]

## 研究结论与落地规则

| HIG 原则 | Freshdesk 落地规则 |
| --- | --- |
| 窗口应适应多任务、移动与缩放，并通过 key / inactive 状态表达输入焦点。[2] | 活动窗口使用清晰的 1px 高亮描边、真实投影与彩色交通灯；非活动窗口降低饱和度、去除强光晕，不遮蔽操作。 |
| 工具栏应包含当前视图标题、导航和搜索；控制项按前导、中央、尾随分组，并限制为少量明确的组。[3] | 标题栏只保留窗口控制和身份；内容工具栏保留最多三个组：导航、上下文标题/搜索、主要动作/更多菜单。 |
| 侧边栏用于顶级区域与集合导航，支持隐藏，层级通常不超过两级。[4] | Finder、Safari、设置使用半透明侧边栏；仅保留“位置/分组”和一层项目，底部不放关键动作。 |
| macOS 长时间多任务偏好少层级、键盘快捷键、个性化与精确输入。[1] | 所有基础窗口继续支持拖拽、缩放、贴边、关闭和焦点；高频操作留有键盘路径与可发现的菜单入口。 |

## 全局设计令牌

| Token | 值 | 用途 |
| --- | --- | --- |
| `--mac-surface` | `rgba(28, 30, 38, .78)` | 标准窗口材料 |
| `--mac-surface-elevated` | `rgba(43, 46, 58, .88)` | 关键窗口与弹出层 |
| `--mac-sidebar` | `rgba(36, 38, 49, .66)` | 导航侧边栏 |
| `--mac-hairline` | `rgba(255, 255, 255, .12)` | 分隔线与边框 |
| `--mac-accent` | `#0a84ff` | 选中态、主要操作与焦点 |
| `--mac-radius-window` | `14px` | 窗口外角 |
| `--mac-radius-control` | `8px` | 输入与段落型控件 |
| `--mac-shadow-key` | `0 28px 75px rgba(0,0,0,.42)` | Key window 投影 |
| `--mac-ease` | `cubic-bezier(.2,.8,.2,1)` | 窗口与面板过渡 |

## 分阶段实施

第一阶段建立全局材料、窗口状态和内容层级，重构菜单栏、Dock 与窗口框架。第二阶段将 Finder、Safari 与设置的工具栏和侧边栏迁移至统一结构。第三阶段对其余应用补充列表、检查器、空状态与键盘快捷键的一致性验证。2026-08-19 的实现将音乐、照片、便笺、日历、提醒事项和终端纳入同一层级：工具栏只承载当前上下文与少量高频操作，侧边栏维持不超过两级的导航，列表使用持续选中态或完成标记，简短输入保留提示与清晰焦点环，终端使用独立的深色内容材料。[5] [6] [7] [8]

第四阶段扩展为多任务与本地内容工作流。Mission Control 以全屏、可键盘操作的窗口缩略图网格呈现现有窗口和用户命名的窗口组；进入总览不修改任何窗口内容，选择后只聚焦对应窗口。窗口交通灯在视觉上保持克制，但每个按钮的实际点击区域至少为 28px，并始终保留焦点指示。为减少长时间使用时的卡顿感，常用按钮只过渡 `transform` 和 `opacity`，窗口移动时不触发昂贵的滤镜或阴影动画。

本地文件能力采用“用户选择、最小授权、可撤销”模型：渲染进程不获取 Node 或任意文件路径读取权限；仅由主进程通过附着到主窗口的原生选择器选取文件或目录，再通过特定的 `contextBridge` 方法返回受控媒体描述符。主进程验证调用方、文件类型和授权范围，并使用临时媒体 URL 提供图片或音频预览；撤销授权后，这些 URL 立即失效。Electron 官方 IPC 指南建议仅暴露最小 API 表面，原生 `showOpenDialog` 支持过滤器与多选，而自定义协议需要在主进程中验证路径以防目录穿越。[9] [10] [11]

## 参考资料

[1] [Apple, Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos)

[2] [Apple, Windows](https://developer.apple.com/design/human-interface-guidelines/windows)

[3] [Apple, Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)

[4] [Apple, Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)

[5] [Apple, Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)

[6] [Apple, Text fields](https://developer.apple.com/design/human-interface-guidelines/text-fields)

[7] [Apple, Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)

[8] [Apple, Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)

[9] [Electron, Inter-Process Communication](https://www.electronjs.org/docs/latest/tutorial/ipc)

[10] [Electron, dialog](https://www.electronjs.org/docs/latest/api/dialog)

[11] [Electron, protocol](https://www.electronjs.org/docs/latest/api/protocol)

# Freshdesk Desktop UI/UX Refresh

## 设计方向

本轮将界面由“泛玻璃化的桌面仿真”收敛为 **Freshdesk Precision Workspace**：以石墨画布、晨雾蓝、云灰内容面和四点状态语言建立原创识别。桌面保留多窗口空间关系，但所有运行、就绪、选中与媒体状态统一以四点节奏提示，不复制特定商业操作系统的控件样式。

| 层级 | 规则 | 落地位置 |
| --- | --- | --- |
| 环境层 | 低饱和壁纸与稀疏网格仅提供深度，不承载文本 | 桌面背景与欢迎遮罩 |
| 导航层 | 菜单栏采用单一细边界，状态信息使用等宽小字 | 菜单栏、系统状态、Dock |
| 工作层 | 关键窗口使用清晰边界和低成本阴影，非关键窗口降饱和 | 窗口框架、标题栏、Mission Control |
| 内容层 | 工具栏按导航、标题、动作分区，侧边栏不超过两级 | Finder、浏览器、设置与媒体应用 |
| 焦点层 | 晨雾蓝只标记一个主操作或当前焦点 | 主按钮、输入焦点、活动导航 |

## 实施依据

窗口应通过主窗口、键窗口与非活动窗口的差异让用户辨认输入目标；工具栏应避免拥挤，并按导航、标题和关键动作分组；侧边栏宜保持在两级层级内。[1][2][3]

## References

[1] [Apple HIG — Windows](https://developer.apple.com/design/human-interface-guidelines/windows)

[2] [Apple HIG — Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)

[3] [Apple HIG — Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)

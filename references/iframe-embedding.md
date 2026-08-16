# iframe 网页嵌入限制说明

浏览器应用使用 `<iframe>` 嵌入外部网站。能否成功显示由目标网站在 HTTP 响应中声明的安全策略决定，而不是由 Freshdesk Desktop 直接控制。

## 关键机制

`X-Frame-Options` 可以告知浏览器是否允许网页在 `frame` 或 `iframe` 中渲染；`DENY` 会阻止任何页面嵌入，`SAMEORIGIN` 只允许同源嵌入。

`Content-Security-Policy: frame-ancestors` 用于指定允许嵌入页面的父页面来源；若父级不符合规则，浏览器会取消加载。目标站点可用此策略抵御点击劫持，因此浏览器应用无法绕过该限制。

## 来源

- [MDN：X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options)
- [MDN：CSP frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)

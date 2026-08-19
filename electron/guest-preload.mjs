/**
 * 仅处理网页自身要求新窗口打开的 http/https 链接。
 * 此预加载脚本不暴露 Node 或 Electron API；contextIsolation 与 sandbox 始终保留。
 */
document.addEventListener("click", (event) => {
  const candidate = event.composedPath().find((node) => node?.nodeType === 1 && node.closest?.("a[href]"));
  const anchor = candidate?.closest?.("a[href]");
  const target = anchor?.getAttribute("target")?.toLowerCase();
  if (!anchor || !target || target === "_self" || !/^https?:/i.test(anchor.href)) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  window.location.assign(anchor.href);
}, true);

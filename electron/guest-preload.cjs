/**
 * 仅在网页自身请求新窗口时，将普通鼠标左键打开的 http/https 链接留在当前 guest。
 * 此脚本不暴露 Node、Electron 或 IPC API；guest 仍保持 sandbox、contextIsolation
 * 与 nodeIntegration=false。下载链接、非网页协议与带修饰键操作不会被接管。
 */
function findTargetAnchor(event) {
  const candidate = event.composedPath().find((node) => node?.nodeType === 1 && typeof node.closest === "function" && node.closest("a[href]"));
  return candidate?.closest?.("a[href]") ?? null;
}

function markHandlerReady() {
  document.documentElement?.setAttribute("data-freshdesk-same-tab-handler", "active");
}

document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = findTargetAnchor(event);
  const target = anchor?.getAttribute("target")?.trim().toLowerCase();
  const url = anchor?.href;
  if (!anchor || !target || target === "_self" || anchor.hasAttribute("download") || !url || !/^https?:/i.test(url)) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  window.location.assign(url);
}, true);

if (document.documentElement) markHandlerReady();
else document.addEventListener("DOMContentLoaded", markHandlerReady, { once: true });

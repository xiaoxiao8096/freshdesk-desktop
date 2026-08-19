function install() {
  if (window.__freshdeskCurrentTabTargetHandler) return;
  window.__freshdeskCurrentTabTargetHandler = true;
  document.documentElement?.setAttribute('data-freshdesk-lab-preload', 'active');
  document.documentElement?.setAttribute('data-freshdesk-same-tab-handler', 'active');
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const candidate = event.composedPath().find((node) => node?.nodeType === 1 && typeof node.closest === 'function' && node.closest('a[href]'));
    const anchor = candidate?.closest?.('a[href]');
    const target = anchor?.getAttribute('target')?.trim().toLowerCase();
    const url = anchor?.href;
    if (!anchor || !target || target === '_self' || anchor.hasAttribute('download') || !url || !/^https?:/i.test(url)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign(url);
  }, true);
}

if (document.documentElement) install();
else document.addEventListener('DOMContentLoaded', install, { once: true });

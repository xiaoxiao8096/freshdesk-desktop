const targets = await fetch("http://127.0.0.1:9224/json/list").then((response) => response.json());
const target = targets.find((item) => item.type === "webview" && /bing\.com\/search/.test(item.url));
if (!target) throw new Error("未找到最小复现实验的 Bing webview 调试目标。");

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let sequence = 0;
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const request = pending.get(message.id);
  if (request) { pending.delete(message.id); request(message); }
});
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, (message) => message.error ? reject(new Error(message.error.message)) : resolve(message.result));
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => (await cdp("Runtime.evaluate", { expression, returnByValue: true })).result.value;

const before = await evaluate(`(() => ({ url: location.href, preload: document.documentElement.getAttribute('data-freshdesk-lab-preload'), handler: document.documentElement.getAttribute('data-freshdesk-same-tab-handler'), link: [...document.querySelectorAll('a[target]')].find((a) => /^https?:/i.test(a.href) && a.target)?.href }))()`);
const clicked = await evaluate(`(() => {
  const link = [...document.querySelectorAll('a[target]')].find((a) => /^https?:/i.test(a.href) && a.target);
  if (!link) return null;
  link.scrollIntoView({ block: 'center' });
  const rect = link.getBoundingClientRect();
  return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2), href: link.href, text: link.innerText };
})()`);
if (!clicked) throw new Error("Bing 页面没有可点击的 target 链接。");
await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: clicked.x, y: clicked.y, button: "left", clickCount: 1 });
await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: clicked.x, y: clicked.y, button: "left", clickCount: 1 });
await new Promise((resolve) => setTimeout(resolve, 1800));
const after = await evaluate("location.href");
console.log(JSON.stringify({ before, clicked, after, changed: after !== before.url }, null, 2));
socket.close();

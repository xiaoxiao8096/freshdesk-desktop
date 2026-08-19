const targets = await fetch("http://127.0.0.1:9224/json/list").then((response) => response.json());
const target = targets.find((item) => item.type === "page" && item.url.startsWith("file:"));
if (!target) throw new Error("未找到最小复现实验主窗口调试目标。");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
const value = await new Promise((resolve, reject) => {
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== 1) return;
    message.error ? reject(new Error(message.error.message)) : resolve(message.result.result.value);
  });
  socket.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: "window.targetBlankLabBridge?.active ?? false", returnByValue: true } }));
});
console.log(JSON.stringify({ bridgeActive: value }, null, 2));
socket.close();

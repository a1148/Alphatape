import http from "node:http";

const port = Number(process.env.PORT || 10000);
const apiPort = Number(process.env.API_PORT || 3848);
const webPort = Number(process.env.WEB_PORT || 3000);

function upstreamPort(url = "/") {
  const path = url.split("?")[0];
  if (path === "/health" || path === "/metrics" || path.startsWith("/api/") || path === "/ws" || path.startsWith("/ws?")) return apiPort;
  return webPort;
}

function proxyRequest(req, res) {
  const dest = upstreamPort(req.url);
  const proxy = http.request(
    {
      hostname: "127.0.0.1",
      port: dest,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (upstream) => {
      res.writeHead(upstream.statusCode || 502, upstream.headers);
      upstream.pipe(res);
    },
  );
  proxy.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" });
    res.end("bad gateway");
  });
  req.pipe(proxy);
}

const server = http.createServer(proxyRequest);

server.on("upgrade", (req, socket, head) => {
  const dest = upstreamPort(req.url);
  const proxy = http.request({
    hostname: "127.0.0.1",
    port: dest,
    path: req.url,
    method: req.method,
    headers: req.headers,
  });
  proxy.on("upgrade", (upstreamRes, upstream, upstreamHead) => {
    const lines = [`HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage || ""}`.trim()];
    for (const [key, value] of Object.entries(upstreamRes.headers)) {
      if (value == null) continue;
      if (Array.isArray(value)) value.forEach((item) => lines.push(`${key}: ${item}`));
      else lines.push(`${key}: ${value}`);
    }
    socket.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (upstreamHead?.length) socket.write(upstreamHead);
    if (head?.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
  });
  proxy.on("error", () => socket.destroy());
  proxy.end();
});

server.listen(port, "0.0.0.0", () => {
  console.log(`alphatape listening on ${port}`);
});

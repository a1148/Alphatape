import client from "prom-client";

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequests = new client.Counter({
  name: "alphatape_http_requests_total",
  help: "HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

export const wsClients = new client.Gauge({
  name: "alphatape_ws_clients",
  help: "Open websocket clients",
  registers: [register],
});

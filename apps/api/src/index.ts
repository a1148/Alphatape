import { buildApp } from "./app";
import { logger } from "./logger";
import { attachWebsocket } from "./ws";

const port = Number(process.env.API_PORT ?? 3848);
const host = process.env.API_HOST ?? "0.0.0.0";

const app = await buildApp();
await app.ready();
attachWebsocket(app.server);
await app.listen({ port, host });
logger.info({ port, host, demoMode: process.env.DATA_MODE ?? "auto" }, "api listening");

import { spawn } from "node:child_process";

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

function wait(host, port) {
  return run(process.execPath, ["scripts/wait.mjs", host, String(port)]);
}

async function waitForHttp(url) {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // process still booting
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is required");
  process.exit(1);
}

const db = new URL(databaseUrl);
await wait(db.hostname, db.port || "5432");

if (process.env.REDIS_URL) {
  try {
    const redis = new URL(process.env.REDIS_URL);
    await wait(redis.hostname, redis.port || "6379");
  } catch (error) {
    console.warn(`Redis is not reachable (${error instanceof Error ? error.message : "error"}). Continuing without it.`);
  }
} else {
  console.warn("REDIS_URL is not set. Cache is disabled and the live tape stays in-process.");
}

await run("npx", ["prisma", "migrate", "deploy", "--schema", "packages/db/prisma/schema.prisma"]);
await run("npx", ["tsx", "packages/db/src/seed.ts"]);

const apiPort = process.env.API_PORT || "3848";
const webPort = process.env.WEB_PORT || "3000";
const api = spawn("npx", ["tsx", "apps/api/src/index.ts"], {
  stdio: "inherit",
  env: {
    ...process.env,
    EMBED_WORKER: "1",
    API_HOST: "127.0.0.1",
    API_PORT: apiPort,
    PORT: apiPort,
  },
});
const web = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", webPort], {
  stdio: "inherit",
  cwd: "apps/web",
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: webPort,
  },
});

function stop() {
  api.kill("SIGTERM");
  web.kill("SIGTERM");
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
api.on("exit", (code) => {
  console.error(`api exited ${code}`);
  web.kill("SIGTERM");
  process.exit(code ?? 1);
});
web.on("exit", (code) => {
  console.error(`web exited ${code}`);
  api.kill("SIGTERM");
  process.exit(code ?? 1);
});

await waitForHttp(`http://127.0.0.1:${apiPort}/health`);
await waitForHttp(`http://127.0.0.1:${webPort}/`);
await import("./render-proxy.mjs");

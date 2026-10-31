import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";

// Local Postgres for the Render image when DATABASE_URL is unset.
// PGlite was measured at about 500 MB RSS before the app starts, which does not
// fit a 512 MB instance together with Next.js and the API. This server uses the
// same SQL and Prisma migrations, with data in a local directory.

function pgBin(name) {
  const versions = readdirSync("/usr/lib/postgresql").sort();
  const latest = versions.at(-1);
  if (!latest) throw new Error("PostgreSQL is not installed in this image");
  return `/usr/lib/postgresql/${latest}/bin/${name}`;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

function runUser(args) {
  return run("runuser", ["-u", "postgres", "--", ...args]);
}

function capture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "inherit"] });
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.on("exit", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(`${command} exited ${code}`));
    });
  });
}

export async function startEmbeddedPostgres() {
  const dataDir = process.env.PGDATA || "/tmp/alphatape-pg";
  const port = process.env.EMBEDDED_PG_PORT || "5432";
  const user = "alphatape";
  const initdb = pgBin("initdb");
  const pgCtl = pgBin("pg_ctl");
  const psql = pgBin("psql");
  const createdb = pgBin("createdb");

  if (!existsSync(`${dataDir}/PG_VERSION`)) {
    await rm(dataDir, { recursive: true, force: true });
    await mkdir(dataDir, { recursive: true });
    await run("chown", ["postgres:postgres", dataDir]);
    await runUser([
      initdb,
      "-D",
      dataDir,
      "--username",
      user,
      "--auth-local=trust",
      "--auth-host=trust",
      "--locale=C",
      "--encoding=UTF8",
      "--no-instructions",
    ]);
  }

  const options = [
    `-c listen_addresses=127.0.0.1`,
    `-c port=${port}`,
    `-c unix_socket_directories=/tmp`,
    `-c shared_buffers=16MB`,
    `-c max_connections=30`,
    `-c work_mem=1MB`,
    `-c maintenance_work_mem=8MB`,
    `-c effective_cache_size=32MB`,
    `-c fsync=off`,
    `-c synchronous_commit=off`,
    `-c full_page_writes=off`,
  ].join(" ");

  await runUser([pgCtl, "-D", dataDir, "-w", "-l", "/tmp/alphatape-pg.log", "-o", options, "start"]);

  const exists = await capture("runuser", [
    "-u",
    "postgres",
    "--",
    psql,
    "-h",
    "127.0.0.1",
    "-p",
    port,
    "-U",
    user,
    "-d",
    "postgres",
    "-tAc",
    "SELECT 1 FROM pg_database WHERE datname='alphatape'",
  ]);
  if (exists !== "1") {
    await runUser([createdb, "-h", "127.0.0.1", "-p", port, "-U", user, "alphatape"]);
  }

  const url = `postgresql://${user}@127.0.0.1:${port}/alphatape?sslmode=disable&connection_limit=5`;
  console.log(`Embedded Postgres listening on 127.0.0.1:${port}, data ${dataDir}`);
  return {
    url,
    dataDir,
    async stop() {
      await runUser([pgCtl, "-D", dataDir, "-m", "fast", "-w", "stop"]).catch(() => {});
    },
  };
}

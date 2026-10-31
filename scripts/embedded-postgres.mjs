import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { appendFile, chmod, mkdir, rm } from "node:fs/promises";

// Local Postgres when DATABASE_URL is unset.
// PGlite was measured at about 500 MB RSS before the app starts, which does not
// fit a 512 MB instance together with Next.js and the API. This server uses the
// same SQL and Prisma migrations, with data in a local directory.
//
// Render starts the container as root and drops to the postgres OS user.
// Hugging Face Spaces start it as uid 1000, so initdb and pg_ctl run as that
// user and the data directory stays under /tmp (or $PGDATA). No root-only paths.

function pgBin(name) {
  const versions = readdirSync("/usr/lib/postgresql").sort();
  const latest = versions.at(-1);
  if (!latest) throw new Error("PostgreSQL is not installed in this image");
  return `/usr/lib/postgresql/${latest}/bin/${name}`;
}

function currentUid() {
  return typeof process.getuid === "function" ? process.getuid() : 0;
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

function asClusterOwner(args) {
  if (currentUid() === 0) return run("runuser", ["-u", "postgres", "--", ...args]);
  return run(args[0], args.slice(1));
}

function captureAsClusterOwner(args) {
  if (currentUid() === 0) return capture("runuser", ["-u", "postgres", "--", ...args]);
  return capture(args[0], args.slice(1));
}

export async function startEmbeddedPostgres() {
  const dataDir = process.env.PGDATA || "/tmp/alphatape-pg";
  const port = process.env.EMBEDDED_PG_PORT || "5432";
  const user = "alphatape";
  const initdb = pgBin("initdb");
  const pgCtl = pgBin("pg_ctl");
  const psql = pgBin("psql");
  const createdb = pgBin("createdb");
  const uid = currentUid();
  console.log(`Embedded Postgres starting as uid ${uid}, data ${dataDir}`);

  if (!existsSync(`${dataDir}/PG_VERSION`)) {
    await rm(dataDir, { recursive: true, force: true });
    await mkdir(dataDir, { recursive: true });
    await chmod(dataDir, 0o700);
    if (uid === 0) await run("chown", ["postgres:postgres", dataDir]);
    await asClusterOwner([
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
    // Debian's initdb defaults the socket directory to /var/run/postgresql, which uid 1000 cannot use.
    await appendFile(
      `${dataDir}/postgresql.conf`,
      "\nlisten_addresses = '127.0.0.1'\nunix_socket_directories = '/tmp'\nshared_memory_type = mmap\n",
    );
  }

  const options = [
    `-c listen_addresses=127.0.0.1`,
    `-c port=${port}`,
    `-c unix_socket_directories=/tmp`,
    `-c shared_memory_type=mmap`,
    `-c shared_buffers=16MB`,
    `-c max_connections=30`,
    `-c work_mem=1MB`,
    `-c maintenance_work_mem=8MB`,
    `-c effective_cache_size=32MB`,
    `-c fsync=off`,
    `-c synchronous_commit=off`,
    `-c full_page_writes=off`,
  ].join(" ");

  await asClusterOwner([pgCtl, "-D", dataDir, "-w", "-l", "/tmp/alphatape-pg.log", "-o", options, "start"]);

  const exists = await captureAsClusterOwner([
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
    await asClusterOwner([createdb, "-h", "127.0.0.1", "-p", port, "-U", user, "alphatape"]);
  }

  const url = `postgresql://${user}@127.0.0.1:${port}/alphatape?sslmode=disable&connection_limit=5`;
  console.log(`Embedded Postgres listening on 127.0.0.1:${port}, data ${dataDir}`);
  return {
    url,
    dataDir,
    async stop() {
      await asClusterOwner([pgCtl, "-D", dataDir, "-m", "fast", "-w", "stop"]).catch(() => {});
    },
  };
}

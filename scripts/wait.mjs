const host = process.argv[2];
const port = Number(process.argv[3]);
const net = await import("node:net");

function tryOnce() {
  return new Promise((resolve) => {
    const socket = net.connect(port, host, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
}

for (let i = 0; i < 60; i++) {
  if (await tryOnce()) process.exit(0);
  await new Promise((resolve) => setTimeout(resolve, 500));
}
console.error(`Timed out waiting for ${host}:${port}`);
process.exit(1);

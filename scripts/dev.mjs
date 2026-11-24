import { spawnSync, spawn } from "node:child_process";
const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const port = portIndex >= 0 ? args[portIndex + 1] : process.env.PORT || "8000";
const sync = spawnSync(process.execPath, ["scripts/fetch-content.mjs"], {
  stdio: "inherit",
});
if (sync.status !== 0) process.exit(sync.status || 1);
const child = spawn(
  "npm",
  [
    "run",
    "dev",
    "-w",
    "web",
    "--",
    "--hostname",
    "127.0.0.1",
    "--port",
    port,
  ],
  { stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code || 0));

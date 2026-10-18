// Keep builds on the real app origin: there is no Vite development server.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const children = [];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
for (const workspace of ["apps/portal", "apps/player"]) {
  if (!existsSync(`${root}${workspace}/package.json`)) continue;
  const child = spawn(
    "npm",
    ["run", "build", "--workspace", workspace, "--", "--watch"],
    { cwd: root, stdio: "inherit" },
  );
  children.push(child);
  child.on("error", () => stop(1));
  child.on("exit", (code) => {
    if (!stopping) stop(code ?? 1);
  });
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const candidates = process.platform === "win32" ? [["py", ["-3"]], ["python", []]] : [["python3", []], ["python", []]];
for (const [command, prefix] of candidates) {
  const result = spawnSync(command, [...prefix, "-B", "tools/verify_pcg_fixture.py"], { cwd: root, stdio: "inherit" });
  if (result.error?.code === "ENOENT") continue;
  process.exit(result.status ?? 1);
}
console.error("Python 3 was not found. Set up Python before running the PCG fixture check.");
process.exit(1);

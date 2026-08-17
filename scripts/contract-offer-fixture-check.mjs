import { spawnSync } from "node:child_process";

const candidates = process.platform === "win32" ? [["py", ["-3"]], ["python", []]] : [["python3", []], ["python", []]];
for (const [command, prefix] of candidates) {
  const result = spawnSync(command, [...prefix, "-B", "tools/verify_contract_offer_fixture.py"], { cwd: process.cwd(), stdio: "inherit" });
  if (result.error?.code === "ENOENT") continue;
  process.exit(result.status ?? 1);
}

console.error("Python 3 was not found. Set up Python before running this check.");
process.exit(1);

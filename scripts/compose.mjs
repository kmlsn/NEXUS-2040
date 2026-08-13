import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const args = ["compose"];
if (existsSync(".env")) args.push("--env-file", ".env");
args.push("-f", "infra/docker-compose.yml", ...process.argv.slice(2));
const result = spawnSync("docker", args, { stdio: "inherit" });
process.exit(result.status ?? 1);

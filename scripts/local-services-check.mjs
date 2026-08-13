import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const composeFile = resolve(root, "infra", "docker-compose.yml");
const envExample = resolve(root, ".env.example");
const configOnly = process.argv.includes("--config-only");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} ${args.join(" ")} failed.${detail ? `\n${detail}` : ""}`);
  }
  return result.stdout;
}

if (!existsSync(composeFile) || !existsSync(envExample)) {
  throw new Error("P1.3 requires infra/docker-compose.yml and .env.example.");
}

const compose = readFileSync(composeFile, "utf8");
const env = readFileSync(envExample, "utf8");
for (const requiredSnippet of [
  "postgres:17.7-alpine",
  "redis:7.4.3-alpine",
  "postgres-data",
  "redis-data",
  "127.0.0.1:",
  "healthcheck:",
  'restart: "no"',
]) {
  if (!compose.includes(requiredSnippet)) throw new Error(`Compose contract is missing ${requiredSnippet}.`);
}
for (const requiredVariable of ["POSTGRES_USER=", "POSTGRES_PASSWORD=", "POSTGRES_DB=", "DATABASE_URL=", "REDIS_URL="]) {
  if (!env.includes(requiredVariable)) throw new Error(`.env.example is missing ${requiredVariable}.`);
}
if (env.match(/prod|production|password=.*(real|secret)/i)) {
  throw new Error(".env.example must contain only synthetic local development values.");
}

run("docker", ["compose", "-f", "infra/docker-compose.yml", "config"]);
if (configOnly) {
  console.log("PASS: local PostgreSQL/Redis Compose configuration is valid and uses synthetic example settings.");
  process.exit(0);
}

run("docker", ["compose", "-f", "infra/docker-compose.yml", "exec", "-T", "postgres", "sh", "-ec", 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"']);
const redisOutput = run("docker", ["compose", "-f", "infra/docker-compose.yml", "exec", "-T", "redis", "redis-cli", "ping"]);
if (redisOutput.trim() !== "PONG") throw new Error(`Redis health check returned ${JSON.stringify(redisOutput.trim())}.`);

console.log("PASS: local PostgreSQL and Redis containers are healthy.");

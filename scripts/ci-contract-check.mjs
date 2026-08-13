import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workflow = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
for (const required of [
  "pull_request:", "workflow_dispatch:", "contents: read", "persist-credentials: false",
  "node-version: 24.14.0", "version: 11.16.0", "pnpm install --frozen-lockfile",
  "lint:", "pnpm lint", "typecheck:", "pnpm typecheck", "unit:", "pnpm test",
  "integration:", "pnpm services:up", "pnpm test:integration", "pnpm services:logs", "pnpm services:down",
]) {
  if (!workflow.includes(required)) throw new Error(`CI workflow is missing required contract: ${required}`);
}
console.log("PASS: CI workflow requires lint, typecheck, unit, and integration gates.");

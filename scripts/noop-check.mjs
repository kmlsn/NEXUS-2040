import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const checkName = process.argv[2];
const workspaceRoots = ["apps", "packages"];

if (!checkName) {
  console.error("A check name is required.");
  process.exit(1);
}

const registeredPackages = workspaceRoots.flatMap((workspaceRoot) => {
  const directory = resolve(root, workspaceRoot);
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(directory, entry.name, "package.json")))
    .map((entry) => `${workspaceRoot}/${entry.name}`);
});

if (registeredPackages.length > 0) {
  console.error(
    `[${checkName}] Workspace packages exist (${registeredPackages.join(", ")}). ` +
      "Wire this command to the real suite before it can pass.",
  );
  process.exit(1);
}

console.log(`[${checkName}] PASS: no workspace package exists yet; this Phase 1.1 check is an explicit no-op.`);

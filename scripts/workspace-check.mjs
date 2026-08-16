import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packages = {
  "apps/web": { name: "@nexus/web", dependencies: ["@nexus/contracts", "@nexus/ui", "react", "react-dom"] },
  "apps/api": { name: "@nexus/api", dependencies: ["@nestjs/common", "@nestjs/core", "@nexus/content", "@nexus/contracts", "@nexus/simulation", "reflect-metadata", "rxjs"] },
  "apps/worker": { name: "@nexus/worker", dependencies: ["@nexus/contracts", "@nexus/simulation", "pg"] },
  "packages/contracts": { name: "@nexus/contracts", dependencies: [] },
  "packages/simulation": { name: "@nexus/simulation", dependencies: ["@nexus/contracts"] },
  "packages/content": { name: "@nexus/content", dependencies: ["@nexus/contracts"] },
  "packages/ui": { name: "@nexus/ui", dependencies: [] },
};

const failures = [];
for (const [relativePath, expectation] of Object.entries(packages)) {
  const directory = resolve(root, relativePath);
  const manifestPath = resolve(directory, "package.json");
  const sourcePath = resolve(directory, "src", "index.ts");
  if (!existsSync(manifestPath) || !existsSync(resolve(directory, "tsconfig.json")) || !existsSync(sourcePath)) {
    failures.push(`${relativePath} is missing a manifest, tsconfig, or source entrypoint.`);
    continue;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.name !== expectation.name || manifest.type !== "module" || manifest.scripts?.typecheck !== "tsc -p tsconfig.json") {
    failures.push(`${relativePath} does not satisfy the package contract.`);
  }

  const dependencies = manifest.dependencies ?? {};
  for (const dependency of expectation.dependencies) {
    if (!(dependency in dependencies)) {
      failures.push(`${relativePath} is missing required dependency ${dependency}.`);
    }
  }

  const nexusDependencies = Object.keys(dependencies).filter((name) => name.startsWith("@nexus/"));
  const allowedNexusDependencies = expectation.dependencies.filter((name) => name.startsWith("@nexus/"));
  if (nexusDependencies.some((name) => !allowedNexusDependencies.includes(name))) {
    failures.push(`${relativePath} has an invalid internal dependency direction.`);
  }
}

for (const forbiddenPath of ["apps/api/prisma", "apps/worker/queues"]) {
  if (existsSync(resolve(root, forbiddenPath))) {
    failures.push(`${forbiddenPath} belongs to a later phase and must not exist in P1.2.`);
  }
}

if (failures.length > 0) {
  console.error("P1.2 workspace contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PASS: P1.2 workspace contract verified for ${Object.keys(packages).length} packages.`);

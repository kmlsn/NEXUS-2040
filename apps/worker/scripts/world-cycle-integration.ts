import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FixedClock } from "@nexus/contracts";
import { WORLD_CYCLE_MS } from "@nexus/simulation";
import { Client, Pool } from "pg";
import { WorldCycleService } from "../src/world-cycle-service";

const adminUrl = process.env.DATABASE_URL ?? "postgresql://nexus_local:nexus_local_password@127.0.0.1:15432/postgres";
const testDb = `nexus_world_cycle_${randomUUID().replaceAll("-", "")}`;
const testUrl = adminUrl.replace(/\/[^/]+(?:\?.*)?$/, `/${testDb}`);
const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const epoch = 1_767_225_600_000n;

async function runApiMigrations(): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(process.execPath, [resolve(root, "apps/api/node_modules/tsx/dist/cli.mjs"), resolve(root, "apps/api/src/migrations/cli.ts"), "up"], {
      cwd: root,
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: "pipe",
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`Migration CLI failed with exit ${code ?? "unknown"}: ${stderr}`)));
  });
}

async function readState(client: Client): Promise<{ completed_cycles: string; state_revision: string }> {
  const result = await client.query<{ completed_cycles: string; state_revision: string }>("SELECT completed_cycles, state_revision FROM world_state WHERE id = 1");
  const row = result.rows[0];
  if (!row) throw new Error("World state row is missing.");
  return row;
}

const admin = new Client({ connectionString: adminUrl });
await admin.connect();
await admin.query(`CREATE DATABASE ${testDb}`);
await admin.end();

try {
  await runApiMigrations();
  const control = new Client({ connectionString: testUrl });
  await control.connect();
  const target = epoch + WORLD_CYCLE_MS * 5n + 1n;
  const rollbackPool = new Pool({ connectionString: testUrl });
  const rollbackService = new WorldCycleService(rollbackPool, new FixedClock(Number(target)));
  const rollbackClient = await rollbackPool.connect();
  try {
    await rollbackClient.query("BEGIN");
    assert.equal((await rollbackService.advanceInTransaction(rollbackClient, target)).advancedCycles, 5n);
    await rollbackClient.query("ROLLBACK");
  } finally {
    rollbackClient.release();
  }
  assert.deepEqual(await readState(control), { completed_cycles: "0", state_revision: "1" });
  await rollbackPool.end();
  const firstPool = new Pool({ connectionString: testUrl });
  const secondPool = new Pool({ connectionString: testUrl });
  const first = new WorldCycleService(firstPool, new FixedClock(Number(target)));
  const second = new WorldCycleService(secondPool, new FixedClock(Number(target)));
  try {
    const concurrent = await Promise.all([first.advanceNow(), second.advanceNow()]);
    assert.deepEqual(concurrent.map((outcome) => outcome.advancedCycles).sort((a, b) => Number(a - b)), [0n, 5n]);
  } finally {
    await firstPool.end();
    await secondPool.end();
  }
  assert.deepEqual(await readState(control), { completed_cycles: "5", state_revision: "6" });

  const restartPool = new Pool({ connectionString: testUrl });
  const restart = new WorldCycleService(restartPool, new FixedClock(Number(target)));
  assert.equal((await restart.advanceNow()).advancedCycles, 0n);
  assert.equal((await restart.advanceTo(target - WORLD_CYCLE_MS)).advancedCycles, 0n);
  await restartPool.end();
  await control.end();
  console.log("PASS: world cycle migration, concurrent worker, restart, rollback, and backward-clock behavior verified.");
} finally {
  const cleanup = new Client({ connectionString: adminUrl });
  await cleanup.connect();
  await cleanup.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [testDb]);
  await cleanup.query(`DROP DATABASE IF EXISTS ${testDb}`);
  await cleanup.end();
}

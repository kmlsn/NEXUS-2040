import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const migrationDirectory = join(dirname(fileURLToPath(import.meta.url)), "sql");
const lockKey = 2040001;

interface Migration {
  version: string;
  upSql: string;
  downSql: string;
  checksum: string;
}

async function loadMigrations(): Promise<Migration[]> {
  const files = await readdir(migrationDirectory);
  const versions = files.filter((file) => file.endsWith(".up.sql")).map((file) => file.slice(0, -7)).sort();
  return Promise.all(versions.map(async (version) => {
    const [upSql, downSql] = await Promise.all([
      readFile(join(migrationDirectory, `${version}.up.sql`), "utf8"),
      readFile(join(migrationDirectory, `${version}.down.sql`), "utf8"),
    ]);
    return { version, upSql, downSql, checksum: createHash("sha256").update(upSql).digest("hex") };
  }));
}

async function withLock<T>(databaseUrl: string, work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [lockKey]);
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
    return await work(client);
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [lockKey]).catch(() => undefined);
    await client.end();
  }
}

export async function applyMigrations(databaseUrl: string): Promise<string[]> {
  return withLock(databaseUrl, async (client) => {
    const migrations = await loadMigrations();
    const applied = new Map((await client.query<{ version: string; checksum: string }>("SELECT version, checksum FROM schema_migrations")).rows.map((row) => [row.version, row.checksum]));
    const availableVersions = new Set(migrations.map((migration) => migration.version));
    for (const appliedVersion of applied.keys()) {
      if (!availableVersions.has(appliedVersion)) throw new Error(`Applied migration file is missing: ${appliedVersion}`);
    }
    const appliedNow: string[] = [];
    for (const migration of migrations) {
      const knownChecksum = applied.get(migration.version);
      if (knownChecksum) {
        if (knownChecksum !== migration.checksum) throw new Error(`Migration checksum drift: ${migration.version}`);
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(migration.upSql);
        await client.query("INSERT INTO schema_migrations(version, checksum) VALUES($1, $2)", [migration.version, migration.checksum]);
        await client.query("COMMIT");
        appliedNow.push(migration.version);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    return appliedNow;
  });
}

export async function rollbackLatestMigration(databaseUrl: string): Promise<string | null> {
  return withLock(databaseUrl, async (client) => {
    const latest = (await client.query<{ version: string }>("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1")).rows[0];
    if (!latest) return null;
    const migration = (await loadMigrations()).find((item) => item.version === latest.version);
    if (!migration) throw new Error(`Migration file is missing for ${latest.version}`);
    await client.query("BEGIN");
    try {
      await client.query(migration.downSql);
      await client.query("DELETE FROM schema_migrations WHERE version = $1", [migration.version]);
      await client.query("COMMIT");
      return migration.version;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

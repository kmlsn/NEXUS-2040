import { applyMigrations, rollbackLatestMigration } from "./runner";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://nexus_local:nexus_local_password@127.0.0.1:15432/nexus_local";
const command = process.argv[2] ?? "up";

if (command === "up") console.log(`Applied: ${(await applyMigrations(databaseUrl)).join(", ") || "none"}`);
else if (command === "down") console.log(`Rolled back: ${(await rollbackLatestMigration(databaseUrl)) ?? "none"}`);
else throw new Error("Use 'up' or 'down'.");

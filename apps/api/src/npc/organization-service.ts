import type { Pool, PoolClient } from "pg";

type Queryable = Pick<PoolClient, "query">;

/** Creates the three neutral relationship rows from server-owned NPC state; no client value is authoritative. */
export async function ensureProfileNpcRelationshipsInTransaction(client: Queryable, profileId: string): Promise<void> {
  const result = await client.query(
    "INSERT INTO profile_npc_relationships(profile_id, organization_id) SELECT profiles.id, npc_organization_state.organization_id FROM profiles CROSS JOIN npc_organization_state WHERE profiles.id = $1 ON CONFLICT DO NOTHING",
    [profileId],
  );
  if (result.rowCount === 0) {
    const profile = await client.query("SELECT id FROM profiles WHERE id = $1", [profileId]);
    if (profile.rowCount === 0) throw new Error("Profile does not exist.");
  }
}

export async function ensureProfileNpcRelationships(pool: Pool, profileId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureProfileNpcRelationshipsInTransaction(client, profileId);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

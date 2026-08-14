import { randomUUID } from "node:crypto";
import { facilityLevel, type FacilityKind } from "@nexus/content";
import type { Clock } from "@nexus/contracts";
import type { Pool, PoolClient } from "pg";
import { LazyAccrualService } from "./accrual-service";
import { PostgresLedgerService } from "../ledger/ledger-service";

type QueueStatus = "active" | "completed" | "cancelled";
interface QueueRow {
  id: string; profile_id: string; facility_id: string | null; facility_kind: FacilityKind; target_level: number; status: QueueStatus;
  finish_ms: string; capital_cost_micro: string; components_cost_micro: string; cost_transaction_id: string; refund_transaction_id: string | null;
}
export interface FacilityQueueItem {
  readonly id: string; readonly facilityId?: string; readonly facilityKind: FacilityKind; readonly targetLevel: number;
  readonly status: QueueStatus; readonly finishAtMs: bigint; readonly costTransactionId: string; readonly refundTransactionId?: string;
}

export class QueueAlreadyActiveError extends Error {}
export class QueueNotCancellableError extends Error {}
export class InvalidFacilityUpgradeError extends Error {}

function toItem(row: QueueRow): FacilityQueueItem {
  return { id: row.id, ...(row.facility_id ? { facilityId: row.facility_id } : {}), facilityKind: row.facility_kind, targetLevel: row.target_level, status: row.status, finishAtMs: BigInt(row.finish_ms), costTransactionId: row.cost_transaction_id, ...(row.refund_transaction_id ? { refundTransactionId: row.refund_transaction_id } : {}) };
}
function serverNow(clock: Clock): bigint {
  const now = clock.nowMs();
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Server clock returned an invalid time.");
  return BigInt(now);
}

/** Durable, server-authoritative facility construction lane. It intentionally has no client or worker API. */
export class FacilityQueueService {
  private readonly ledger: PostgresLedgerService;
  private readonly accrual: LazyAccrualService;
  constructor(private readonly pool: Pool, private readonly clock: Clock = { nowMs: () => Date.now() }) {
    this.ledger = new PostgresLedgerService(pool);
    this.accrual = new LazyAccrualService(pool);
  }

  async enqueue(profileId: string, facilityKind: FacilityKind, idempotencyKey: string): Promise<FacilityQueueItem> {
    const now = serverNow(this.clock);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await client.query<{ content_version: string; formula_version: string }>("SELECT content_version, formula_version FROM profiles WHERE id = $1 FOR UPDATE", [profileId]);
      if (profile.rowCount !== 1) throw new Error("Profile does not exist.");
      const replay = await client.query<QueueRow>("SELECT q.id, q.profile_id, q.facility_id, q.facility_kind, q.target_level, q.status, (extract(epoch FROM q.finish_at) * 1000)::bigint::text AS finish_ms, q.capital_cost_micro::text, q.components_cost_micro::text, q.cost_transaction_id, q.refund_transaction_id FROM idempotency_requests r JOIN facility_queue_items q ON q.cost_transaction_id = r.completed_transaction_id WHERE r.profile_id = $1 AND r.scope = 'facility:enqueue' AND r.idempotency_key = $2 FOR UPDATE", [profileId, idempotencyKey]);
      if (replay.rowCount === 1) {
        if (replay.rows[0]!.facility_kind !== facilityKind) throw new InvalidFacilityUpgradeError("Idempotency key was already used for another facility.");
        await client.query("COMMIT");
        return toItem(replay.rows[0]!);
      }
      await this.completeDueInTransaction(client, profileId, now);
      const active = await client.query<QueueRow>("SELECT id, profile_id, facility_id, facility_kind, target_level, status, (extract(epoch FROM finish_at) * 1000)::bigint::text AS finish_ms, capital_cost_micro::text, components_cost_micro::text, cost_transaction_id, refund_transaction_id FROM facility_queue_items WHERE profile_id = $1 AND status = 'active' FOR UPDATE", [profileId]);
      if (active.rowCount === 1) throw new QueueAlreadyActiveError("A facility construction is already active.");
      await this.accrual.settleInTransaction(client, profileId, now);
      const facility = await client.query<{ id: string; level: number }>("SELECT id, level FROM profile_facilities WHERE profile_id = $1 AND facility_kind = $2 FOR UPDATE", [profileId, facilityKind]);
      const currentLevel = facility.rows[0]?.level;
      if (currentLevel === 12) throw new InvalidFacilityUpgradeError("Facility is already at maximum level.");
      const targetLevel = currentLevel === undefined ? 1 : currentLevel + 1;
      const definition = facilityLevel(facilityKind, targetLevel);
      const durationMs = BigInt(definition.upgradeTimeTenthsMinutes) * 6_000n;
      const finishAt = now + durationMs;
      const debit = await this.ledger.applyInTransaction(client, {
        profileId, scope: "facility:enqueue", idempotencyKey, reason: "facility_cost",
        deltas: { capital: `-${definition.upgradeCapitalMicro}`, components: `-${definition.upgradeComponentsMicro}` },
      });
      const existing = await client.query<QueueRow>("SELECT id, profile_id, facility_id, facility_kind, target_level, status, (extract(epoch FROM finish_at) * 1000)::bigint::text AS finish_ms, capital_cost_micro::text, components_cost_micro::text, cost_transaction_id, refund_transaction_id FROM facility_queue_items WHERE cost_transaction_id = $1 FOR UPDATE", [debit.transactionId]);
      if (existing.rowCount === 1) { await client.query("COMMIT"); return toItem(existing.rows[0]!); }
      const id = randomUUID();
      const row = await client.query<QueueRow>(
        "INSERT INTO facility_queue_items(id, profile_id, facility_id, facility_kind, target_level, status, enqueued_at, finish_at, capital_cost_micro, components_cost_micro, duration_ms, content_version, formula_version, cost_transaction_id) VALUES($1,$2,$3,$4,$5,'active',to_timestamp($6::double precision/1000),to_timestamp($7::double precision/1000),$8,$9,$10,$11,$12,$13) RETURNING id, profile_id, facility_id, facility_kind, target_level, status, (extract(epoch FROM finish_at) * 1000)::bigint::text AS finish_ms, capital_cost_micro::text, components_cost_micro::text, cost_transaction_id, refund_transaction_id",
        [id, profileId, facility.rows[0]?.id ?? null, facilityKind, targetLevel, now.toString(), finishAt.toString(), definition.upgradeCapitalMicro, definition.upgradeComponentsMicro, durationMs.toString(), profile.rows[0]!.content_version, profile.rows[0]!.formula_version, debit.transactionId],
      );
      await client.query("COMMIT");
      return toItem(row.rows[0]!);
    } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
    finally { client.release(); }
  }

  async cancel(profileId: string, queueId: string, idempotencyKey: string): Promise<FacilityQueueItem> {
    const now = serverNow(this.clock);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await client.query("SELECT id FROM profiles WHERE id = $1 FOR UPDATE", [profileId]);
      if (profile.rowCount !== 1) throw new Error("Profile does not exist.");
      const result = await client.query<QueueRow>("SELECT id, profile_id, facility_id, facility_kind, target_level, status, (extract(epoch FROM finish_at) * 1000)::bigint::text AS finish_ms, capital_cost_micro::text, components_cost_micro::text, cost_transaction_id, refund_transaction_id FROM facility_queue_items WHERE id = $1 AND profile_id = $2 FOR UPDATE", [queueId, profileId]);
      const queue = result.rows[0];
      if (!queue) throw new QueueNotCancellableError("Queue item does not exist.");
      if (queue.status === "cancelled") { await client.query("COMMIT"); return toItem(queue); }
      if (queue.status === "completed") { await client.query("COMMIT"); return toItem(queue); }
      if (now >= BigInt(queue.finish_ms)) {
        const completedAtBoundary = await this.completeDueInTransaction(client, profileId, now);
        if (!completedAtBoundary || completedAtBoundary.id !== queueId) throw new Error("Due queue did not complete deterministically.");
        await client.query("COMMIT");
        return completedAtBoundary;
      }
      if (queue.status !== "active") throw new QueueNotCancellableError("Queue item is not active.");
      await this.accrual.settleInTransaction(client, profileId, now);
      const refund = await this.ledger.applyInTransaction(client, {
        profileId, scope: "facility:cancel", idempotencyKey, reason: "facility_refund",
        deltas: { capital: queue.capital_cost_micro, components: queue.components_cost_micro },
      });
      const updated = await client.query<QueueRow>("UPDATE facility_queue_items SET status = 'cancelled', cancelled_at = to_timestamp($2::double precision/1000), refund_transaction_id = $3 WHERE id = $1 AND status = 'active' RETURNING id, profile_id, facility_id, facility_kind, target_level, status, (extract(epoch FROM finish_at) * 1000)::bigint::text AS finish_ms, capital_cost_micro::text, components_cost_micro::text, cost_transaction_id, refund_transaction_id", [queueId, now.toString(), refund.transactionId]);
      if (updated.rowCount !== 1) throw new QueueNotCancellableError("Queue item became terminal.");
      await client.query("COMMIT");
      return toItem(updated.rows[0]!);
    } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
    finally { client.release(); }
  }

  async reconcile(profileId: string): Promise<FacilityQueueItem | undefined> {
    const now = serverNow(this.clock);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await client.query("SELECT id FROM profiles WHERE id = $1 FOR UPDATE", [profileId]);
      if (profile.rowCount !== 1) throw new Error("Profile does not exist.");
      const completed = await this.completeDueInTransaction(client, profileId, now);
      if (!completed) await this.accrual.settleInTransaction(client, profileId, now);
      await client.query("COMMIT");
      return completed;
    } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
    finally { client.release(); }
  }

  private async completeDueInTransaction(client: PoolClient, profileId: string, now: bigint): Promise<FacilityQueueItem | undefined> {
    const result = await client.query<QueueRow>("SELECT id, profile_id, facility_id, facility_kind, target_level, status, (extract(epoch FROM finish_at) * 1000)::bigint::text AS finish_ms, capital_cost_micro::text, components_cost_micro::text, cost_transaction_id, refund_transaction_id FROM facility_queue_items WHERE profile_id = $1 AND status = 'active' FOR UPDATE", [profileId]);
    const queue = result.rows[0];
    if (!queue || now < BigInt(queue.finish_ms)) return undefined;
    const finishAt = BigInt(queue.finish_ms);
    await this.accrual.settleInTransaction(client, profileId, finishAt);
    const facilityId = queue.facility_id ?? randomUUID();
    if (queue.facility_id) {
      const facility = await client.query("UPDATE profile_facilities SET level = $4, updated_at = now() WHERE id = $1 AND profile_id = $2 AND facility_kind = $3 AND level = $5 RETURNING id", [facilityId, profileId, queue.facility_kind, queue.target_level, queue.target_level - 1]);
      if (facility.rowCount !== 1) throw new Error("Queued facility binding or prior level no longer matches.");
    }
    else {
      await client.query("INSERT INTO profile_facilities(id, profile_id, facility_kind, level) VALUES($1,$2,$3,$4)", [facilityId, profileId, queue.facility_kind, queue.target_level]);
      await client.query("INSERT INTO profile_facility_accrual_state(facility_id, last_accrued_at) VALUES($1,to_timestamp($2::double precision/1000))", [facilityId, finishAt.toString()]);
    }
    const updated = await client.query<QueueRow>("UPDATE facility_queue_items SET status = 'completed', completed_at = to_timestamp($2::double precision/1000), facility_id = $3 WHERE id = $1 AND status = 'active' RETURNING id, profile_id, facility_id, facility_kind, target_level, status, (extract(epoch FROM finish_at) * 1000)::bigint::text AS finish_ms, capital_cost_micro::text, components_cost_micro::text, cost_transaction_id, refund_transaction_id", [queue.id, finishAt.toString(), facilityId]);
    if (updated.rowCount !== 1) throw new Error("Queue completion was not applied.");
    await this.accrual.settleInTransaction(client, profileId, now);
    return toItem(updated.rows[0]!);
  }
}

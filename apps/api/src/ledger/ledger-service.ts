import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { assertPostgresBigInt, parseMicroUnits } from "./micro-units";

export const RESOURCE_KINDS = ["energy", "compute", "components", "capital", "expertise"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];
export const LEDGER_REASONS = ["system_grant", "facility_cost", "facility_refund", "accrual_output", "accrual_settlement", "operation_cost", "operation_reward", "system_reversal", "contract_collateral_hold", "contract_collateral_refund"] as const;
export type LedgerReason = (typeof LEDGER_REASONS)[number];
export type ResourceDeltas = Partial<Record<ResourceKind, string>>;

export interface LedgerCommand {
  profileId: string;
  scope: string;
  idempotencyKey: string;
  reason: LedgerReason;
  deltas: ResourceDeltas;
}

export interface LedgerOutcome {
  transactionId: string;
  replayed: boolean;
  balances: Record<ResourceKind, string>;
}

export class InsufficientResourcesError extends Error {}
export class IdempotencyKeyReusedError extends Error {}
export class ProfileNotFoundError extends Error {}

const scopePattern = /^[a-z][a-z0-9_.:-]{0,79}$/;

function canonicalDeltas(deltas: ResourceDeltas): Array<[ResourceKind, bigint]> {
  const entries = RESOURCE_KINDS.flatMap((resource) => {
    const value = deltas[resource];
    return value === undefined ? [] : [[resource, parseMicroUnits(value)] as [ResourceKind, bigint]];
  });
  if (entries.length === 0) throw new Error("Ledger command requires at least one non-zero resource delta.");
  return entries;
}

function validateReason(reason: LedgerReason, deltas: Array<[ResourceKind, bigint]>): void {
  if (!(LEDGER_REASONS as readonly string[]).includes(reason)) throw new Error("Ledger reason is not allowed.");
  const hasPositive = deltas.some(([, amount]) => amount > 0n);
  const hasNegative = deltas.some(([, amount]) => amount < 0n);
  if (reason === "system_reversal") return;
  if (reason === "accrual_settlement") return;
  if (["system_grant", "facility_refund", "accrual_output", "operation_reward", "contract_collateral_refund"].includes(reason) && (!hasPositive || hasNegative)) throw new Error("Ledger source reasons require positive deltas only.");
  if (["facility_cost", "operation_cost", "contract_collateral_hold"].includes(reason) && (!hasNegative || hasPositive)) throw new Error("Ledger cost reasons require negative deltas only.");
}

function fingerprint(command: LedgerCommand, deltas: Array<[ResourceKind, bigint]>): string {
  const material = JSON.stringify({ profileId: command.profileId, scope: command.scope, reason: command.reason, deltas: deltas.map(([resource, amount]) => [resource, amount.toString()]) });
  return createHash("sha256").update(material).digest("hex");
}

async function readBalances(client: PoolClient, profileId: string): Promise<Record<ResourceKind, string>> {
  const rows = await client.query<{ resource: ResourceKind; balance_micro: string }>("SELECT resource, balance_micro FROM resource_balances WHERE profile_id = $1 ORDER BY resource", [profileId]);
  if (rows.rowCount !== RESOURCE_KINDS.length) throw new Error("Resource balance projection is incomplete.");
  return Object.fromEntries(rows.rows.map((row) => [row.resource, row.balance_micro])) as Record<ResourceKind, string>;
}

export class PostgresLedgerService {
  constructor(private readonly pool: Pool) {}

  async apply(command: LedgerCommand): Promise<LedgerOutcome> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const outcome = await this.applyInTransaction(client, command);
      await client.query("COMMIT");
      return outcome;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /** Applies an idempotent ledger intent inside the caller's already-open transaction. */
  async applyInTransaction(client: PoolClient, command: LedgerCommand): Promise<LedgerOutcome> {
    if (!scopePattern.test(command.scope) || command.idempotencyKey.length < 1 || command.idempotencyKey.length > 160) throw new Error("Ledger command metadata is invalid.");
    const deltas = canonicalDeltas(command.deltas);
    validateReason(command.reason, deltas);
    const requestFingerprint = fingerprint(command, deltas);
    const profile = await client.query("SELECT id FROM profiles WHERE id = $1 FOR UPDATE", [command.profileId]);
      if (profile.rowCount !== 1) throw new ProfileNotFoundError("Profile does not exist.");
      await client.query("INSERT INTO resource_balances(profile_id, resource, balance_micro) SELECT $1, unnest(enum_range(NULL::resource_kind)), 0 ON CONFLICT DO NOTHING", [command.profileId]);
      await client.query("SELECT resource FROM resource_balances WHERE profile_id = $1 ORDER BY resource FOR UPDATE", [command.profileId]);
      const existing = await client.query<{ request_fingerprint: string; completed_transaction_id: string | null; status: string }>("SELECT request_fingerprint, completed_transaction_id, status FROM idempotency_requests WHERE profile_id = $1 AND scope = $2 AND idempotency_key = $3 FOR UPDATE", [command.profileId, command.scope, command.idempotencyKey]);
      if (existing.rowCount === 1) {
        const row = existing.rows[0];
        if (!row || row.request_fingerprint !== requestFingerprint) throw new IdempotencyKeyReusedError("Idempotency key was already used for another command.");
        if (row.status !== "completed" || !row.completed_transaction_id) throw new Error("Idempotency request is not recoverable.");
        const balances = await readBalances(client, command.profileId);
        return { transactionId: row.completed_transaction_id, replayed: true, balances };
      }
      const requestId = randomUUID();
      await client.query("INSERT INTO idempotency_requests(id, profile_id, scope, idempotency_key, request_fingerprint, status) VALUES($1,$2,$3,$4,$5,'pending')", [requestId, command.profileId, command.scope, command.idempotencyKey, requestFingerprint]);
      const balances = await readBalances(client, command.profileId);
      const nextBalances = new Map(RESOURCE_KINDS.map((resource) => [resource, BigInt(balances[resource])]));
      for (const [resource, amount] of deltas) {
        const next = assertPostgresBigInt((nextBalances.get(resource) ?? 0n) + amount);
        if (next < 0n) throw new InsufficientResourcesError(`Insufficient ${resource}.`);
        nextBalances.set(resource, next);
      }
      const transactionId = randomUUID();
      await client.query("INSERT INTO ledger_transactions(id, profile_id, idempotency_request_id, reason_code) VALUES($1,$2,$3,$4)", [transactionId, command.profileId, requestId, command.reason]);
      for (const [resource, amount] of deltas) {
        await client.query("INSERT INTO resource_ledger_entries(transaction_id, profile_id, resource, amount_micro, reason_code) VALUES($1,$2,$3,$4,$5)", [transactionId, command.profileId, resource, amount.toString(), command.reason]);
        await client.query("UPDATE resource_balances SET balance_micro = $3, updated_at = now() WHERE profile_id = $1 AND resource = $2", [command.profileId, resource, nextBalances.get(resource)?.toString()]);
      }
      await client.query("UPDATE idempotency_requests SET status = 'completed', completed_transaction_id = $2 WHERE id = $1", [requestId, transactionId]);
      const outcomeBalances = Object.fromEntries(RESOURCE_KINDS.map((resource) => [resource, nextBalances.get(resource)?.toString()])) as Record<ResourceKind, string>;
    return { transactionId, replayed: false, balances: outcomeBalances };
  }
}

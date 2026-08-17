import { randomUUID } from "node:crypto";
import { collateralMicro, collateralRefundMicro, fairValueMicro, resolveContractOffer, roundHalfAway, type ContractOfferResolution } from "@nexus/simulation";
import type { Pool, PoolClient } from "pg";
import { PostgresLedgerService } from "../ledger/ledger-service";
import { ensureProfileNpcRelationshipsInTransaction } from "../npc/organization-service";

const COUNTERPARTY_ID = "nexilune_industrial";
const BASE_REWARD_MICRO = 1_000_000_000n;
const TIER = 1;

export class ContractNotFoundError extends Error {}
export class CollateralTooLowError extends Error {}
export class OfferBidMismatchError extends Error {}
export class ContractUnavailableError extends Error {}

export interface MarketContractSnapshot {
  readonly id: string;
  readonly fairValueMicro: string;
  readonly marketIndexBasisPoints: number;
  readonly formulaVersion: string;
  readonly contentVersion: string;
  readonly worldRevision: string;
}

export interface MarketOfferOutcome extends ContractOfferResolution {
  readonly id: string;
  readonly contractId: string;
  readonly heldMicro: string;
  readonly refundMicro: string;
  readonly holdTransactionId: string;
  readonly refundTransactionId: string;
  readonly replayed: boolean;
}

interface ContractRow {
  id: string;
  content_version: string;
  formula_version: string;
  world_revision: string;
  market_index_basis_points: number;
  master_seed: string;
  base_reward_micro: string;
  fair_value_micro: string;
}

interface OfferRow {
  id: string;
  contract_id: string;
  bid_micro: string;
  preparedness_score: string;
  reputation_score: string;
  urgency_fit_score: string;
  price_score: string;
  player_score: string;
  best_npc_score: string;
  held_micro: string;
  stream_id: string;
  threshold: string;
  draw: string;
  status: "awarded" | "lost";
  hold_transaction_id: string;
  refund_transaction_id: string;
}

function toOutcome(row: OfferRow, replayed: boolean): MarketOfferOutcome {
  const threshold = Number(row.threshold);
  const draw = Number(row.draw);
  return {
    id: row.id,
    contractId: row.contract_id,
    playerScore: Number(row.player_score),
    priceScore: Number(row.price_score),
    probability: threshold / 2 ** 32,
    threshold,
    draw,
    awarded: row.status === "awarded",
    heldMicro: row.held_micro,
    refundMicro: row.status === "awarded" ? row.held_micro : collateralRefundMicro(BigInt(row.held_micro), "lost").toString(),
    holdTransactionId: row.hold_transaction_id,
    refundTransactionId: row.refund_transaction_id,
    replayed,
  };
}

export class MarketContractService {
  private readonly ledger: PostgresLedgerService;
  constructor(private readonly pool: Pool) { this.ledger = new PostgresLedgerService(pool); }

  async createSnapshot(): Promise<MarketContractSnapshot> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const world = await client.query<{ content_version: string; formula_version: string; state_revision: string; master_seed: string }>("SELECT content_version, formula_version, state_revision, master_seed FROM world_state WHERE id = 1 FOR UPDATE");
      const market = await client.query<{ market_index_basis_points: number }>("SELECT market_index_basis_points FROM npc_market_state WHERE world_state_id = 1 FOR UPDATE");
      if (world.rowCount !== 1 || market.rowCount !== 1) throw new Error("World market state is incomplete.");
      const worldRow = world.rows[0]!;
      const marketRow = market.rows[0]!;
      const id = randomUUID();
      const fairValue = fairValueMicro(BASE_REWARD_MICRO, BigInt(marketRow.market_index_basis_points));
      await client.query(
        "INSERT INTO market_contract_snapshots(id, world_state_id, counterparty_organization_id, content_version, formula_version, world_revision, market_index_basis_points, master_seed, tier, base_reward_micro, fair_value_micro) VALUES($1,1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [id, COUNTERPARTY_ID, worldRow.content_version, worldRow.formula_version, worldRow.state_revision, marketRow.market_index_basis_points, worldRow.master_seed, TIER, BASE_REWARD_MICRO.toString(), fairValue.toString()],
      );
      await client.query("COMMIT");
      return { id, fairValueMicro: fairValue.toString(), marketIndexBasisPoints: marketRow.market_index_basis_points, formulaVersion: worldRow.formula_version, contentVersion: worldRow.content_version, worldRevision: worldRow.state_revision };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  async submitOffer(profileId: string, contractId: string, bidMicro: string, idempotencyKey: string): Promise<MarketOfferOutcome> {
    if (!/^[1-9][0-9]*$/.test(bidMicro)) throw new Error("Bid must be a canonical positive micro-unit integer.");
    const bid = BigInt(bidMicro);
    if (bid <= 0n) throw new Error("Bid must be a canonical positive micro-unit integer.");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const outcome = await this.submitOfferInTransaction(client, profileId, contractId, bid, idempotencyKey);
      await client.query("COMMIT");
      return outcome;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  private async submitOfferInTransaction(client: PoolClient, profileId: string, contractId: string, bid: bigint, idempotencyKey: string): Promise<MarketOfferOutcome> {
    const profile = await client.query("SELECT id FROM profiles WHERE id = $1 FOR UPDATE", [profileId]);
    if (profile.rowCount !== 1) throw new Error("Profile does not exist.");
    const existing = await client.query<OfferRow>("SELECT * FROM market_contract_offers WHERE contract_id = $1 AND profile_id = $2 FOR UPDATE", [contractId, profileId]);
    if (existing.rowCount === 1) {
      const row = existing.rows[0]!;
      if (row.bid_micro !== bid.toString()) throw new OfferBidMismatchError("Profile already submitted another bid for this contract.");
      return toOutcome(row, true);
    }
    const contract = await client.query<ContractRow>("SELECT * FROM market_contract_snapshots WHERE id = $1 FOR UPDATE", [contractId]);
    if (contract.rowCount !== 1) throw new ContractNotFoundError("Market contract snapshot does not exist.");
    const contractRow = contract.rows[0]!;
    const alreadySettled = await client.query("SELECT id FROM market_contract_offers WHERE contract_id = $1", [contractId]);
    if (alreadySettled.rowCount !== 0) throw new ContractUnavailableError("Market contract already has a terminal offer.");
    await ensureProfileNpcRelationshipsInTransaction(client, profileId);
    await client.query("INSERT INTO resource_balances(profile_id, resource, balance_micro) VALUES($1, 'capital', 0) ON CONFLICT DO NOTHING", [profileId]);
    const facility = await client.query<{ total_levels: string }>("SELECT COALESCE(SUM(level), 0)::text AS total_levels FROM profile_facilities WHERE profile_id = $1", [profileId]);
    const relationship = await client.query<{ relationship_tenths: number }>("SELECT relationship_tenths FROM profile_npc_relationships WHERE profile_id = $1 AND organization_id = $2 FOR UPDATE", [profileId, COUNTERPARTY_ID]);
    const npc = await client.query<{ capacity_readiness: number }>("SELECT capacity_readiness FROM npc_organization_state WHERE organization_id = $1 FOR UPDATE", [COUNTERPARTY_ID]);
    const capital = await client.query<{ balance_micro: string }>("SELECT balance_micro FROM resource_balances WHERE profile_id = $1 AND resource = 'capital' FOR UPDATE", [profileId]);
    if (relationship.rowCount !== 1 || npc.rowCount !== 1 || capital.rowCount !== 1) throw new Error("Contract offer state is incomplete.");
    const preparedness = roundHalfAway(Math.max(0, Math.min(100, 100 * Number(facility.rows[0]!.total_levels) / 60)));
    const reputation = roundHalfAway(Math.max(0, Math.min(100, (relationship.rows[0]!.relationship_tenths + 1000) / 20)));
    const urgencyFit = roundHalfAway(Math.max(0, Math.min(100, (contractRow.market_index_basis_points - 8500) / 30)));
    const bestNpcScore = roundHalfAway((75 + npc.rows[0]!.capacity_readiness) / 2);
    const held = collateralMicro(BigInt(contractRow.base_reward_micro), TIER, BigInt(capital.rows[0]!.balance_micro));
    if (held < 4n) throw new CollateralTooLowError("Collateral must retain at least one micro-unit on a lost offer.");
    const offerId = randomUUID();
    const streamId = `contract:${contractId}:offer:${profileId}:award`;
    const resolution = resolveContractOffer(contractRow.formula_version, contractRow.content_version, BigInt(contractRow.master_seed), streamId, { preparedness, reputation, urgencyFit, bestNpcScore }, bid, BigInt(contractRow.fair_value_micro));
    const hold = await this.ledger.applyInTransaction(client, { profileId, scope: `contract-offer:${contractId}`, idempotencyKey, reason: "contract_collateral_hold", deltas: { capital: (-held).toString() } });
    const refund = collateralRefundMicro(held, resolution.awarded ? "awarded" : "lost");
    const refundResult = await this.ledger.applyInTransaction(client, { profileId, scope: "contract-refund", idempotencyKey: `settlement:${offerId}`, reason: "contract_collateral_refund", deltas: { capital: refund.toString() } });
    const status = resolution.awarded ? "awarded" : "lost";
    await client.query(
      "INSERT INTO market_contract_offers(id, contract_id, profile_id, bid_micro, preparedness_score, reputation_score, urgency_fit_score, price_score, player_score, best_npc_score, held_micro, stream_id, threshold, draw, status, hold_transaction_id, refund_transaction_id, terminal_event_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)",
      [offerId, contractId, profileId, bid.toString(), preparedness, reputation, urgencyFit, resolution.priceScore, resolution.playerScore, bestNpcScore, held.toString(), streamId, resolution.threshold, resolution.draw, status, hold.transactionId, refundResult.transactionId, randomUUID()],
    );
    return { ...resolution, id: offerId, contractId, heldMicro: held.toString(), refundMicro: refund.toString(), holdTransactionId: hold.transactionId, refundTransactionId: refundResult.transactionId, replayed: false };
  }
}

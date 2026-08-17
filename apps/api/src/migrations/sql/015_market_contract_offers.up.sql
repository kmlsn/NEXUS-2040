ALTER TABLE ledger_transactions
  DROP CONSTRAINT ledger_transactions_reason_code_check,
  ADD CONSTRAINT ledger_transactions_reason_code_check
    CHECK (reason_code IN ('system_grant', 'facility_cost', 'facility_refund', 'accrual_output', 'accrual_settlement', 'operation_cost', 'operation_reward', 'system_reversal', 'contract_collateral_hold', 'contract_collateral_refund'));

ALTER TABLE resource_ledger_entries
  DROP CONSTRAINT resource_ledger_entries_reason_code_check,
  ADD CONSTRAINT resource_ledger_entries_reason_code_check
    CHECK (reason_code IN ('system_grant', 'facility_cost', 'facility_refund', 'accrual_output', 'accrual_settlement', 'operation_cost', 'operation_reward', 'system_reversal', 'contract_collateral_hold', 'contract_collateral_refund'));

CREATE TABLE market_contract_snapshots (
  id uuid PRIMARY KEY,
  world_state_id smallint NOT NULL REFERENCES world_state(id) CHECK (world_state_id = 1),
  counterparty_organization_id text NOT NULL REFERENCES npc_organization_state(organization_id) CHECK (counterparty_organization_id = 'nexilune_industrial'),
  content_version text NOT NULL,
  formula_version text NOT NULL,
  world_revision bigint NOT NULL CHECK (world_revision >= 1),
  market_index_basis_points smallint NOT NULL CHECK (market_index_basis_points BETWEEN 8500 AND 11500),
  master_seed numeric(20, 0) NOT NULL CHECK (master_seed >= 0 AND master_seed <= 18446744073709551615),
  tier smallint NOT NULL CHECK (tier = 1),
  base_reward_micro bigint NOT NULL CHECK (base_reward_micro = 1000000000),
  fair_value_micro bigint NOT NULL CHECK (fair_value_micro > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (content_version, formula_version) REFERENCES content_versions(version, formula_version)
);

CREATE FUNCTION market_contract_snapshot_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE world_content text;
DECLARE world_formula text;
DECLARE world_seed numeric(20, 0);
DECLARE world_revision bigint;
DECLARE current_market smallint;
BEGIN
  SELECT content_version, formula_version, master_seed, state_revision
    INTO world_content, world_formula, world_seed, world_revision
    FROM world_state WHERE id = NEW.world_state_id;
  SELECT market_index_basis_points INTO current_market FROM npc_market_state WHERE world_state_id = NEW.world_state_id;
  IF NOT FOUND OR NEW.content_version <> world_content OR NEW.formula_version <> world_formula
    OR NEW.master_seed <> world_seed OR NEW.world_revision <> world_revision
    OR NEW.market_index_basis_points <> current_market
    OR NEW.fair_value_micro <> (NEW.base_reward_micro * NEW.market_index_basis_points * 2 + 10000) / 20000 THEN
    RAISE EXCEPTION 'Market contract snapshot must match locked world and market state';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER market_contract_snapshot_guard_trigger
  BEFORE INSERT OR UPDATE ON market_contract_snapshots
  FOR EACH ROW EXECUTE FUNCTION market_contract_snapshot_guard();

CREATE FUNCTION reject_market_contract_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Market contract snapshots are immutable';
END $$;

CREATE TRIGGER market_contract_snapshot_immutable
  BEFORE UPDATE OR DELETE ON market_contract_snapshots
  FOR EACH ROW EXECUTE FUNCTION reject_market_contract_snapshot_mutation();

CREATE TABLE market_contract_offers (
  id uuid PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES market_contract_snapshots(id),
  profile_id uuid NOT NULL REFERENCES profiles(id),
  bid_micro bigint NOT NULL CHECK (bid_micro > 0),
  preparedness_score numeric(5, 2) NOT NULL CHECK (preparedness_score BETWEEN 0 AND 100),
  reputation_score numeric(5, 2) NOT NULL CHECK (reputation_score BETWEEN 0 AND 100),
  urgency_fit_score numeric(5, 2) NOT NULL CHECK (urgency_fit_score BETWEEN 0 AND 100),
  price_score numeric(12, 9) NOT NULL CHECK (price_score BETWEEN 0 AND 100),
  player_score numeric(20, 12) NOT NULL CHECK (player_score BETWEEN 0 AND 100),
  best_npc_score numeric(5, 2) NOT NULL CHECK (best_npc_score BETWEEN 0 AND 100),
  held_micro bigint NOT NULL CHECK (held_micro >= 4),
  stream_id text NOT NULL CHECK (length(stream_id) BETWEEN 1 AND 200),
  threshold bigint NOT NULL CHECK (threshold BETWEEN 0 AND 4294967296),
  draw bigint NOT NULL CHECK (draw BETWEEN 0 AND 4294967295),
  status text NOT NULL CHECK (status IN ('awarded', 'lost')),
  hold_transaction_id uuid NOT NULL,
  refund_transaction_id uuid NOT NULL,
  terminal_event_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id),
  UNIQUE (contract_id, profile_id),
  UNIQUE (hold_transaction_id),
  UNIQUE (refund_transaction_id),
  FOREIGN KEY (hold_transaction_id, profile_id) REFERENCES ledger_transactions(id, profile_id),
  FOREIGN KEY (refund_transaction_id, profile_id) REFERENCES ledger_transactions(id, profile_id)
);

CREATE FUNCTION market_contract_offer_ledger_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE hold_reason text;
DECLARE refund_reason text;
DECLARE hold_amount bigint;
DECLARE refund_amount bigint;
DECLARE expected_refund bigint;
BEGIN
  SELECT reason_code INTO hold_reason FROM ledger_transactions WHERE id = NEW.hold_transaction_id AND profile_id = NEW.profile_id;
  SELECT reason_code INTO refund_reason FROM ledger_transactions WHERE id = NEW.refund_transaction_id AND profile_id = NEW.profile_id;
  SELECT amount_micro INTO hold_amount FROM resource_ledger_entries WHERE transaction_id = NEW.hold_transaction_id AND profile_id = NEW.profile_id AND resource = 'capital';
  SELECT amount_micro INTO refund_amount FROM resource_ledger_entries WHERE transaction_id = NEW.refund_transaction_id AND profile_id = NEW.profile_id AND resource = 'capital';
  expected_refund := CASE WHEN NEW.status = 'awarded' THEN NEW.held_micro ELSE (NEW.held_micro * 75 + 50) / 100 END;
  IF hold_reason <> 'contract_collateral_hold' OR refund_reason <> 'contract_collateral_refund'
    OR hold_amount <> -NEW.held_micro OR refund_amount <> expected_refund THEN
    RAISE EXCEPTION 'Market offer collateral must use contract hold/refund ledger reasons';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER market_contract_offer_ledger_guard_trigger
  BEFORE INSERT OR UPDATE ON market_contract_offers
  FOR EACH ROW EXECUTE FUNCTION market_contract_offer_ledger_guard();

CREATE TRIGGER market_contract_offer_immutable
  BEFORE UPDATE OR DELETE ON market_contract_offers
  FOR EACH ROW EXECUTE FUNCTION reject_market_contract_snapshot_mutation();

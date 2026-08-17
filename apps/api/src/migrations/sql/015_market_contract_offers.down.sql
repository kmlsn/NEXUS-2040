DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM market_contract_offers) OR EXISTS (SELECT 1 FROM market_contract_snapshots) THEN
    RAISE EXCEPTION 'Refusing market contract offer rollback with persisted history';
  END IF;
  IF EXISTS (SELECT 1 FROM ledger_transactions WHERE reason_code IN ('contract_collateral_hold', 'contract_collateral_refund')) THEN
    RAISE EXCEPTION 'Refusing market contract offer rollback with collateral ledger history';
  END IF;
END $$;

DROP TRIGGER market_contract_offer_immutable ON market_contract_offers;
DROP TRIGGER market_contract_offer_ledger_guard_trigger ON market_contract_offers;
DROP FUNCTION market_contract_offer_ledger_guard();
DROP TABLE market_contract_offers;
DROP TRIGGER market_contract_snapshot_immutable ON market_contract_snapshots;
DROP TRIGGER market_contract_snapshot_guard_trigger ON market_contract_snapshots;
DROP FUNCTION reject_market_contract_snapshot_mutation();
DROP FUNCTION market_contract_snapshot_guard();
DROP TABLE market_contract_snapshots;

ALTER TABLE resource_ledger_entries
  DROP CONSTRAINT resource_ledger_entries_reason_code_check,
  ADD CONSTRAINT resource_ledger_entries_reason_code_check
    CHECK (reason_code IN ('system_grant', 'facility_cost', 'facility_refund', 'accrual_output', 'accrual_settlement', 'operation_cost', 'operation_reward', 'system_reversal'));

ALTER TABLE ledger_transactions
  DROP CONSTRAINT ledger_transactions_reason_code_check,
  ADD CONSTRAINT ledger_transactions_reason_code_check
    CHECK (reason_code IN ('system_grant', 'facility_cost', 'facility_refund', 'accrual_output', 'accrual_settlement', 'operation_cost', 'operation_reward', 'system_reversal'));

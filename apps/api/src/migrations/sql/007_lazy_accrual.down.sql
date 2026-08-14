DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM profile_facility_accrual_state) THEN
    RAISE EXCEPTION 'Refusing lazy accrual rollback with persisted state';
  END IF;
  IF EXISTS (SELECT 1 FROM ledger_transactions WHERE reason_code = 'accrual_settlement') THEN
    RAISE EXCEPTION 'Refusing lazy accrual rollback with settlement history';
  END IF;
END $$;

ALTER TABLE resource_ledger_entries
  DROP CONSTRAINT resource_ledger_entries_reason_code_check,
  ADD CONSTRAINT resource_ledger_entries_reason_code_check
    CHECK (reason_code IN ('system_grant', 'facility_cost', 'facility_refund', 'accrual_output', 'operation_cost', 'operation_reward', 'system_reversal'));

ALTER TABLE ledger_transactions
  DROP CONSTRAINT ledger_transactions_reason_code_check,
  ADD CONSTRAINT ledger_transactions_reason_code_check
    CHECK (reason_code IN ('system_grant', 'facility_cost', 'facility_refund', 'accrual_output', 'operation_cost', 'operation_reward', 'system_reversal'));

DROP TABLE profile_facility_accrual_state;
ALTER TABLE profile_facilities DROP COLUMN energy_priority;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT profile_id, resource, COALESCE(SUM(amount_micro), 0) AS total
      FROM resource_ledger_entries
      GROUP BY profile_id, resource
    ) totals
    WHERE total < 0
  ) THEN
    RAISE EXCEPTION 'Refusing resource balance backfill with negative historical totals';
  END IF;
END $$;

INSERT INTO resource_balances(profile_id, resource, balance_micro)
SELECT profiles.id, resources.resource, COALESCE(SUM(entries.amount_micro), 0)
FROM profiles
CROSS JOIN LATERAL unnest(enum_range(NULL::resource_kind)) AS resources(resource)
LEFT JOIN resource_ledger_entries AS entries
  ON entries.profile_id = profiles.id AND entries.resource = resources.resource
GROUP BY profiles.id, resources.resource
ON CONFLICT (profile_id, resource) DO UPDATE
  SET balance_micro = EXCLUDED.balance_micro, updated_at = now();

ALTER TABLE idempotency_requests
  DROP CONSTRAINT idempotency_requests_completed_transaction_fk,
  ADD CONSTRAINT idempotency_requests_completed_transaction_profile_fk
    FOREIGN KEY (completed_transaction_id, profile_id)
    REFERENCES ledger_transactions(id, profile_id),
  ADD CONSTRAINT idempotency_requests_reasonless_status_check
    CHECK (status IN ('pending', 'completed', 'rejected'));

ALTER TABLE ledger_transactions
  DROP CONSTRAINT IF EXISTS ledger_transactions_reason_code_check,
  ADD CONSTRAINT ledger_transactions_reason_code_check
    CHECK (reason_code IN ('system_grant', 'facility_cost', 'facility_refund', 'accrual_output', 'operation_cost', 'operation_reward', 'system_reversal'));

ALTER TABLE resource_ledger_entries
  DROP CONSTRAINT IF EXISTS resource_ledger_entries_reason_code_check,
  ADD CONSTRAINT resource_ledger_entries_reason_code_check
    CHECK (reason_code IN ('system_grant', 'facility_cost', 'facility_refund', 'accrual_output', 'operation_cost', 'operation_reward', 'system_reversal'));

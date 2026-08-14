UPDATE idempotency_requests AS requests
SET completed_transaction_id = transactions.id
FROM ledger_transactions AS transactions
WHERE requests.status = 'completed'
  AND requests.completed_transaction_id IS NULL
  AND transactions.idempotency_request_id = requests.id
  AND transactions.profile_id = requests.profile_id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM idempotency_requests WHERE status = 'completed' AND completed_transaction_id IS NULL) THEN
    RAISE EXCEPTION 'Refusing idempotency completion migration with orphan completed requests';
  END IF;
END $$;

ALTER TABLE idempotency_requests
  ADD CONSTRAINT idempotency_requests_completion_state_check
    CHECK (
      (status = 'completed' AND completed_transaction_id IS NOT NULL)
      OR (status IN ('pending', 'rejected') AND completed_transaction_id IS NULL)
    );

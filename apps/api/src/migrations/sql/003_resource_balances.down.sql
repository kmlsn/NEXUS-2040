DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM resource_balances) THEN
    RAISE EXCEPTION 'Refusing to roll back resource balance migration with persisted data';
  END IF;
END $$;

ALTER TABLE idempotency_requests
  DROP CONSTRAINT idempotency_requests_completed_transaction_fk,
  DROP COLUMN completed_transaction_id;

DROP TABLE resource_balances;

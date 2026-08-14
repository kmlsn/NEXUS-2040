CREATE TABLE resource_balances (
  profile_id uuid NOT NULL REFERENCES profiles(id),
  resource resource_kind NOT NULL,
  balance_micro bigint NOT NULL CHECK (balance_micro >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, resource)
);

ALTER TABLE idempotency_requests
  ADD COLUMN completed_transaction_id uuid UNIQUE,
  ADD CONSTRAINT idempotency_requests_completed_transaction_fk
    FOREIGN KEY (completed_transaction_id) REFERENCES ledger_transactions(id);

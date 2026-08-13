CREATE TYPE resource_kind AS ENUM ('energy', 'compute', 'components', 'capital', 'expertise');

CREATE TABLE idempotency_requests (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id),
  scope text NOT NULL CHECK (length(scope) BETWEEN 1 AND 80),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 160),
  request_fingerprint char(64) NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, scope, idempotency_key),
  UNIQUE (id, profile_id)
);

CREATE TABLE ledger_transactions (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL,
  idempotency_request_id uuid NOT NULL UNIQUE,
  reason_code text NOT NULL CHECK (length(reason_code) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (idempotency_request_id, profile_id) REFERENCES idempotency_requests(id, profile_id),
  UNIQUE (id, profile_id)
);

CREATE TABLE resource_ledger_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transaction_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  resource resource_kind NOT NULL,
  amount_micro bigint NOT NULL CHECK (amount_micro <> 0),
  reason_code text NOT NULL CHECK (length(reason_code) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (transaction_id, profile_id) REFERENCES ledger_transactions(id, profile_id)
);

CREATE FUNCTION reject_ledger_entry_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Ledger entries are immutable';
END $$;

CREATE TRIGGER resource_ledger_entries_immutable BEFORE UPDATE OR DELETE ON resource_ledger_entries FOR EACH ROW EXECUTE FUNCTION reject_ledger_entry_mutation();
CREATE TRIGGER resource_ledger_entries_no_truncate BEFORE TRUNCATE ON resource_ledger_entries FOR EACH STATEMENT EXECUTE FUNCTION reject_ledger_entry_mutation();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM idempotency_requests) OR EXISTS (SELECT 1 FROM ledger_transactions) OR EXISTS (SELECT 1 FROM resource_ledger_entries) THEN
    RAISE EXCEPTION 'Refusing to roll back ledger migration with persisted data';
  END IF;
END $$;
DROP TRIGGER resource_ledger_entries_immutable ON resource_ledger_entries;
DROP TRIGGER resource_ledger_entries_no_truncate ON resource_ledger_entries;
DROP FUNCTION reject_ledger_entry_mutation();
DROP TABLE resource_ledger_entries;
DROP TABLE ledger_transactions;
DROP TABLE idempotency_requests;
DROP TYPE resource_kind;

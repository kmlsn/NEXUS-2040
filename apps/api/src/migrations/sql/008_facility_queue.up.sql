ALTER TABLE profile_facilities
  ADD CONSTRAINT profile_facilities_id_profile_kind_unique UNIQUE (id, profile_id, facility_kind);

CREATE TABLE facility_queue_items (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id),
  facility_id uuid,
  facility_kind text NOT NULL CHECK (facility_kind IN ('microgrid', 'data_center', 'robotics_workshop', 'research_lab', 'security_operations_center')),
  target_level smallint NOT NULL CHECK (target_level BETWEEN 1 AND 12),
  status text NOT NULL CHECK (status IN ('active', 'completed', 'cancelled')),
  enqueued_at timestamptz NOT NULL,
  finish_at timestamptz NOT NULL CHECK (finish_at > enqueued_at),
  completed_at timestamptz,
  cancelled_at timestamptz,
  capital_cost_micro bigint NOT NULL CHECK (capital_cost_micro > 0),
  components_cost_micro bigint NOT NULL CHECK (components_cost_micro > 0),
  duration_ms bigint NOT NULL CHECK (duration_ms > 0),
  content_version text NOT NULL,
  formula_version text NOT NULL,
  cost_transaction_id uuid NOT NULL,
  refund_transaction_id uuid,
  CHECK ((status = 'active' AND completed_at IS NULL AND cancelled_at IS NULL AND refund_transaction_id IS NULL)
      OR (status = 'completed' AND completed_at IS NOT NULL AND cancelled_at IS NULL AND refund_transaction_id IS NULL)
      OR (status = 'cancelled' AND completed_at IS NULL AND cancelled_at IS NOT NULL AND refund_transaction_id IS NOT NULL)),
  FOREIGN KEY (content_version, formula_version) REFERENCES content_versions(version, formula_version),
  FOREIGN KEY (facility_id, profile_id, facility_kind) REFERENCES profile_facilities(id, profile_id, facility_kind),
  FOREIGN KEY (cost_transaction_id, profile_id) REFERENCES ledger_transactions(id, profile_id),
  FOREIGN KEY (refund_transaction_id, profile_id) REFERENCES ledger_transactions(id, profile_id)
);

CREATE UNIQUE INDEX facility_queue_one_active_per_profile
  ON facility_queue_items(profile_id) WHERE status = 'active';

CREATE UNIQUE INDEX facility_queue_cost_transaction_once
  ON facility_queue_items(cost_transaction_id);

CREATE UNIQUE INDEX facility_queue_refund_transaction_once
  ON facility_queue_items(refund_transaction_id) WHERE refund_transaction_id IS NOT NULL;

CREATE FUNCTION facility_queue_transaction_reason_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ledger_transactions
    WHERE id = NEW.cost_transaction_id AND profile_id = NEW.profile_id AND reason_code = 'facility_cost'
  ) THEN
    RAISE EXCEPTION 'Facility queue cost must reference same-profile facility_cost transaction';
  END IF;
  IF NEW.refund_transaction_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM ledger_transactions
    WHERE id = NEW.refund_transaction_id AND profile_id = NEW.profile_id AND reason_code = 'facility_refund'
  ) THEN
    RAISE EXCEPTION 'Facility queue refund must reference same-profile facility_refund transaction';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER facility_queue_transaction_reason_trigger
  BEFORE INSERT OR UPDATE OF cost_transaction_id, refund_transaction_id, profile_id
  ON facility_queue_items FOR EACH ROW EXECUTE FUNCTION facility_queue_transaction_reason_guard();

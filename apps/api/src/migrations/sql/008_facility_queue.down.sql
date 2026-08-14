DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM facility_queue_items) THEN
    RAISE EXCEPTION 'Refusing facility queue rollback with persisted queue history';
  END IF;
END $$;

DROP TRIGGER facility_queue_transaction_reason_trigger ON facility_queue_items;
DROP FUNCTION facility_queue_transaction_reason_guard();
DROP TABLE facility_queue_items;
ALTER TABLE profile_facilities DROP CONSTRAINT profile_facilities_id_profile_kind_unique;

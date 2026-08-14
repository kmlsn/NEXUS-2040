DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM profile_facilities) THEN
    RAISE EXCEPTION 'Refusing to roll back profile facilities migration with persisted data';
  END IF;
END $$;
DROP TABLE profile_facilities;

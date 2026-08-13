DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM profiles) OR EXISTS (SELECT 1 FROM content_versions WHERE (version, formula_version) <> ('asteria-baseline-0.2', 'balance-1.2')) THEN
    RAISE EXCEPTION 'Refusing to roll back content/profile migration with persisted data';
  END IF;
END $$;
DROP TABLE profiles;
DROP TABLE content_versions;

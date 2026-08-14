DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE content_version = 'asteria-baseline-0.2' AND formula_version = 'balance-1.3') THEN
    RAISE EXCEPTION 'Refusing balance-1.3 rollback with persisted profiles';
  END IF;
END $$;

DELETE FROM content_versions WHERE version = 'asteria-baseline-0.2' AND formula_version = 'balance-1.3';

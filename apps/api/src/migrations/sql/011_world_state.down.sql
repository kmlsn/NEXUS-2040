DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM world_state WHERE completed_cycles <> 0 OR state_revision <> 1) THEN
    RAISE EXCEPTION 'Refusing world-state rollback after a completed cycle';
  END IF;
END $$;

DROP TABLE world_state;

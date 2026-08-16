DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM world_state WHERE completed_cycles <> 0 OR state_revision <> 1) THEN
    RAISE EXCEPTION 'Refusing world-state configuration rollback after a completed cycle';
  END IF;
END $$;

DROP TRIGGER world_state_configuration_guard_trigger ON world_state;
DROP FUNCTION world_state_configuration_guard();

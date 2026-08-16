CREATE FUNCTION world_state_configuration_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.content_version <> OLD.content_version
    OR NEW.formula_version <> OLD.formula_version
    OR NEW.master_seed <> OLD.master_seed
    OR NEW.epoch_ms <> OLD.epoch_ms THEN
    RAISE EXCEPTION 'World state configuration is immutable';
  END IF;
  IF NEW.completed_cycles < OLD.completed_cycles OR NEW.state_revision < OLD.state_revision THEN
    RAISE EXCEPTION 'World state cannot move backwards';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER world_state_configuration_guard_trigger
  BEFORE UPDATE ON world_state
  FOR EACH ROW EXECUTE FUNCTION world_state_configuration_guard();

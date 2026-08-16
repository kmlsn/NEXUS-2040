CREATE TABLE npc_market_state (
  world_state_id smallint PRIMARY KEY REFERENCES world_state(id) CHECK (world_state_id = 1),
  content_version text NOT NULL,
  formula_version text NOT NULL,
  market_index_basis_points smallint NOT NULL CHECK (market_index_basis_points BETWEEN 8500 AND 11500),
  applied_cycles bigint NOT NULL CHECK (applied_cycles >= 0),
  state_revision bigint NOT NULL CHECK (state_revision = applied_cycles + 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (content_version, formula_version) REFERENCES content_versions(version, formula_version)
);

INSERT INTO npc_market_state(world_state_id, content_version, formula_version, market_index_basis_points, applied_cycles, state_revision)
SELECT id, content_version, formula_version, 10000, 0, 1 FROM world_state WHERE id = 1;

CREATE FUNCTION npc_market_state_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE authoritative_content text;
DECLARE authoritative_formula text;
DECLARE completed bigint;
BEGIN
  SELECT content_version, formula_version, completed_cycles INTO authoritative_content, authoritative_formula, completed FROM world_state WHERE id = NEW.world_state_id;
  IF NOT FOUND OR NEW.content_version <> authoritative_content OR NEW.formula_version <> authoritative_formula THEN
    RAISE EXCEPTION 'NPC market state must match world state version';
  END IF;
  IF NEW.applied_cycles > completed THEN
    RAISE EXCEPTION 'NPC market state cannot lead completed world cycles';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.world_state_id <> OLD.world_state_id OR NEW.applied_cycles <= OLD.applied_cycles) THEN
    RAISE EXCEPTION 'NPC market state requires an immutable world binding and forward-only cycles';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER npc_market_state_guard_trigger
  BEFORE INSERT OR UPDATE ON npc_market_state
  FOR EACH ROW EXECUTE FUNCTION npc_market_state_guard();

CREATE FUNCTION npc_market_state_delete_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'NPC market state is a required singleton and cannot be deleted';
END $$;

CREATE TRIGGER npc_market_state_delete_guard_trigger
  BEFORE DELETE ON npc_market_state
  FOR EACH ROW EXECUTE FUNCTION npc_market_state_delete_guard();

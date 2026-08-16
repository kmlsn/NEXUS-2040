CREATE TABLE npc_organization_state (
  organization_id text PRIMARY KEY CHECK (organization_id IN ('nexilune_industrial', 'asteria_civic_grid', 'free_mesh')),
  world_state_id smallint NOT NULL DEFAULT 1 REFERENCES world_state(id) CHECK (world_state_id = 1),
  content_version text NOT NULL,
  formula_version text NOT NULL,
  doctrine_id text NOT NULL CHECK (doctrine_id IN ('centralize', 'continuity', 'distribute')),
  capacity_readiness smallint NOT NULL CHECK (capacity_readiness BETWEEN 0 AND 100),
  state_revision bigint NOT NULL DEFAULT 1 CHECK (state_revision >= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (content_version, formula_version) REFERENCES content_versions(version, formula_version)
);

INSERT INTO npc_organization_state(organization_id, content_version, formula_version, doctrine_id, capacity_readiness) VALUES
  ('nexilune_industrial', 'asteria-baseline-0.2', 'balance-1.2', 'centralize', 65),
  ('asteria_civic_grid', 'asteria-baseline-0.2', 'balance-1.2', 'continuity', 60),
  ('free_mesh', 'asteria-baseline-0.2', 'balance-1.2', 'distribute', 55);

CREATE TABLE profile_npc_relationships (
  profile_id uuid NOT NULL REFERENCES profiles(id),
  organization_id text NOT NULL REFERENCES npc_organization_state(organization_id),
  relationship_tenths smallint NOT NULL DEFAULT 0 CHECK (relationship_tenths BETWEEN -1000 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, organization_id)
);

INSERT INTO profile_npc_relationships(profile_id, organization_id)
SELECT profiles.id, npc_organization_state.organization_id FROM profiles CROSS JOIN npc_organization_state
ON CONFLICT DO NOTHING;

CREATE FUNCTION profile_npc_relationships_bootstrap() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO profile_npc_relationships(profile_id, organization_id)
  SELECT NEW.id, organization_id FROM npc_organization_state
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER profile_npc_relationships_bootstrap_trigger
  AFTER INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION profile_npc_relationships_bootstrap();

CREATE FUNCTION npc_organization_state_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE authoritative_content text;
DECLARE authoritative_formula text;
BEGIN
  SELECT content_version, formula_version INTO authoritative_content, authoritative_formula FROM world_state WHERE id = NEW.world_state_id;
  IF NOT FOUND OR NEW.content_version <> authoritative_content OR NEW.formula_version <> authoritative_formula THEN
    RAISE EXCEPTION 'NPC organization state must match world state version';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.world_state_id <> OLD.world_state_id OR NEW.state_revision <= OLD.state_revision) THEN
    RAISE EXCEPTION 'NPC organization state requires an immutable world binding and increasing revision';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER npc_organization_state_guard_trigger
  BEFORE INSERT OR UPDATE ON npc_organization_state
  FOR EACH ROW EXECUTE FUNCTION npc_organization_state_guard();

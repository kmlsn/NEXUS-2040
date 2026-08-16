DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM profile_npc_relationships)
    OR (SELECT count(*) FROM npc_organization_state) <> 3
    OR EXISTS (
      (SELECT organization_id, world_state_id, content_version, formula_version, doctrine_id, capacity_readiness, state_revision FROM npc_organization_state)
      EXCEPT
      (VALUES
        ('nexilune_industrial'::text, 1::smallint, 'asteria-baseline-0.2'::text, 'balance-1.2'::text, 'centralize'::text, 65::smallint, 1::bigint),
        ('asteria_civic_grid'::text, 1::smallint, 'asteria-baseline-0.2'::text, 'balance-1.2'::text, 'continuity'::text, 60::smallint, 1::bigint),
        ('free_mesh'::text, 1::smallint, 'asteria-baseline-0.2'::text, 'balance-1.2'::text, 'distribute'::text, 55::smallint, 1::bigint)
      )
    ) THEN
    RAISE EXCEPTION 'Refusing NPC organization rollback with persisted state';
  END IF;
END $$;

DROP TRIGGER profile_npc_relationships_bootstrap_trigger ON profiles;
DROP FUNCTION profile_npc_relationships_bootstrap();
DROP TRIGGER npc_organization_state_guard_trigger ON npc_organization_state;
DROP FUNCTION npc_organization_state_guard();
DROP TABLE profile_npc_relationships;
DROP TABLE npc_organization_state;

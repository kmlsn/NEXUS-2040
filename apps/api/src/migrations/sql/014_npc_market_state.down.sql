DO $$
BEGIN
  IF (SELECT count(*) FROM npc_market_state) <> 1 OR EXISTS (
    (SELECT world_state_id, content_version, formula_version, market_index_basis_points, applied_cycles, state_revision FROM npc_market_state)
    EXCEPT VALUES (1::smallint, 'asteria-baseline-0.2'::text, 'balance-1.2'::text, 10000::smallint, 0::bigint, 1::bigint)
  ) THEN
    RAISE EXCEPTION 'Cannot roll back NPC market migration after market state has advanced';
  END IF;
END $$;

DROP TRIGGER npc_market_state_delete_guard_trigger ON npc_market_state;
DROP FUNCTION npc_market_state_delete_guard();
DROP TRIGGER npc_market_state_guard_trigger ON npc_market_state;
DROP FUNCTION npc_market_state_guard();
DROP TABLE npc_market_state;

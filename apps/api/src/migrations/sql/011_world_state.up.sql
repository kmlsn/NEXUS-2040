CREATE TABLE world_state (
  id smallint PRIMARY KEY CHECK (id = 1),
  content_version text NOT NULL,
  formula_version text NOT NULL,
  master_seed numeric(20, 0) NOT NULL CHECK (master_seed >= 0 AND master_seed <= 18446744073709551615),
  epoch_ms bigint NOT NULL CHECK (epoch_ms >= 0),
  completed_cycles bigint NOT NULL DEFAULT 0 CHECK (completed_cycles >= 0),
  state_revision bigint NOT NULL DEFAULT 1 CHECK (state_revision = completed_cycles + 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (content_version, formula_version) REFERENCES content_versions(version, formula_version)
);

INSERT INTO world_state(id, content_version, formula_version, master_seed, epoch_ms)
VALUES (1, 'asteria-baseline-0.2', 'balance-1.2', 20260809, 1767225600000);

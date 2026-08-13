CREATE TABLE content_versions (
  version text NOT NULL,
  formula_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (version, formula_version)
);

INSERT INTO content_versions(version, formula_version) VALUES ('asteria-baseline-0.2', 'balance-1.2');

CREATE TABLE profiles (
  id uuid PRIMARY KEY,
  content_version text NOT NULL,
  formula_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (content_version, formula_version) REFERENCES content_versions(version, formula_version)
);

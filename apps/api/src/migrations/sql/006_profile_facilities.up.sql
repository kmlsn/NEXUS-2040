CREATE TABLE profile_facilities (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id),
  facility_kind text NOT NULL CHECK (facility_kind IN ('microgrid', 'data_center', 'robotics_workshop', 'research_lab', 'security_operations_center')),
  level smallint NOT NULL CHECK (level BETWEEN 1 AND 12),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, facility_kind)
);

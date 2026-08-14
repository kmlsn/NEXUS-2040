ALTER TABLE profile_facilities
  ADD COLUMN energy_priority smallint NOT NULL DEFAULT 3 CHECK (energy_priority BETWEEN 1 AND 5);

CREATE TABLE profile_facility_accrual_state (
  facility_id uuid PRIMARY KEY REFERENCES profile_facilities(id),
  last_accrued_at timestamptz NOT NULL DEFAULT now(),
  output_carry_numerator numeric NOT NULL DEFAULT 0 CHECK (output_carry_numerator >= 0),
  output_carry_denominator numeric NOT NULL DEFAULT 1 CHECK (output_carry_denominator > 0),
  energy_carry_numerator numeric NOT NULL DEFAULT 0 CHECK (energy_carry_numerator >= 0),
  energy_carry_denominator numeric NOT NULL DEFAULT 1 CHECK (energy_carry_denominator > 0),
  CHECK (energy_carry_numerator < energy_carry_denominator),
  CHECK (output_carry_numerator < output_carry_denominator)
);

ALTER TABLE ledger_transactions
  DROP CONSTRAINT ledger_transactions_reason_code_check,
  ADD CONSTRAINT ledger_transactions_reason_code_check
    CHECK (reason_code IN ('system_grant', 'facility_cost', 'facility_refund', 'accrual_output', 'accrual_settlement', 'operation_cost', 'operation_reward', 'system_reversal'));

ALTER TABLE resource_ledger_entries
  DROP CONSTRAINT resource_ledger_entries_reason_code_check,
  ADD CONSTRAINT resource_ledger_entries_reason_code_check
    CHECK (reason_code IN ('system_grant', 'facility_cost', 'facility_refund', 'accrual_output', 'accrual_settlement', 'operation_cost', 'operation_reward', 'system_reversal'));

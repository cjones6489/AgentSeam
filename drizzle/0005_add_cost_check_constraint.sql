-- Add CHECK constraint to prevent negative cost values
ALTER TABLE cost_events
  ADD CONSTRAINT cost_events_cost_microdollars_nonneg
  CHECK (cost_microdollars >= 0);

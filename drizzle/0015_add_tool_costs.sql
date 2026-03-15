-- Tool Costs table for MCP tool cost catalog (Phase 7.5)
CREATE TABLE tool_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  server_name TEXT NOT NULL CHECK (server_name NOT LIKE '%/%'),
  tool_name TEXT NOT NULL,
  cost_microdollars BIGINT NOT NULL DEFAULT 10000,
  source TEXT NOT NULL DEFAULT 'discovered' CHECK (source IN ('discovered', 'manual')),
  description TEXT,
  annotations JSONB,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, server_name, tool_name)
);

CREATE INDEX tool_costs_user_id_idx ON tool_costs (user_id);

-- RLS (matches pattern from 0014_subscriptions_rls_and_trigger.sql)
ALTER TABLE tool_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own tool costs"
  ON tool_costs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "users can manage own tool costs"
  ON tool_costs FOR ALL
  TO authenticated
  USING (user_id = auth.uid()::text);

REVOKE ALL ON tool_costs FROM anon;

-- Auto-update updated_at (matches subscriptions pattern)
CREATE TRIGGER set_tool_costs_updated_at
  BEFORE UPDATE ON tool_costs
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- Enable RLS (matches pattern from 0011_enable_rls_and_revoke_anon.sql)
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "users can manage own subscription"
  ON subscriptions FOR ALL
  TO authenticated
  USING (user_id = auth.uid()::text);

REVOKE ALL ON subscriptions FROM anon;

-- Auto-update updated_at (matches pattern from 0012_add_updated_at_trigger.sql)
CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

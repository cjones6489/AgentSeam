import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SupabaseEnvError } from "@/lib/auth/errors";

export function createBrowserSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) throw new SupabaseEnvError("NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new SupabaseEnvError("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  return createBrowserClient(url, key);
}

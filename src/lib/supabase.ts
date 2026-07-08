import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let initialized = false;

export async function getSupabase(): Promise<SupabaseClient | null> {
  if (initialized) return client;
  initialized = true;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      client = createClient(url, key);
    } catch {
      client = null;
    }
  }
  return client;
}

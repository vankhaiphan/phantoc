import { createBrowserClient } from "@supabase/ssr";
import { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const createClient = () => {
  if (!supabaseUrl || !supabaseKey) {
    // Dummy client to avoid crashing the render before the redirect to /missing-db-config fires.
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        signInWithPassword: async () => ({
          data: null,
          error: new Error("Missing Supabase configuration"),
        }),
        signUp: async () => ({
          data: null,
          error: new Error("Missing Supabase configuration"),
        }),
      },
    } as unknown as SupabaseClient;
  }
  return createBrowserClient(supabaseUrl, supabaseKey);
};

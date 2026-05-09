import { createServerClient } from "@supabase/ssr";
import { SupabaseClient } from "@supabase/supabase-js";
import type { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const createClient = (
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) => {
  if (!supabaseUrl || !supabaseKey) {
    // Null-safe dummy so render does not crash before the /missing-db-config redirect.
    return {
      from: () => ({
        select: () => ({
          eq: () => ({ single: async () => ({ data: null, error: null }) }),
          limit: async () => ({ data: null, error: null }),
        }),
      }),
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    } as unknown as SupabaseClient;
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // Safe to ignore if you have middleware refreshing user sessions.
        }
      },
    },
  });
};

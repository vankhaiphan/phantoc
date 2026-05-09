import { Profile } from "@/types";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { cache } from "react";

/**
 * Cached so a single Supabase client is reused for the lifetime of one request.
 */
export const getSupabase = cache(async () => {
  const cookieStore = await cookies();
  return createClient(cookieStore);
});

export const getUser = cache(async () => {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async (userId?: string) => {
  let id = userId;
  if (!id) {
    const user = await getUser();
    if (!user) return null;
    id = user.id;
  }

  const supabase = await getSupabase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  return profile as Profile | null;
});

export const getIsAdmin = cache(async () => {
  const profile = await getProfile();
  return profile?.role === "admin";
});

export const getIsEditor = cache(async () => {
  const profile = await getProfile();
  return profile?.role === "editor" || profile?.role === "admin";
});

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase/queries";

export interface AuthState {
  error?: string;
}

export async function signIn(
  _prevState: AuthState | null,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Vui lòng điền đầy đủ thư điện tử và mật khẩu." };
  }

  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Surface a friendly Vietnamese message; full error in the server log.
    if (error.message.toLowerCase().includes("invalid login")) {
      return { error: "Sai thư điện tử hoặc mật khẩu." };
    }
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return { error: "Tài khoản chưa được xác nhận thư điện tử." };
    }
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/bang-dieu-khien");
}

export async function signOut(): Promise<void> {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

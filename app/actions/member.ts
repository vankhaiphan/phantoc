"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getIsEditor, getSupabase } from "@/lib/supabase/queries";
import { PersonInputSchema, type PersonInput } from "@/lib/validation/person";

export interface MemberActionResult {
  ok: boolean;
  id?: string;
  error?: string;
  fieldErrors?: Partial<Record<keyof PersonInput, string>>;
}

function denied(): MemberActionResult {
  return { ok: false, error: "Từ chối truy cập. Cần quyền biên soạn." };
}

function flattenZodErrors(
  err: import("zod").ZodError,
): Partial<Record<keyof PersonInput, string>> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) {
      out[key] = issue.message;
    }
  }
  return out as Partial<Record<keyof PersonInput, string>>;
}

export async function createPerson(
  input: PersonInput,
): Promise<MemberActionResult> {
  if (!(await getIsEditor())) return denied();

  const parsed = PersonInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Dữ liệu không hợp lệ.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("persons")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/bang-dieu-khien/thanh-vien");
  return { ok: true, id: data.id as string };
}

export async function updatePerson(
  id: string,
  input: PersonInput,
): Promise<MemberActionResult> {
  if (!(await getIsEditor())) return denied();

  const parsed = PersonInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Dữ liệu không hợp lệ.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const supabase = await getSupabase();
  const { error } = await supabase
    .from("persons")
    .update(parsed.data)
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/bang-dieu-khien/thanh-vien");
  revalidatePath(`/bang-dieu-khien/thanh-vien/${id}`);
  return { ok: true, id };
}

export async function deletePerson(id: string): Promise<void> {
  if (!(await getIsEditor())) {
    throw new Error("Từ chối truy cập.");
  }

  const supabase = await getSupabase();
  const { error } = await supabase.from("persons").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/bang-dieu-khien/thanh-vien");
  redirect("/bang-dieu-khien/thanh-vien");
}

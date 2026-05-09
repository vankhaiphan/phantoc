"use server";

import { revalidatePath } from "next/cache";
import { getIsEditor, getSupabase } from "@/lib/supabase/queries";
import {
  RelationshipInputSchema,
  type RelationshipInput,
} from "@/lib/validation/relationship";

export interface RelActionResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function createRelationship(
  input: RelationshipInput,
): Promise<RelActionResult> {
  if (!(await getIsEditor())) {
    return { ok: false, error: "Từ chối truy cập. Cần quyền biên soạn." };
  }

  const parsed = RelationshipInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.",
    };
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("relationships")
    .insert(parsed.data)
    .select("id, person_a, person_b")
    .single();

  if (error) {
    // UNIQUE(person_a, person_b, type) violations come back here
    if (error.code === "23505") {
      return { ok: false, error: "Quan hệ này đã tồn tại." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath(`/bang-dieu-khien/thanh-vien/${parsed.data.person_a}`);
  revalidatePath(`/bang-dieu-khien/thanh-vien/${parsed.data.person_b}`);
  revalidatePath("/bang-dieu-khien/thanh-vien");
  return { ok: true, id: data.id as string };
}

export async function deleteRelationship(
  id: string,
  /** Pass the two person IDs so we know which detail pages to revalidate. */
  personAId?: string,
  personBId?: string,
): Promise<RelActionResult> {
  if (!(await getIsEditor())) {
    return { ok: false, error: "Từ chối truy cập. Cần quyền biên soạn." };
  }

  const supabase = await getSupabase();
  const { error } = await supabase.from("relationships").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (personAId) revalidatePath(`/bang-dieu-khien/thanh-vien/${personAId}`);
  if (personBId) revalidatePath(`/bang-dieu-khien/thanh-vien/${personBId}`);
  revalidatePath("/bang-dieu-khien/thanh-vien");
  return { ok: true, id };
}

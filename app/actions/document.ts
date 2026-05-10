"use server";

import { revalidatePath } from "next/cache";
import { getIsAdmin, getSupabase, getUser } from "@/lib/supabase/queries";
import type { DocType } from "@/types";

export interface DocActionResult {
  ok: boolean;
  id?: string;
  error?: string;
}

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

const DOC_TYPES = new Set<DocType>([
  "birth_certificate",
  "death_certificate",
  "marriage_certificate",
  "id_card",
  "gia_pha_scan",
  "other",
]);

function denied(): DocActionResult {
  return { ok: false, error: "Từ chối truy cập. Chỉ Trưởng tộc mới quản lý tài liệu." };
}

/**
 * Upload a private document for a person. Stored in the private `documents`
 * bucket under `persons/<personId>/<uuid>.<ext>`. Admin role only — RLS on
 * `person_documents` plus the storage policies enforce this server-side too.
 */
export async function uploadDocument(
  personId: string,
  formData: FormData,
): Promise<DocActionResult> {
  if (!(await getIsAdmin())) return denied();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Không có tệp được chọn." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Tệp quá lớn (tối đa 25 MB)." };
  }

  const title = stringOrNull(formData.get("title"));
  const rawType = String(formData.get("doc_type") ?? "other") as DocType;
  const docType: DocType = DOC_TYPES.has(rawType) ? rawType : "other";

  const supabase = await getSupabase();
  const user = await getUser();

  const ext = inferExtension(file.name);
  const path = `persons/${personId}/${crypto.randomUUID()}${ext ? "." + ext : ""}`;

  const buffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { data: row, error: insertError } = await supabase
    .from("person_documents")
    .insert({
      person_id: personId,
      storage_path: path,
      title,
      doc_type: docType,
      uploaded_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (insertError) {
    await supabase.storage.from("documents").remove([path]);
    return { ok: false, error: insertError.message };
  }

  revalidatePath(`/bang-dieu-khien/thanh-vien/${personId}`);
  return { ok: true, id: row.id as string };
}

export async function deleteDocument(
  documentId: string,
): Promise<DocActionResult> {
  if (!(await getIsAdmin())) return denied();

  const supabase = await getSupabase();
  const { data: doc, error: fetchError } = await supabase
    .from("person_documents")
    .select("id, storage_path, person_id")
    .eq("id", documentId)
    .single();
  if (fetchError || !doc) {
    return {
      ok: false,
      error: fetchError?.message ?? "Không tìm thấy tài liệu.",
    };
  }

  await supabase.storage.from("documents").remove([doc.storage_path]);
  const { error: deleteError } = await supabase
    .from("person_documents")
    .delete()
    .eq("id", documentId);
  if (deleteError) return { ok: false, error: deleteError.message };

  revalidatePath(`/bang-dieu-khien/thanh-vien/${doc.person_id}`);
  return { ok: true, id: documentId };
}

/**
 * Generate a short-lived signed URL for a private document. Admin only.
 * The URL expires after `expiresInSeconds` (default 5 minutes), enough for
 * the browser to follow the redirect once.
 */
export async function getDocumentSignedUrl(
  documentId: string,
  expiresInSeconds = 300,
): Promise<{ url: string | null; error?: string }> {
  if (!(await getIsAdmin())) {
    return { url: null, error: "Từ chối truy cập." };
  }

  const supabase = await getSupabase();
  const { data: doc, error: fetchError } = await supabase
    .from("person_documents")
    .select("storage_path")
    .eq("id", documentId)
    .single();
  if (fetchError || !doc) {
    return { url: null, error: fetchError?.message ?? "Không tìm thấy tài liệu." };
  }

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, expiresInSeconds);
  if (error) return { url: null, error: error.message };

  return { url: data.signedUrl };
}

function stringOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function inferExtension(fileName: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(fileName);
  return m ? m[1]!.toLowerCase() : "";
}

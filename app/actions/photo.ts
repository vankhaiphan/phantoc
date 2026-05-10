"use server";

import { revalidatePath } from "next/cache";
import { getIsEditor, getSupabase, getUser } from "@/lib/supabase/queries";

export interface PhotoActionResult {
  ok: boolean;
  id?: string;
  url?: string;
  error?: string;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

function denied(): PhotoActionResult {
  return { ok: false, error: "Từ chối truy cập. Cần quyền biên soạn." };
}

/**
 * Upload a photo for a person. The file lands in the public `avatars` bucket
 * under `persons/<personId>/<uuid>.<ext>`, and a row is inserted in
 * `person_photos`. Returns the public URL of the new photo.
 */
export async function uploadPhoto(
  personId: string,
  formData: FormData,
): Promise<PhotoActionResult> {
  if (!(await getIsEditor())) return denied();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Không có tệp được chọn." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Tệp quá lớn (tối đa 10 MB)." };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, error: "Định dạng không được hỗ trợ. Dùng JPG, PNG, WEBP hoặc AVIF." };
  }

  const caption = stringOrNull(formData.get("caption"));
  const supabase = await getSupabase();
  const user = await getUser();

  const ext = inferExtension(file.type, file.name);
  const path = `persons/${personId}/${crypto.randomUUID()}.${ext}`;

  const buffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const { data: row, error: insertError } = await supabase
    .from("person_photos")
    .insert({
      person_id: personId,
      storage_path: path,
      caption,
      uploaded_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (insertError) {
    // Best-effort cleanup of the storage object so we don't leave orphans
    await supabase.storage.from("avatars").remove([path]);
    return { ok: false, error: insertError.message };
  }

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);

  revalidatePath(`/bang-dieu-khien/thanh-vien/${personId}`);
  revalidatePath(`/thanh-vien/${personId}`);
  return { ok: true, id: row.id as string, url: pub.publicUrl };
}

/**
 * Delete a photo (storage object + DB row). Editors only.
 */
export async function deletePhoto(
  photoId: string,
): Promise<PhotoActionResult> {
  if (!(await getIsEditor())) return denied();

  const supabase = await getSupabase();
  const { data: photo, error: fetchError } = await supabase
    .from("person_photos")
    .select("id, storage_path, person_id")
    .eq("id", photoId)
    .single();
  if (fetchError || !photo) {
    return { ok: false, error: fetchError?.message ?? "Không tìm thấy ảnh." };
  }

  await supabase.storage.from("avatars").remove([photo.storage_path]);
  const { error: deleteError } = await supabase
    .from("person_photos")
    .delete()
    .eq("id", photoId);
  if (deleteError) return { ok: false, error: deleteError.message };

  revalidatePath(`/bang-dieu-khien/thanh-vien/${photo.person_id}`);
  revalidatePath(`/thanh-vien/${photo.person_id}`);
  return { ok: true, id: photoId };
}

function stringOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function inferExtension(mime: string, fileName: string): string {
  const fromMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
  };
  if (fromMime[mime]) return fromMime[mime];
  const m = /\.([a-z0-9]+)$/i.exec(fileName);
  return m ? m[1]!.toLowerCase() : "bin";
}

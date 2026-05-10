"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePhoto, uploadPhoto } from "@/app/actions/photo";
import type { PersonPhoto } from "@/types";

interface PhotoGalleryProps {
  personId: string;
  photos: PersonPhoto[];
  /** Map of storage_path → public URL, resolved server-side. */
  publicUrls: Record<string, string>;
  /** Whether the current user can edit (upload / delete). */
  canEdit: boolean;
}

export default function PhotoGallery({
  personId,
  photos,
  publicUrls,
  canEdit,
}: PhotoGalleryProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickFile = () => fileRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const res = await uploadPhoto(personId, fd);
      if (!res.ok) setError(res.error ?? "Tải ảnh thất bại.");
      else router.refresh();
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  const onDelete = (id: string) => {
    if (!confirm("Xoá ảnh này?")) return;
    startTransition(async () => {
      const res = await deletePhoto(id);
      if (!res.ok) setError(res.error ?? "Xoá thất bại.");
      else router.refresh();
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3
          className="font-serif text-base"
          style={{ color: "var(--color-ink)" }}
        >
          Ảnh ({photos.length})
        </h3>
        {canEdit && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="hidden"
              onChange={onFileChange}
            />
            <button
              type="button"
              onClick={onPickFile}
              disabled={isPending}
              className="px-3 py-2 font-serif text-sm disabled:opacity-50"
              style={{
                backgroundColor: "var(--color-parchment-warm)",
                border: "1px solid rgba(26,23,20,0.18)",
                borderRadius: "var(--radius-paper)",
                color: "var(--color-ink)",
              }}
            >
              {isPending ? "Đang tải…" : "Tải ảnh lên"}
            </button>
          </>
        )}
      </div>

      {error && (
        <p
          className="text-sm mb-3 px-3 py-2"
          style={{
            backgroundColor: "rgba(122,31,44,0.08)",
            color: "var(--color-lacquer)",
            borderLeft: "3px solid var(--color-lacquer)",
            borderRadius: "var(--radius-paper)",
          }}
        >
          {error}
        </p>
      )}

      {photos.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-sepia)" }}>
          Chưa có ảnh.
        </p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((photo) => {
            const url = publicUrls[photo.storage_path];
            return (
              <li
                key={photo.id}
                className="relative aspect-square overflow-hidden"
                style={{
                  backgroundColor: "var(--color-ivory)",
                  borderRadius: "var(--radius-paper)",
                  border: "1px solid rgba(26,23,20,0.08)",
                }}
              >
                {url ? (
                  // unoptimized: Supabase storage URLs aren't in the next.config.ts
                  // images.remotePatterns whitelist; private gia phả won't benefit
                  // from the image CDN anyway.
                  <Image
                    src={url}
                    alt={photo.caption ?? ""}
                    fill
                    sizes="(min-width: 768px) 25vw, 50vw"
                    className="object-cover"
                    unoptimized
                  />
                ) : null}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onDelete(photo.id)}
                    disabled={isPending}
                    className="absolute top-2 right-2 text-xs px-2 py-1"
                    style={{
                      backgroundColor: "rgba(26,23,20,0.7)",
                      color: "var(--color-ivory)",
                      borderRadius: "var(--radius-paper)",
                    }}
                  >
                    Xoá
                  </button>
                )}
                {photo.caption && (
                  <div
                    className="absolute inset-x-0 bottom-0 px-2 py-1 text-xs"
                    style={{
                      backgroundColor: "rgba(26,23,20,0.55)",
                      color: "var(--color-ivory)",
                    }}
                  >
                    {photo.caption}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

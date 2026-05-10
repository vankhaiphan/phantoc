"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteDocument,
  getDocumentSignedUrl,
  uploadDocument,
} from "@/app/actions/document";
import type { DocType, PersonDocument } from "@/types";

interface DocumentListProps {
  personId: string;
  documents: PersonDocument[];
  /** Whether the current user can manage documents (admin only). */
  canManage: boolean;
}

const DOC_TYPE_LABEL: Record<DocType, string> = {
  birth_certificate: "Giấy khai sinh",
  death_certificate: "Giấy chứng tử",
  marriage_certificate: "Giấy kết hôn",
  id_card: "CCCD / CMND",
  gia_pha_scan: "Bản scan gia phả cũ",
  other: "Khác",
};

export default function DocumentList({
  personId,
  documents,
  canManage,
}: DocumentListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [docType, setDocType] = useState<DocType>("other");
  const [title, setTitle] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!canManage && documents.length === 0) return null;

  const onUpload = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Hãy chọn một tệp.");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title);
    fd.append("doc_type", docType);
    startTransition(async () => {
      const res = await uploadDocument(personId, fd);
      if (!res.ok) setError(res.error ?? "Tải lên thất bại.");
      else {
        setTitle("");
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      }
    });
  };

  const onDelete = (id: string) => {
    if (!confirm("Xoá tài liệu này?")) return;
    startTransition(async () => {
      const res = await deleteDocument(id);
      if (!res.ok) setError(res.error ?? "Xoá thất bại.");
      else router.refresh();
    });
  };

  const onView = async (id: string) => {
    const res = await getDocumentSignedUrl(id);
    if (!res.url) {
      setError(res.error ?? "Không lấy được liên kết.");
      return;
    }
    window.open(res.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div>
      <h3
        className="font-serif text-base mb-4"
        style={{ color: "var(--color-ink)" }}
      >
        Tài liệu ({documents.length})
      </h3>

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

      {documents.length === 0 ? (
        <p
          className="text-sm mb-4"
          style={{ color: "var(--color-sepia)" }}
        >
          Chưa có tài liệu nào.
        </p>
      ) : (
        <ul className="space-y-2 mb-6">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 p-3"
              style={{
                backgroundColor: "var(--color-ivory)",
                border: "1px solid rgba(26,23,20,0.06)",
                borderRadius: "var(--radius-paper)",
              }}
            >
              <div className="min-w-0 flex-1">
                <p
                  className="font-serif text-sm"
                  style={{ color: "var(--color-ink)" }}
                >
                  {d.title || d.storage_path.split("/").pop()}
                </p>
                <p
                  className="text-xs"
                  style={{ color: "var(--color-sepia)" }}
                >
                  {DOC_TYPE_LABEL[d.doc_type]}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onView(d.id)}
                  className="text-xs px-2 py-1"
                  style={{
                    color: "var(--color-lacquer)",
                  }}
                >
                  Xem
                </button>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => onDelete(d.id)}
                    disabled={isPending}
                    className="text-xs px-2 py-1"
                    style={{ color: "var(--color-sepia)" }}
                  >
                    Xoá
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div
          className="p-4 space-y-3"
          style={{
            backgroundColor: "var(--color-parchment-warm)",
            borderRadius: "var(--radius-paper)",
            border: "1px solid rgba(26,23,20,0.08)",
          }}
        >
          <p
            className="text-sm font-serif"
            style={{ color: "var(--color-ink)" }}
          >
            Tải tài liệu mới
          </p>
          <input
            ref={fileRef}
            type="file"
            className="block w-full text-sm"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm">
              <span
                className="block mb-1"
                style={{ color: "var(--color-sepia)" }}
              >
                Tiêu đề (tuỳ chọn)
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm"
                style={{
                  backgroundColor: "var(--color-ivory)",
                  border: "1px solid rgba(26,23,20,0.12)",
                  borderRadius: "var(--radius-paper)",
                }}
              />
            </label>
            <label className="text-sm">
              <span
                className="block mb-1"
                style={{ color: "var(--color-sepia)" }}
              >
                Loại tài liệu
              </span>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocType)}
                className="w-full px-3 py-2 text-sm"
                style={{
                  backgroundColor: "var(--color-ivory)",
                  border: "1px solid rgba(26,23,20,0.12)",
                  borderRadius: "var(--radius-paper)",
                }}
              >
                {(Object.keys(DOC_TYPE_LABEL) as DocType[]).map((t) => (
                  <option key={t} value={t}>
                    {DOC_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={onUpload}
            disabled={isPending}
            className="px-4 py-2 font-serif text-sm disabled:opacity-50"
            style={{
              backgroundColor: "var(--color-lacquer)",
              color: "var(--color-ivory)",
              borderRadius: "var(--radius-paper)",
            }}
          >
            {isPending ? "Đang tải…" : "Tải lên"}
          </button>
        </div>
      )}
    </div>
  );
}

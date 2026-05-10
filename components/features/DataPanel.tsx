"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  exportGedcom,
  exportPersonsCsv,
  exportRelationshipsCsv,
  importGedcom,
  importPersonsCsv,
  importRelationshipsCsv,
} from "@/app/actions/data";
import type { ImportPayload } from "@/app/actions/data";

type ExportKind = "persons-csv" | "relationships-csv" | "gedcom";
type ImportKind = "persons-csv" | "relationships-csv" | "gedcom";

interface DataPanelProps {
  /** Admin gets the import section; editors only see exports. */
  canImport: boolean;
}

export default function DataPanel({ canImport }: DataPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [importKind, setImportKind] = useState<ImportKind>("persons-csv");
  const [report, setReport] = useState<ImportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onExport = (kind: ExportKind) => {
    setError(null);
    startTransition(async () => {
      const payload =
        kind === "persons-csv"
          ? await exportPersonsCsv()
          : kind === "relationships-csv"
            ? await exportRelationshipsCsv()
            : await exportGedcom();
      if (!payload.ok || !payload.text || !payload.filename) {
        setError(payload.error ?? "Xuất dữ liệu thất bại.");
        return;
      }
      downloadText(payload.text, payload.filename);
    });
  };

  const onImport = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Hãy chọn một tệp.");
      return;
    }
    setError(null);
    setReport(null);
    startTransition(async () => {
      const text = await file.text();
      const payload =
        importKind === "persons-csv"
          ? await importPersonsCsv(text)
          : importKind === "relationships-csv"
            ? await importRelationshipsCsv(text)
            : await importGedcom(text);
      setReport(payload);
      if (payload.ok) {
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } else if (payload.error) {
        setError(payload.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <p
          className="font-serif text-base mb-3"
          style={{ color: "var(--color-ink)" }}
        >
          Xuất dữ liệu
        </p>
        <div className="flex flex-wrap gap-2">
          <ExportButton
            label="Persons (CSV)"
            onClick={() => onExport("persons-csv")}
            disabled={isPending}
          />
          <ExportButton
            label="Relationships (CSV)"
            onClick={() => onExport("relationships-csv")}
            disabled={isPending}
          />
          <ExportButton
            label="Toàn bộ gia phả (GEDCOM)"
            onClick={() => onExport("gedcom")}
            disabled={isPending}
          />
        </div>
      </div>

      {canImport && (
        <div>
          <p
            className="font-serif text-base mb-3"
            style={{ color: "var(--color-ink)" }}
          >
            Nhập dữ liệu
          </p>
          <div
            className="p-4 space-y-3"
            style={{
              backgroundColor: "var(--color-parchment-warm)",
              borderRadius: "var(--radius-paper)",
              border: "1px solid rgba(26,23,20,0.08)",
            }}
          >
            <label className="text-sm block">
              <span
                className="block mb-1"
                style={{ color: "var(--color-sepia)" }}
              >
                Loại tệp
              </span>
              <select
                value={importKind}
                onChange={(e) => setImportKind(e.target.value as ImportKind)}
                className="w-full px-3 py-2 text-sm"
                style={{
                  backgroundColor: "var(--color-ivory)",
                  border: "1px solid rgba(26,23,20,0.12)",
                  borderRadius: "var(--radius-paper)",
                }}
              >
                <option value="persons-csv">Persons (CSV)</option>
                <option value="relationships-csv">Relationships (CSV)</option>
                <option value="gedcom">GEDCOM</option>
              </select>
            </label>

            <input
              ref={fileRef}
              type="file"
              accept={
                importKind === "gedcom"
                  ? ".ged,.gedcom,text/plain"
                  : ".csv,text/csv"
              }
              className="block w-full text-sm"
            />

            <button
              type="button"
              onClick={onImport}
              disabled={isPending}
              className="px-4 py-2 font-serif text-sm disabled:opacity-50"
              style={{
                backgroundColor: "var(--color-lacquer)",
                color: "var(--color-ivory)",
                borderRadius: "var(--radius-paper)",
              }}
            >
              {isPending ? "Đang nhập…" : "Nhập"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p
          className="text-sm px-3 py-2"
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

      {report && (
        <div
          className="p-4 text-sm"
          style={{
            backgroundColor: "var(--color-ivory)",
            borderRadius: "var(--radius-paper)",
            border: "1px solid rgba(26,23,20,0.08)",
          }}
        >
          <p
            className="font-serif mb-2"
            style={{ color: "var(--color-ink)" }}
          >
            Kết quả nhập
          </p>
          <p style={{ color: "var(--color-sepia)" }}>
            Thêm mới: {report.inserted ?? 0} • Cập nhật: {report.updated ?? 0}{" "}
            • Bỏ qua: {report.skipped ?? 0}
          </p>
          {report.warnings && report.warnings.length > 0 && (
            <ul
              className="mt-3 space-y-1 max-h-48 overflow-y-auto text-xs"
              style={{ color: "var(--color-sepia)" }}
            >
              {report.warnings.map((w, i) => (
                <li key={i}>· {w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ExportButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-2 font-serif text-sm disabled:opacity-50"
      style={{
        backgroundColor: "var(--color-parchment-warm)",
        border: "1px solid rgba(26,23,20,0.18)",
        borderRadius: "var(--radius-paper)",
        color: "var(--color-ink)",
      }}
    >
      {label}
    </button>
  );
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

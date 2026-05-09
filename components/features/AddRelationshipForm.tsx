"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRelationship } from "@/app/actions/relationship";
import type { Person, RelationshipType } from "@/types";

interface AddRelationshipFormProps {
  /** The person whose detail page this form is on. */
  person: Person;
  /** All other persons in the family — for the picker. */
  candidates: Person[];
}

type RelationshipKind =
  | "parent_of_me" // I am the child
  | "child_of_me" // they are the child
  | "spouse"
  | "adopted_child_of_me"
  | "adopted_parent_of_me";

const KIND_LABELS: Record<RelationshipKind, string> = {
  parent_of_me: "Cha hoặc Mẹ của tôi",
  child_of_me: "Con của tôi",
  spouse: "Vợ / Chồng",
  adopted_child_of_me: "Con nuôi của tôi",
  adopted_parent_of_me: "Cha/Mẹ nuôi của tôi",
};

function resolveEdge(
  kind: RelationshipKind,
  selfId: string,
  otherId: string,
): { type: RelationshipType; person_a: string; person_b: string } {
  switch (kind) {
    case "parent_of_me":
      return { type: "biological_child", person_a: otherId, person_b: selfId };
    case "child_of_me":
      return { type: "biological_child", person_a: selfId, person_b: otherId };
    case "adopted_parent_of_me":
      return { type: "adopted_child", person_a: otherId, person_b: selfId };
    case "adopted_child_of_me":
      return { type: "adopted_child", person_a: selfId, person_b: otherId };
    case "spouse":
      return { type: "marriage", person_a: selfId, person_b: otherId };
  }
}

export default function AddRelationshipForm({
  person,
  candidates,
}: AddRelationshipFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<RelationshipKind>("child_of_me");
  const [otherId, setOtherId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 font-serif text-sm"
        style={{
          color: "var(--color-ivory)",
          backgroundColor: "var(--color-lacquer)",
          borderRadius: "var(--radius-paper)",
        }}
      >
        + Thêm quan hệ
      </button>
    );
  }

  const onSubmit = () => {
    setError(null);
    if (!otherId) {
      setError("Vui lòng chọn một thành viên.");
      return;
    }
    const edge = resolveEdge(kind, person.id, otherId);

    startTransition(async () => {
      const result = await createRelationship({
        ...edge,
        note: note || null,
        marriage_order: kind === "spouse" ? 1 : null,
        started_at: null,
        ended_at: null,
      });
      if (!result.ok) {
        setError(result.error ?? "Có lỗi xảy ra.");
        return;
      }
      setOpen(false);
      setOtherId("");
      setNote("");
      router.refresh();
    });
  };

  return (
    <div
      className="p-5 space-y-4"
      style={{
        backgroundColor: "var(--color-parchment-warm)",
        borderRadius: "var(--radius-card)",
        border: "1px solid rgba(26,23,20,0.08)",
      }}
    >
      <p className="font-serif text-base">Thêm quan hệ với {person.full_name}</p>

      <div>
        <label className="block text-sm mb-1.5">Loại quan hệ</label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as RelationshipKind)}
          className={inputClass}
        >
          {Object.entries(KIND_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm mb-1.5">Thành viên</label>
        <select
          value={otherId}
          onChange={(e) => setOtherId(e.target.value)}
          className={inputClass}
        >
          <option value="">— Chọn thành viên —</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
              {c.birth_year ? ` (${c.birth_year})` : ""}
            </option>
          ))}
        </select>
        {candidates.length === 0 && (
          <p
            className="text-xs mt-1"
            style={{ color: "var(--color-sepia)" }}
          >
            Chưa có thành viên nào khác. Hãy thêm thành viên trước.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm mb-1.5">Ghi chú (tuỳ chọn)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputClass}
          placeholder="Vợ thứ hai, kết hôn năm 1990, ..."
        />
      </div>

      {error && (
        <p
          className="text-sm px-3 py-2"
          style={{
            color: "var(--color-lacquer-deep)",
            backgroundColor: "rgba(122,31,44,0.08)",
            borderLeft: "3px solid var(--color-lacquer)",
          }}
        >
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={onSubmit}
          className="px-5 py-2 font-serif text-sm disabled:opacity-60"
          style={{
            color: "var(--color-ivory)",
            backgroundColor: "var(--color-lacquer)",
            borderRadius: "var(--radius-paper)",
          }}
        >
          {isPending ? "Đang lưu…" : "Lưu quan hệ"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="px-5 py-2 font-serif text-sm"
          style={{ color: "var(--color-ink)", backgroundColor: "transparent" }}
        >
          Huỷ
        </button>
      </div>
    </div>
  );
}

const inputClass =
  "w-full px-4 py-2.5 text-base bg-[var(--color-ivory)] " +
  "border border-[rgba(26,23,20,0.12)] rounded-[var(--radius-paper)] " +
  "text-[var(--color-ink)] focus:outline-none";

"use client";

import { useState, useTransition } from "react";
import { deletePerson } from "@/app/actions/member";

export default function DeletePersonButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="px-4 py-2 font-serif text-sm"
        style={{
          color: "var(--color-lacquer)",
          border: "1px solid rgba(122,31,44,0.4)",
          borderRadius: "var(--radius-paper)",
          backgroundColor: "transparent",
        }}
      >
        Xoá thành viên
      </button>
    );
  }

  return (
    <div
      className="flex flex-col gap-3 p-4"
      style={{
        backgroundColor: "rgba(122,31,44,0.06)",
        border: "1px solid rgba(122,31,44,0.25)",
        borderRadius: "var(--radius-paper)",
      }}
    >
      <p className="text-sm">
        Xác nhận xoá <strong>{name}</strong>? Mọi quan hệ liên quan sẽ cũng bị
        xoá. Hành động này không thể hoàn tác.
      </p>
      {error && (
        <p
          className="text-xs"
          style={{ color: "var(--color-lacquer)" }}
        >
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              try {
                await deletePerson(id);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Có lỗi xảy ra.",
                );
              }
            })
          }
          className="px-4 py-2 font-serif text-sm disabled:opacity-60"
          style={{
            backgroundColor: "var(--color-lacquer)",
            color: "var(--color-ivory)",
            borderRadius: "var(--radius-paper)",
          }}
        >
          {isPending ? "Đang xoá…" : "Xác nhận xoá"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          className="px-4 py-2 font-serif text-sm"
          style={{
            color: "var(--color-ink)",
            backgroundColor: "transparent",
          }}
        >
          Huỷ
        </button>
      </div>
    </div>
  );
}

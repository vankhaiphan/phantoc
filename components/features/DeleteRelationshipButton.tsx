"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRelationship } from "@/app/actions/relationship";

export default function DeleteRelationshipButton({
  id,
  personAId,
  personBId,
}: {
  id: string;
  personAId: string;
  personBId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      title="Xoá quan hệ này"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteRelationship(id, personAId, personBId);
          if (result.ok) router.refresh();
        })
      }
      className="text-xs disabled:opacity-50"
      style={{
        color: "var(--color-lacquer)",
        backgroundColor: "transparent",
        padding: "4px 8px",
      }}
    >
      {isPending ? "…" : "Gỡ bỏ"}
    </button>
  );
}

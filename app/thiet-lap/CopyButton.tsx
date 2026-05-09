"use client";

import { useState } from "react";

export default function CopyButton({
  text,
  label = "Sao chép",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard denied; user can select manually */
        }
      }}
      className="inline-flex items-center px-4 py-2 font-serif text-sm transition-all"
      style={{
        backgroundColor: copied ? "var(--color-sage)" : "var(--color-lacquer)",
        color: "var(--color-ivory)",
        borderRadius: "var(--radius-paper)",
      }}
    >
      {copied ? "✓ Đã sao chép" : label}
    </button>
  );
}

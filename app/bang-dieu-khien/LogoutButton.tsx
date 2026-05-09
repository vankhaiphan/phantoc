"use client";

import { useTransition } from "react";
import { signOut } from "@/app/actions/auth";

export default function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={() => startTransition(() => signOut())}
    >
      <button
        type="submit"
        disabled={isPending}
        className="text-sm px-4 py-2 font-serif transition-opacity disabled:opacity-60"
        style={{
          color: "var(--color-ink)",
          border: "1px solid rgba(26,23,20,0.18)",
          borderRadius: "var(--radius-paper)",
          backgroundColor: "transparent",
        }}
      >
        {isPending ? "Đang đăng xuất…" : "Đăng xuất"}
      </button>
    </form>
  );
}

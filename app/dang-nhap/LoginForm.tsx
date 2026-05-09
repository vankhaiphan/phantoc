"use client";

import { useActionState } from "react";
import { signIn, type AuthState } from "@/app/actions/auth";

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState<AuthState | null, FormData>(
    signIn,
    null,
  );

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div>
        <label
          htmlFor="email"
          className="block text-sm mb-2"
          style={{ color: "var(--color-ink)" }}
        >
          Thư điện tử
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          className="w-full px-4 py-3 text-base"
          style={{
            backgroundColor: "var(--color-parchment-warm)",
            border: "1px solid rgba(26,23,20,0.12)",
            borderRadius: "var(--radius-paper)",
            color: "var(--color-ink)",
          }}
          placeholder="ten@example.com"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm mb-2"
          style={{ color: "var(--color-ink)" }}
        >
          Mật khẩu
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full px-4 py-3 text-base"
          style={{
            backgroundColor: "var(--color-parchment-warm)",
            border: "1px solid rgba(26,23,20,0.12)",
            borderRadius: "var(--radius-paper)",
            color: "var(--color-ink)",
          }}
          placeholder="••••••••"
        />
      </div>

      {state?.error && (
        <p
          role="alert"
          className="text-sm px-4 py-3"
          style={{
            backgroundColor: "rgba(122,31,44,0.08)",
            color: "var(--color-lacquer-deep)",
            borderLeft: "3px solid var(--color-lacquer)",
            borderRadius: "var(--radius-paper)",
          }}
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full px-6 py-3 font-serif text-base disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
        style={{
          backgroundColor: "var(--color-lacquer)",
          color: "var(--color-ivory)",
          borderRadius: "var(--radius-paper)",
        }}
      >
        {isPending ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
    </form>
  );
}

import Link from "next/link";
import config from "../config";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-block font-display text-3xl mb-1"
          style={{ color: "var(--color-ink)" }}
        >
          {config.siteName}
        </Link>
        <p
          className="font-serif italic text-base mb-10"
          style={{ color: "var(--color-sepia)" }}
        >
          {config.siteSubtitle}
        </p>

        <div
          className="p-8"
          style={{
            backgroundColor: "var(--color-ivory)",
            borderRadius: "var(--radius-card)",
            boxShadow:
              "0 1px 0 rgba(26,23,20,0.04), 0 4px 14px rgba(26,23,20,0.05)",
          }}
        >
          <h1 className="font-serif text-2xl mb-2">Đăng nhập</h1>
          {/* <p
            className="text-sm mb-8"
            style={{ color: "var(--color-sepia)" }}
          >
            Tài khoản đầu tiên đăng ký sẽ tự động trở thành Trưởng tộc (admin).
            Nếu chưa có máy chủ, hãy xem{" "}
            <Link
              href="/thiet-lap"
              className="underline underline-offset-4"
              style={{ color: "var(--color-lacquer)" }}
            >
              hướng dẫn thiết lập
            </Link>
            .
          </p> */}

          <LoginForm />
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-sm"
            style={{ color: "var(--color-sepia)" }}
          >
            ← Trở về trang chủ
          </Link>
        </div>
      </div>
    </main>
  );
}

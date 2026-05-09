import Link from "next/link";
import config from "../config";

export default function MissingDbConfigPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="max-w-2xl">
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
            borderLeft: "3px solid var(--color-lacquer)",
          }}
        >
          <h1 className="font-serif text-2xl mb-4">
            Cần cấu hình máy chủ Supabase
          </h1>
          <p className="leading-relaxed mb-6">
            Ứng dụng chưa tìm thấy cấu hình kết nối đến Supabase. Để khởi
            động, vui lòng tạo file <code className="font-mono">.env.local</code>{" "}
            ở thư mục gốc của dự án và điền các giá trị sau:
          </p>

          <pre
            className="custom-scrollbar overflow-auto p-5 text-sm leading-relaxed mb-6"
            style={{
              backgroundColor: "#1B1814",
              color: "#EFE6D2",
              borderRadius: "var(--radius-paper)",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}
          >
{`NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY="your-anon-key"
SITE_NAME="Phan Tộc"
SITE_SUBTITLE="Gia Phả Họ Phan"`}
          </pre>

          <p className="leading-relaxed text-sm" style={{ color: "var(--color-sepia)" }}>
            Hai giá trị Supabase được lấy từ{" "}
            <strong>Project Settings → API</strong> trong dự án Supabase. Sau
            khi cập nhật <code className="font-mono">.env.local</code>, hãy khởi
            động lại máy chủ phát triển (<code className="font-mono">bun run dev</code>).
          </p>
        </div>
      </div>
    </main>
  );
}

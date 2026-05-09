import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import config from "../config";
import CopyButton from "./CopyButton";

const MIGRATION_FILENAME = "20260509120000_phantoc_init.sql";
const SEED_FILENAME = "seed.sql";

async function readSqlFile(relPath: string): Promise<string> {
  try {
    const fullPath = path.join(process.cwd(), "supabase", relPath);
    return await fs.readFile(fullPath, "utf-8");
  } catch {
    return "-- Không tìm thấy file. Vui lòng kiểm tra thư mục supabase/.";
  }
}

export default async function SetupPage() {
  const [migrationSql, seedSql] = await Promise.all([
    readSqlFile(`migrations/${MIGRATION_FILENAME}`),
    readSqlFile(SEED_FILENAME),
  ]);

  return (
    <main className="min-h-screen px-6 py-16 max-w-6xl mx-auto">
      <Link
        href="/"
        className="text-sm"
        style={{ color: "var(--color-sepia)" }}
      >
        ← {config.siteName}
      </Link>

      <header className="mt-6 mb-12">
        <h1
          className="font-display font-bold text-4xl md:text-5xl"
          style={{ color: "var(--color-ink)" }}
        >
          Thiết lập máy chủ
        </h1>
        <p
          className="font-serif italic mt-3 text-lg"
          style={{ color: "var(--color-sepia)" }}
        >
          Khởi tạo cơ sở dữ liệu Supabase cho gia phả.
        </p>
        <div className="divider-rosette mt-8 w-full" />
      </header>

      <section className="grid lg:grid-cols-[420px_1fr] gap-10">
        {/* Instructions */}
        <aside className="space-y-8">
          <div>
            <h2 className="font-serif text-xl mb-4">Các bước</h2>
            <ol className="space-y-5 text-base">
              <Step n={1}>
                Tạo dự án mới trên{" "}
                <a
                  href="https://supabase.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                  style={{ color: "var(--color-lacquer)" }}
                >
                  supabase.com
                </a>{" "}
                (miễn phí). Đợi 1–2 phút cho hệ thống khởi tạo.
              </Step>
              <Step n={2}>
                Vào <strong>Project Settings → API</strong>, lưu lại{" "}
                <code className="font-mono text-sm">Project URL</code> và{" "}
                <code className="font-mono text-sm">anon / public key</code>.
                Đưa hai giá trị này vào file <code>.env.local</code>.
              </Step>
              <Step n={3}>
                Mở <strong>SQL Editor</strong> trong dự án Supabase. Sao chép
                và chạy lần lượt hai file SQL bên cạnh — <em>migration</em>{" "}
                trước, <em>seed</em> sau.
              </Step>
              <Step n={4}>
                Quay về trang này và truy cập{" "}
                <Link
                  href="/dang-nhap"
                  className="underline underline-offset-4"
                  style={{ color: "var(--color-lacquer)" }}
                >
                  /dang-nhap
                </Link>{" "}
                để tạo tài khoản đầu tiên — sẽ tự động trở thành quản trị viên
                (Trưởng tộc).
              </Step>
            </ol>
          </div>

          <aside
            className="p-5 text-sm"
            style={{
              backgroundColor: "var(--color-parchment-warm)",
              borderRadius: "var(--radius-card)",
              borderLeft: "3px solid var(--color-gold)",
            }}
          >
            <p className="font-serif font-medium mb-1">Lưu ý</p>
            <p style={{ color: "var(--color-sepia)" }}>
              Toàn bộ dữ liệu sẽ nằm trong tài khoản Supabase của gia đình bạn.
              Không có ai khác — kể cả tác giả ứng dụng — có thể truy cập.
            </p>
          </aside>
        </aside>

        {/* SQL panes */}
        <div className="space-y-10">
          <SqlPane
            title="1. Migration"
            filename={MIGRATION_FILENAME}
            description="Tạo bảng, chỉ mục, RLS, trigger, và các hàm RPC cần thiết."
            sql={migrationSql}
          />
          <SqlPane
            title="2. Seed"
            filename={SEED_FILENAME}
            description="Khởi tạo chi tộc gốc — Chi tộc Phan, làng Cẩm Nê."
            sql={seedSql}
          />
        </div>
      </section>
    </main>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span
        className="flex-none w-7 h-7 rounded-full flex items-center justify-center font-serif text-sm"
        style={{
          backgroundColor: "var(--color-lacquer)",
          color: "var(--color-ivory)",
        }}
      >
        {n}
      </span>
      <div className="leading-relaxed pt-0.5">{children}</div>
    </li>
  );
}

function SqlPane({
  title,
  filename,
  description,
  sql,
}: {
  title: string;
  filename: string;
  description: string;
  sql: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h3 className="font-serif text-xl">{title}</h3>
          <p className="text-sm mt-1" style={{ color: "var(--color-sepia)" }}>
            {description}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <code className="font-mono text-xs" style={{ color: "var(--color-sepia)" }}>
            supabase/{title === "1. Migration" ? "migrations/" : ""}
            {filename}
          </code>
          <CopyButton text={sql} />
        </div>
      </div>
      <pre
        className="custom-scrollbar overflow-auto p-5 text-sm leading-relaxed"
        style={{
          backgroundColor: "#1B1814",
          color: "#EFE6D2",
          borderRadius: "var(--radius-card)",
          maxHeight: "560px",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
        }}
      >
        <code>{sql}</code>
      </pre>
    </div>
  );
}

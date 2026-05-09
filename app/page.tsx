import Link from "next/link";
import config from "./config";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <section className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-16 sm:py-24">
        <div className="max-w-2xl text-center w-full">
          <p
            lang="zh-Hant"
            className="text-sm tracking-[0.5em] mb-8 sm:mb-10 opacity-60"
            style={{ color: "var(--color-gold)" }}
          >
            潘氏家譜
          </p>

          <h1
            className="font-display font-bold tracking-tight"
            style={{
              fontSize: "clamp(2.5rem, 12vw, 4.768rem)",
              color: "var(--color-ink)",
              lineHeight: 1.05,
            }}
          >
            {config.siteName}
          </h1>

          <p
            className="font-serif italic mt-3 sm:mt-4"
            style={{
              fontSize: "clamp(1.125rem, 3.5vw, 1.563rem)",
              color: "var(--color-sepia)",
            }}
          >
            {config.siteSubtitle}
          </p>

          <div className="divider-rosette mx-auto my-8 sm:my-10 w-32" />

          <p
            className="text-base sm:text-lg leading-relaxed"
            style={{ color: "var(--color-ink)", opacity: 0.86 }}
          >
            Gia phả số dành riêng cho{" "}
            <span className="font-medium">{config.foundingChi.name}</span>,{" "}
            {config.foundingChi.locality}, {config.foundingChi.country}.
          </p>
          <p
            className="mt-3 sm:mt-4 leading-relaxed text-sm sm:text-base"
            style={{ color: "var(--color-sepia)" }}
          >
            Nơi để ghi nhớ tổ tiên, lưu giữ câu chuyện, và truyền lại cho con
            cháu mai sau.
          </p>

          <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/cay"
              className="inline-flex items-center justify-center px-6 py-3 font-serif text-base transition-all duration-300"
              style={{
                backgroundColor: "var(--color-lacquer)",
                color: "var(--color-ivory)",
                borderRadius: "var(--radius-paper)",
                minHeight: 48,
              }}
            >
              Mở gia phả
            </Link>
            <Link
              href="/danh-xung"
              className="inline-flex items-center justify-center px-6 py-3 font-serif text-base transition-all duration-300"
              style={{
                color: "var(--color-ink)",
                border: "1px solid rgba(26,23,20,0.18)",
                borderRadius: "var(--radius-paper)",
                minHeight: 48,
              }}
            >
              Tra cứu danh xưng
            </Link>
            <Link
              href="/dang-nhap"
              className="inline-flex items-center justify-center px-6 py-3 font-serif text-base transition-all duration-300"
              style={{
                color: "var(--color-ink)",
                borderRadius: "var(--radius-paper)",
                opacity: 0.7,
                minHeight: 48,
              }}
            >
              Đăng nhập
            </Link>
          </div>
        </div>
      </section>

      <footer
        className="px-4 sm:px-6 py-6 sm:py-8 text-center text-sm"
        style={{
          color: "var(--color-sepia)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)",
        }}
      >
        <div className="divider-rosette mx-auto mb-6 w-24" />
        <p>
          © {new Date().getFullYear()} {config.foundingChi.family} - {config.foundingChi.name}. Lưu giữ riêng cho dòng họ.
        </p>
      </footer>
    </main>
  );
}

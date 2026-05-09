import Link from "next/link";
import { getUser, getProfile, getSupabase } from "@/lib/supabase/queries";
import config from "../config";
import LogoutButton from "./LogoutButton";

const ROLE_LABEL: Record<string, string> = {
  admin: "Trưởng tộc (Admin)",
  editor: "Người biên soạn (Editor)",
  member: "Thành viên (Member)",
};

export default async function DashboardPage() {
  const user = await getUser();
  const profile = await getProfile();

  // Middleware redirects unauthenticated users to /dang-nhap; defensive only.
  if (!user) {
    return null;
  }

  const supabase = await getSupabase();
  const [{ count: memberCount }, { count: relationshipCount }] =
    await Promise.all([
      supabase.from("persons").select("*", { count: "exact", head: true }),
      supabase.from("relationships").select("*", { count: "exact", head: true }),
    ]);

  return (
    <main className="min-h-screen px-6 py-16 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="text-sm"
          style={{ color: "var(--color-sepia)" }}
        >
          ← {config.siteName}
        </Link>
        <LogoutButton />
      </div>

      <header className="mt-6 mb-12">
        <h1
          className="font-display font-bold text-4xl"
          style={{ color: "var(--color-ink)" }}
        >
          Xin chào,
          <span className="font-serif italic font-normal ml-3">
            {user.email}
          </span>
        </h1>
        <p
          className="font-serif italic mt-3"
          style={{ color: "var(--color-sepia)" }}
        >
          Bảng điều khiển — {config.foundingChi.name}
        </p>
        <div className="divider-rosette mt-8 w-full" />
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <DashCard
          href="/bang-dieu-khien/thanh-vien"
          title="Thành viên"
          count={memberCount ?? 0}
          countLabel="người"
          description="Thêm, sửa, xoá thành viên trong gia phả."
        />
        <DashCard
          href="/bang-dieu-khien/thanh-vien"
          title="Quan hệ"
          count={relationshipCount ?? 0}
          countLabel="quan hệ"
          description="Cha mẹ – con, hôn nhân, nhận nuôi."
        />
        <DashCard
          href="/cay"
          title="Sơ đồ phả hệ"
          count={memberCount ?? 0}
          countLabel="người trên cây"
          description="Xem cây phả hệ, kéo & thu phóng để duyệt."
        />
        <DashCard
          href="/danh-xung"
          title="Tra cứu danh xưng"
          count={memberCount ?? 0}
          countLabel="người để chọn"
          description="Tìm cách hai người trong họ gọi nhau."
        />
      </section>

      <section
        className="p-6"
        style={{
          backgroundColor: "var(--color-ivory)",
          borderRadius: "var(--radius-card)",
        }}
      >
        <p className="font-serif text-lg mb-4">Tài khoản</p>
        <dl className="grid grid-cols-[160px_1fr] gap-y-2 text-sm">
          <dt style={{ color: "var(--color-sepia)" }}>Vai trò</dt>
          <dd>
            {profile?.role ? ROLE_LABEL[profile.role] ?? profile.role : "—"}
          </dd>
          <dt style={{ color: "var(--color-sepia)" }}>Trạng thái</dt>
          <dd>
            {profile?.is_active ? (
              <span style={{ color: "var(--color-sage)" }}>Đã kích hoạt</span>
            ) : (
              <span style={{ color: "var(--color-lacquer)" }}>
                Chưa kích hoạt
              </span>
            )}
          </dd>
          <dt style={{ color: "var(--color-sepia)" }}>Mã định danh</dt>
          <dd className="font-mono text-xs">{user.id}</dd>
        </dl>
      </section>
    </main>
  );
}

function DashCard({
  href,
  title,
  count,
  countLabel,
  description,
}: {
  href: string;
  title: string;
  count: number;
  countLabel: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block p-6 transition-shadow"
      style={{
        backgroundColor: "var(--color-ivory)",
        borderRadius: "var(--radius-card)",
        boxShadow: "0 1px 0 rgba(26,23,20,0.04)",
      }}
    >
      <p
        className="font-serif text-lg mb-1"
        style={{ color: "var(--color-ink)" }}
      >
        {title}
      </p>
      <p className="mb-3">
        <span
          className="font-display text-3xl tabular-nums"
          style={{ color: "var(--color-lacquer)" }}
        >
          {count}
        </span>
        <span
          className="ml-2 text-sm"
          style={{ color: "var(--color-sepia)" }}
        >
          {countLabel}
        </span>
      </p>
      <p
        className="text-sm leading-relaxed"
        style={{ color: "var(--color-sepia)" }}
      >
        {description}
      </p>
    </Link>
  );
}

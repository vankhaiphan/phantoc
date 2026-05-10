import Link from "next/link";
import { getUser, getProfile, getSupabase } from "@/lib/supabase/queries";
import config from "../config";
import LogoutButton from "./LogoutButton";
import DataPanel from "@/components/features/DataPanel";
import {
  formatSolarDate,
  solarToLunar,
  nextSolarOfLunarAnniversary,
  daysBetween,
} from "@/lib/lunar";

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
  const [{ count: memberCount }, { count: relationshipCount }, { data: deceased }] =
    await Promise.all([
      supabase.from("persons").select("*", { count: "exact", head: true }),
      supabase.from("relationships").select("*", { count: "exact", head: true }),
      supabase
        .from("persons")
        .select(
          "id, full_name, death_year, death_month, death_day, death_lunar_month, death_lunar_day",
        )
        .eq("is_deceased", true),
    ]);

  const today = new Date();
  type GioRow = {
    id: string;
    full_name: string;
    death_year: number | null;
    death_month: number | null;
    death_day: number | null;
    death_lunar_month: number | null;
    death_lunar_day: number | null;
  };
  const upcomingGio = (((deceased ?? []) as GioRow[])
    .map((d) => {
      let lunarMonth = d.death_lunar_month ?? null;
      let lunarDay = d.death_lunar_day ?? null;
      if (
        (!lunarMonth || !lunarDay) &&
        d.death_year &&
        d.death_month &&
        d.death_day
      ) {
        const derived = solarToLunar({
          year: d.death_year,
          month: d.death_month,
          day: d.death_day,
        });
        if (derived) {
          lunarMonth = derived.month;
          lunarDay = derived.day;
        }
      }
      if (!lunarMonth || !lunarDay) return null;
      const next = nextSolarOfLunarAnniversary(
        lunarMonth,
        lunarDay,
        today,
        false,
      );
      if (!next) return null;
      const daysAway = daysBetween(today, next);
      if (daysAway < 0 || daysAway > 90) return null;
      return { id: d.id, name: d.full_name, date: next, daysAway };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null))
    .sort((a, b) => a.daysAway - b.daysAway)
    .slice(0, 5);

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

      {upcomingGio.length > 0 && (
        <section
          className="p-6 mb-10"
          style={{
            backgroundColor: "var(--color-ivory)",
            borderRadius: "var(--radius-card)",
          }}
        >
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <p className="font-serif text-lg">Giỗ sắp tới</p>
            <span
              className="text-xs"
              style={{ color: "var(--color-sepia)" }}
            >
              90 ngày tới
            </span>
          </div>
          <ul className="divide-y divide-[rgba(26,23,20,0.08)]">
            {upcomingGio.map((g) => (
              <li
                key={g.id}
                className="py-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
              >
                <Link
                  href={`/bang-dieu-khien/thanh-vien/${g.id}`}
                  className="font-serif text-base"
                  style={{ color: "var(--color-ink)" }}
                >
                  {g.name}
                </Link>
                <span
                  className="text-sm tabular-nums"
                  style={{ color: "var(--color-sepia)" }}
                >
                  {formatSolarDate(g.date)}
                  <span
                    className="ml-2"
                    style={{ color: "var(--color-lacquer)" }}
                  >
                    {g.daysAway === 0
                      ? "hôm nay"
                      : g.daysAway === 1
                        ? "ngày mai"
                        : `còn ${g.daysAway} ngày`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(profile?.role === "editor" || profile?.role === "admin") && (
        <section
          className="p-6 mb-10"
          style={{
            backgroundColor: "var(--color-ivory)",
            borderRadius: "var(--radius-card)",
          }}
        >
          <p className="font-serif text-lg mb-4">Xuất / Nhập dữ liệu</p>
          <DataPanel canImport={profile?.role === "admin"} />
        </section>
      )}

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

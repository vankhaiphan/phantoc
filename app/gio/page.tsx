import Link from "next/link";
import { getSupabase } from "@/lib/supabase/queries";
import config from "../config";
import {
  formatSolarDate,
  formatLunarDate,
  solarToLunar,
  nextSolarOfLunarAnniversary,
  daysBetween,
} from "@/lib/lunar";
import type { Metadata } from "next";

export const revalidate = 0;

export const metadata: Metadata = {
  title: `Giỗ sắp tới — ${config.siteName}`,
  description: "Lịch giỗ sắp tới của các thành viên trong gia phả.",
};

type GioRow = {
  id: string;
  full_name: string;
  death_year: number | null;
  death_month: number | null;
  death_day: number | null;
  death_lunar_month: number | null;
  death_lunar_day: number | null;
};

export default async function GioPage() {
  const supabase = await getSupabase();

  const { data: deceased } = await supabase
    .from("persons_public_view")
    .select(
      "id, full_name, death_year, death_month, death_day, death_lunar_month, death_lunar_day",
    )
    .eq("is_deceased", true);

  const today = new Date();

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
      const next = nextSolarOfLunarAnniversary(lunarMonth, lunarDay, today, false);
      if (!next) return null;
      const daysAway = daysBetween(today, next);
      if (daysAway < 0) return null;

      // Lunar date for display
      const lunarDisplay = solarToLunar({
        year: next.year,
        month: next.month,
        day: next.day,
      });

      return { id: d.id, name: d.full_name, date: next, lunarDisplay, daysAway };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null))
    .sort((a, b) => a.daysAway - b.daysAway);

  // Group into: today/this week (≤7d), this month (≤30d), rest (≤365d)
  const groups = [
    {
      label: "Trong 7 ngày tới",
      items: upcomingGio.filter((g) => g.daysAway <= 7),
    },
    {
      label: "Trong tháng này",
      items: upcomingGio.filter((g) => g.daysAway > 7 && g.daysAway <= 30),
    },
    {
      label: "Trong 3 tháng tới",
      items: upcomingGio.filter((g) => g.daysAway > 30 && g.daysAway <= 90),
    },
    {
      label: "Trong năm tới",
      items: upcomingGio.filter((g) => g.daysAway > 90 && g.daysAway <= 365),
    },
  ].filter((g) => g.items.length > 0);

  return (
    <main className="min-h-screen px-4 sm:px-6 py-6 sm:py-12 max-w-3xl mx-auto">
      {/* Nav */}
      <div className="flex items-center justify-between gap-4 mb-8 sm:mb-10">
        <Link
          href="/"
          className="text-sm py-2"
          style={{ color: "var(--color-sepia)", minHeight: 32 }}
        >
          ← {config.siteName}
        </Link>
        <Link
          href="/cay"
          className="text-sm py-2"
          style={{ color: "var(--color-sepia)", minHeight: 32 }}
        >
          Sơ đồ phả hệ →
        </Link>
      </div>

      <header className="mb-8 sm:mb-10">
        <h1
          className="font-display font-bold"
          style={{
            fontSize: "clamp(2rem, 7vw, 3.5rem)",
            color: "var(--color-ink)",
            lineHeight: 1.1,
          }}
        >
          Giỗ sắp tới
        </h1>
        <p
          className="font-serif italic mt-2 text-base sm:text-lg"
          style={{ color: "var(--color-sepia)" }}
        >
          {config.foundingChi.name}
        </p>
      </header>

      <div className="divider-rosette mb-8 sm:mb-10 w-full" />

      {upcomingGio.length === 0 ? (
        <p className="font-serif text-lg" style={{ color: "var(--color-sepia)" }}>
          Không có giỗ nào trong năm tới.
        </p>
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.label}>
              <h2
                className="font-serif text-sm uppercase tracking-widest mb-4"
                style={{ color: "var(--color-sepia)" }}
              >
                {group.label}
              </h2>
              <ul className="space-y-2">
                {group.items.map((g) => (
                  <li
                    key={g.id}
                    style={{
                      backgroundColor: "var(--color-ivory)",
                      border: "1px solid rgba(26,23,20,0.06)",
                      borderRadius: "var(--radius-paper)",
                    }}
                  >
                    <Link
                      href={`/thanh-vien/${g.id}`}
                      className="block p-4 sm:p-5"
                    >
                      {/* Row 1 — name + countdown badge */}
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className="font-serif text-base sm:text-lg leading-snug"
                          style={{ color: "var(--color-ink)" }}
                        >
                          {g.name}
                        </span>
                        <span
                          className="shrink-0 text-xs font-medium px-2 py-1 rounded"
                          style={{
                            backgroundColor: g.daysAway <= 7
                              ? "rgba(122,31,44,0.10)"
                              : "rgba(139,115,85,0.10)",
                            color: g.daysAway <= 7
                              ? "var(--color-lacquer)"
                              : "var(--color-sepia)",
                            borderRadius: "var(--radius-paper)",
                          }}
                        >
                          {g.daysAway === 0
                            ? "Hôm nay"
                            : g.daysAway === 1
                              ? "Ngày mai"
                              : `Còn ${g.daysAway} ngày`}
                        </span>
                      </div>

                      {/* Row 2 — dates */}
                      <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm tabular-nums">
                        <span style={{ color: "var(--color-sepia)" }}>
                          <span className="opacity-60 text-xs mr-1">Dương lịch:</span>
                          {formatSolarDate(g.date)}
                        </span>
                        {g.lunarDisplay && (
                          <span style={{ color: "var(--color-sepia)" }}>
                            <span className="opacity-60 text-xs mr-1">Âm lịch:</span>
                            {formatLunarDate(g.lunarDisplay)}
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase, getUser } from "@/lib/supabase/queries";
import PersonRelationships from "@/components/features/PersonRelationships";
import config from "../../config";
import {
  formatSolarDate,
  formatLunarDate,
  solarToLunar,
  nextSolarOfLunarAnniversary,
  daysBetween,
} from "@/lib/lunar";
import type { Person, Branch, Relationship } from "@/types";

export const revalidate = 0;

const GENDER_LABEL: Record<Person["gender"], string> = {
  male: "Nam",
  female: "Nữ",
  other: "—",
};

/**
 * Public member detail page. Authenticated users read `persons` directly;
 * anonymous visitors read `persons_public_view`, which exposes name, gender,
 * generation, branch, full birth/death dates (solar + lunar) and the in-law
 * flag. The free-text `note` and the private detail tables stay hidden.
 * The editor's detail page lives at /bang-dieu-khien/thanh-vien/[id].
 */
export default async function PublicPersonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabase();
  const user = await getUser();

  // Anon visitors query the redacted public view; authenticated users see the full record.
  const personsSource = user ? "persons" : "persons_public_view";

  const [{ data: person }, { data: branches }, { data: relationships }, { data: allRelated }] = await Promise.all([
    supabase.from(personsSource).select("*").eq("id", id).single(),
    supabase.from("branches").select("*"),
    supabase
      .from("relationships")
      .select("*")
      .or(`person_a.eq.${id},person_b.eq.${id}`),
    supabase.from(personsSource).select("id, full_name, gender, is_deceased, generation, birth_order, branch_id, is_in_law"),
  ]);

  if (!person) notFound();

  const p = person as Person;
  const rels = (relationships ?? []) as Relationship[];
  const personsById = new Map(
    ((allRelated ?? []) as Person[]).map((x) => [x.id, x]),
  );

  const branch = ((branches ?? []) as Branch[]).find(
    (b) => b.id === p.branch_id,
  );

  const birthLunar = solarToLunar({
    year: p.birth_year ?? undefined,
    month: p.birth_month ?? undefined,
    day: p.birth_day ?? undefined,
  });

  const explicitDeathLunar =
    p.death_lunar_year || p.death_lunar_month || p.death_lunar_day
      ? {
          year: p.death_lunar_year ?? undefined,
          month: p.death_lunar_month ?? undefined,
          day: p.death_lunar_day ?? undefined,
          isLeap: false,
        }
      : null;
  const derivedDeathLunar = explicitDeathLunar
    ? null
    : solarToLunar({
        year: p.death_year ?? undefined,
        month: p.death_month ?? undefined,
        day: p.death_day ?? undefined,
      });
  const deathLunar = explicitDeathLunar ?? derivedDeathLunar;

  let nextGio: {
    date: { year: number; month: number; day: number };
    daysAway: number;
  } | null = null;
  if (p.is_deceased && deathLunar?.month && deathLunar?.day) {
    const next = nextSolarOfLunarAnniversary(
      deathLunar.month,
      deathLunar.day,
      new Date(),
      deathLunar.isLeap ?? false,
    );
    if (next) {
      nextGio = { date: next, daysAway: daysBetween(new Date(), next) };
    }
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 py-6 sm:py-12 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6 sm:mb-8">
        <Link
          href="/cay"
          className="text-sm py-2"
          style={{ color: "var(--color-sepia)", minHeight: 32 }}
        >
          ← Sơ đồ phả hệ
        </Link>
        <Link
          href="/"
          className="text-sm font-display py-2"
          style={{ color: "var(--color-ink)", minHeight: 32 }}
        >
          {config.siteName}
        </Link>
      </div>

      <header className="mb-8 sm:mb-10">
        <h1
          className="font-display font-bold"
          style={{
            fontSize: "clamp(2rem, 7vw, 3.5rem)",
            color: p.is_deceased ? "var(--color-sepia)" : "var(--color-ink)",
            lineHeight: 1.1,
            wordBreak: "keep-all",
          }}
        >
          {p.full_name}
        </h1>
        {p.other_names && (
          <p
            className="font-serif italic mt-2 text-base sm:text-lg"
            style={{ color: "var(--color-sepia)" }}
          >
            {p.other_names}
          </p>
        )}
      </header>

      <div className="divider-rosette mb-6 sm:mb-8 w-full" />

      <section
        className="p-4 sm:p-6"
        style={{
          backgroundColor: "var(--color-ivory)",
          borderRadius: "var(--radius-card)",
        }}
      >
        {/* Single column on mobile (label above value), two columns on sm+ */}
        <dl className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-y-3 sm:gap-y-3 text-sm">
          <Dt>Giới tính</Dt>
          <Dd>{GENDER_LABEL[p.gender]}</Dd>

          {branch && (
            <>
              <Dt>Chi tộc</Dt>
              <Dd>{branch.name}</Dd>
            </>
          )}

          {p.generation != null && (
            <>
              <Dt>Thế hệ</Dt>
              <Dd>{p.generation}</Dd>
            </>
          )}

          {(p.birth_year || p.birth_month || p.birth_day) && (
            <>
              <Dt>Sinh</Dt>
              <Dd>
                {formatSolarDate({
                  year: p.birth_year ?? undefined,
                  month: p.birth_month ?? undefined,
                  day: p.birth_day ?? undefined,
                })}
              </Dd>
              {birthLunar && (
                <>
                  <Dt>Sinh (âm lịch)</Dt>
                  <Dd>{formatLunarDate(birthLunar)}</Dd>
                </>
              )}
            </>
          )}

          {p.is_deceased &&
            (p.death_year || p.death_month || p.death_day) && (
              <>
                <Dt>Mất (dương lịch)</Dt>
                <Dd>
                  {formatSolarDate({
                    year: p.death_year ?? undefined,
                    month: p.death_month ?? undefined,
                    day: p.death_day ?? undefined,
                  })}
                </Dd>
              </>
            )}

          {p.is_deceased &&
            deathLunar &&
            (deathLunar.year || deathLunar.month || deathLunar.day) && (
              <>
                <Dt>Giỗ (âm lịch)</Dt>
                <Dd>
                  {formatLunarDate(deathLunar)}
                  {!explicitDeathLunar && (
                    <span
                      className="ml-2 italic text-xs"
                      style={{ color: "var(--color-sepia)" }}
                    >
                      (tự suy ra)
                    </span>
                  )}
                </Dd>
              </>
            )}

          {nextGio && (
            <>
              <Dt>Giỗ tới (dương lịch)</Dt>
              <Dd>
                {formatSolarDate(nextGio.date)}
                <span
                  className="ml-2 text-xs"
                  style={{ color: "var(--color-lacquer)" }}
                >
                  {nextGio.daysAway === 0
                    ? "— hôm nay"
                    : nextGio.daysAway === 1
                      ? "— ngày mai"
                      : `— còn ${nextGio.daysAway} ngày`}
                </span>
              </Dd>
            </>
          )}

          {p.is_in_law && (
            <>
              <Dt>Ghi nhận</Dt>
              <Dd>Dâu / rể (kết hôn vào dòng họ)</Dd>
            </>
          )}
        </dl>

        {p.note && (
          <div className="mt-6 pt-6 border-t border-[rgba(26,23,20,0.08)]">
            <p
              className="font-serif text-sm mb-2"
              style={{ color: "var(--color-sepia)" }}
            >
              Ghi chú
            </p>
            <p className="text-base whitespace-pre-wrap leading-relaxed">
              {p.note}
            </p>
          </div>
        )}
      </section>

      {rels.length > 0 && (
        <section className="mt-6 mb-6">
          <div className="mb-6">
            <h2
              className="font-display text-2xl"
              style={{ color: "var(--color-ink)" }}
            >
              Quan hệ
            </h2>
          </div>
          <PersonRelationships
            person={p}
            relationships={rels}
            personsById={personsById}
            readOnly
          />
        </section>
      )}

      {user && (
        <div className="mt-8 text-center">
          <Link
            href={`/bang-dieu-khien/thanh-vien/${p.id}`}
            className="inline-block text-sm font-serif px-4 py-2"
            style={{ color: "var(--color-lacquer)", minHeight: 40 }}
          >
            Xem chi tiết & chỉnh sửa →
          </Link>
        </div>
      )}
    </main>
  );
}

function Dt({ children }: { children: React.ReactNode }) {
  return (
    <dt
      className="text-xs sm:text-sm tracking-wider sm:tracking-normal uppercase sm:normal-case"
      style={{ color: "var(--color-sepia)" }}
    >
      {children}
    </dt>
  );
}
function Dd({ children }: { children: React.ReactNode }) {
  return <dd className="mb-2 sm:mb-0">{children}</dd>;
}

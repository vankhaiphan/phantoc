import Link from "next/link";
import { notFound } from "next/navigation";
import { getIsAdmin, getIsEditor, getSupabase } from "@/lib/supabase/queries";
import PersonRelationships from "@/components/features/PersonRelationships";
import AddRelationshipForm from "@/components/features/AddRelationshipForm";
import DeletePersonButton from "@/components/features/DeletePersonButton";
import PhotoGallery from "@/components/features/PhotoGallery";
import DocumentList from "@/components/features/DocumentList";
import {
  formatSolarDate,
  formatLunarDate,
  solarToLunar,
  nextSolarOfLunarAnniversary,
  daysBetween,
} from "@/lib/lunar";
import type {
  Person,
  Relationship,
  Branch,
  PersonPhoto,
  PersonDocument,
} from "@/types";

export const revalidate = 0;

const GENDER_LABEL: Record<Person["gender"], string> = {
  male: "Nam",
  female: "Nữ",
  other: "—",
};

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabase();

  const [
    { data: person },
    { data: allPersons },
    { data: relationships },
    { data: branches },
    { data: photos },
    { data: documents },
    isEditor,
    isAdmin,
  ] = await Promise.all([
    supabase.from("persons").select("*").eq("id", id).single(),
    supabase.from("persons").select("*"),
    supabase
      .from("relationships")
      .select("*")
      .or(`person_a.eq.${id},person_b.eq.${id}`),
    supabase.from("branches").select("*"),
    supabase
      .from("person_photos")
      .select("*")
      .eq("person_id", id)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("person_documents")
      .select("*")
      .eq("person_id", id)
      .order("created_at", { ascending: false }),
    getIsEditor(),
    getIsAdmin(),
  ]);

  if (!person) notFound();

  const p = person as Person;
  const persons = (allPersons ?? []) as Person[];
  const personsById = new Map(persons.map((x) => [x.id, x]));
  const candidates = persons.filter((x) => x.id !== id);
  const branch = ((branches ?? []) as Branch[]).find(
    (b) => b.id === p.branch_id,
  );

  const photoRows = (photos ?? []) as PersonPhoto[];
  const documentRows = (documents ?? []) as PersonDocument[];

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

  // Resolve public URLs for the avatars bucket up-front so the client component
  // doesn't need a Supabase client of its own. The avatars bucket is public
  // (see migration §STORAGE BUCKETS), so getPublicUrl is enough.
  const publicUrls: Record<string, string> = {};
  for (const ph of photoRows) {
    const { data } = supabase.storage.from("avatars").getPublicUrl(ph.storage_path);
    publicUrls[ph.storage_path] = data.publicUrl;
  }

  return (
    <main className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
      <Link
        href="/bang-dieu-khien/thanh-vien"
        className="text-sm"
        style={{ color: "var(--color-sepia)" }}
      >
        ← Thành viên
      </Link>

      <header className="mt-6 mb-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1
              className="font-display font-bold"
              style={{
                fontSize: "clamp(2.5rem, 6vw, 3.5rem)",
                color: p.is_deceased
                  ? "var(--color-sepia)"
                  : "var(--color-ink)",
                lineHeight: 1.1,
              }}
            >
              {p.full_name}
            </h1>
            {p.other_names && (
              <p
                className="font-serif italic mt-2 text-lg"
                style={{ color: "var(--color-sepia)" }}
              >
                {p.other_names}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/bang-dieu-khien/thanh-vien/${p.id}/sua`}
              className="px-4 py-2 font-serif text-sm"
              style={{
                backgroundColor: "var(--color-parchment-warm)",
                color: "var(--color-ink)",
                border: "1px solid rgba(26,23,20,0.18)",
                borderRadius: "var(--radius-paper)",
              }}
            >
              Sửa
            </Link>
          </div>
        </div>
      </header>

      <div className="divider-rosette mb-10 w-full" />

      {/* Basic info */}
      <section
        className="p-6 mb-10"
        style={{
          backgroundColor: "var(--color-ivory)",
          borderRadius: "var(--radius-card)",
        }}
      >
        <dl className="grid grid-cols-[180px_1fr] gap-y-3 text-sm">
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

          {p.birth_order != null && (
            <>
              <Dt>Thứ tự sinh</Dt>
              <Dd>{p.birth_order}</Dd>
            </>
          )}

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

          {p.is_deceased && (
            <>
              <Dt>Mất (dương lịch)</Dt>
              <Dd>
                {formatSolarDate({
                  year: p.death_year ?? undefined,
                  month: p.death_month ?? undefined,
                  day: p.death_day ?? undefined,
                })}
              </Dd>
              {deathLunar &&
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

      {/* Photos */}
      <section className="mb-10">
        <PhotoGallery
          personId={p.id}
          photos={photoRows}
          publicUrls={publicUrls}
          canEdit={isEditor}
        />
      </section>

      {/* Relationships */}
      <section className="mb-10">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h2
            className="font-display text-2xl"
            style={{ color: "var(--color-ink)" }}
          >
            Quan hệ
          </h2>
          <AddRelationshipForm person={p} candidates={candidates} />
        </div>

        <PersonRelationships
          person={p}
          relationships={(relationships ?? []) as Relationship[]}
          personsById={personsById}
        />
      </section>

      {/* Documents — admin only */}
      {(isAdmin || documentRows.length > 0) && (
        <section className="mb-10">
          <DocumentList
            personId={p.id}
            documents={documentRows}
            canManage={isAdmin}
          />
        </section>
      )}

      {/* Danger zone */}
      <section className="pt-10 border-t border-[rgba(26,23,20,0.08)]">
        <DeletePersonButton id={p.id} name={p.full_name} />
      </section>
    </main>
  );
}

function Dt({ children }: { children: React.ReactNode }) {
  return <dt style={{ color: "var(--color-sepia)" }}>{children}</dt>;
}
function Dd({ children }: { children: React.ReactNode }) {
  return <dd>{children}</dd>;
}

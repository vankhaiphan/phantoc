import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase/queries";
import PersonRelationships from "@/components/features/PersonRelationships";
import AddRelationshipForm from "@/components/features/AddRelationshipForm";
import DeletePersonButton from "@/components/features/DeletePersonButton";
import type { Person, Relationship, Branch } from "@/types";

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

  const [{ data: person }, { data: allPersons }, { data: relationships }, { data: branches }] =
    await Promise.all([
      supabase.from("persons").select("*").eq("id", id).single(),
      supabase.from("persons").select("*"),
      supabase
        .from("relationships")
        .select("*")
        .or(`person_a.eq.${id},person_b.eq.${id}`),
      supabase.from("branches").select("*"),
    ]);

  if (!person) notFound();

  const p = person as Person;
  const persons = (allPersons ?? []) as Person[];
  const personsById = new Map(persons.map((x) => [x.id, x]));
  const candidates = persons.filter((x) => x.id !== id);
  const branch = ((branches ?? []) as Branch[]).find(
    (b) => b.id === p.branch_id,
  );

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
          <Dd>{formatDate(p.birth_year, p.birth_month, p.birth_day) ?? "—"}</Dd>

          {p.is_deceased && (
            <>
              <Dt>Mất (dương lịch)</Dt>
              <Dd>
                {formatDate(p.death_year, p.death_month, p.death_day) ?? "—"}
              </Dd>
              {(p.death_lunar_year ||
                p.death_lunar_month ||
                p.death_lunar_day) && (
                <>
                  <Dt>Giỗ (âm lịch)</Dt>
                  <Dd>
                    {formatDate(
                      p.death_lunar_year,
                      p.death_lunar_month,
                      p.death_lunar_day,
                    ) ?? "—"}
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

function formatDate(
  year: number | null,
  month: number | null,
  day: number | null,
): string | null {
  if (!year && !month && !day) return null;
  const parts = [];
  if (day) parts.push(String(day).padStart(2, "0"));
  if (month) parts.push(String(month).padStart(2, "0"));
  if (year) parts.push(String(year));
  return parts.length > 0 ? parts.join(" / ") : null;
}

import Link from "next/link";
import type { Person } from "@/types";

const GENDER_LABEL: Record<Person["gender"], string> = {
  male: "Nam",
  female: "Nữ",
  other: "—",
};

export default function MemberCard({
  person,
  href,
}: {
  person: Person;
  href?: string;
}) {
  const linkHref = href ?? `/bang-dieu-khien/thanh-vien/${person.id}`;
  const lifespan = formatLifespan(person);

  return (
    <Link
      href={linkHref}
      className="block p-4 transition-shadow"
      style={{
        backgroundColor: "var(--color-ivory)",
        borderRadius: "var(--radius-card)",
        border: "1px solid rgba(26,23,20,0.06)",
        boxShadow: "0 1px 0 rgba(26,23,20,0.04)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="font-serif text-lg truncate"
            style={{
              color: person.is_deceased
                ? "var(--color-sepia)"
                : "var(--color-ink)",
            }}
          >
            {person.full_name}
          </p>
          {person.other_names && (
            <p
              className="text-xs italic truncate"
              style={{ color: "var(--color-sepia)" }}
            >
              {person.other_names}
            </p>
          )}
        </div>
        {person.is_in_law && (
          <span
            className="text-xs px-2 py-0.5 font-serif"
            style={{
              color: "var(--color-sepia)",
              border: "1px solid rgba(26,23,20,0.18)",
              borderRadius: "var(--radius-paper)",
            }}
          >
            dâu/rể
          </span>
        )}
      </div>

      <div
        className="mt-2 flex items-center gap-3 text-xs"
        style={{ color: "var(--color-sepia)" }}
      >
        <span>{GENDER_LABEL[person.gender]}</span>
        {lifespan && <span>· {lifespan}</span>}
        {person.generation != null && (
          <span>· Thế hệ {person.generation}</span>
        )}
      </div>
    </Link>
  );
}

function formatLifespan(p: Person): string | null {
  if (!p.birth_year && !p.death_year) return null;
  const b = p.birth_year ?? "?";
  const d = p.is_deceased ? p.death_year ?? "?" : "";
  if (p.is_deceased) return `${b} – ${d}`;
  return `Sinh ${b}`;
}

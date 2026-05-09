import Link from "next/link";
import type { Person, Relationship } from "@/types";
import DeleteRelationshipButton from "./DeleteRelationshipButton";

interface PersonRelationshipsProps {
  person: Person;
  relationships: Relationship[];
  personsById: Map<string, Person>;
}

export default function PersonRelationships({
  person,
  relationships,
  personsById,
}: PersonRelationshipsProps) {
  const parents: { rel: Relationship; other: Person }[] = [];
  const children: { rel: Relationship; other: Person }[] = [];
  const spouses: { rel: Relationship; other: Person }[] = [];

  for (const r of relationships) {
    const involvesMe = r.person_a === person.id || r.person_b === person.id;
    if (!involvesMe) continue;

    const otherId = r.person_a === person.id ? r.person_b : r.person_a;
    const other = personsById.get(otherId);
    if (!other) continue;

    if (r.type === "marriage") {
      spouses.push({ rel: r, other });
    } else if (
      r.type === "biological_child" ||
      r.type === "adopted_child"
    ) {
      // person_a is the parent, person_b is the child
      if (r.person_a === person.id) {
        children.push({ rel: r, other });
      } else {
        parents.push({ rel: r, other });
      }
    }
  }

  return (
    <div className="space-y-8">
      <RelGroup
        title="Cha mẹ"
        empty="Chưa có thông tin cha mẹ."
        items={parents}
        personId={person.id}
      />
      <RelGroup
        title="Vợ / Chồng"
        empty="Chưa có quan hệ hôn nhân."
        items={spouses}
        personId={person.id}
      />
      <RelGroup
        title="Con"
        empty="Chưa có thông tin con cái."
        items={children}
        personId={person.id}
      />
    </div>
  );
}

function RelGroup({
  title,
  empty,
  items,
  personId,
}: {
  title: string;
  empty: string;
  items: { rel: Relationship; other: Person }[];
  personId: string;
}) {
  return (
    <div>
      <h3
        className="font-serif text-base mb-3"
        style={{ color: "var(--color-ink)" }}
      >
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-sepia)" }}>
          {empty}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map(({ rel, other }) => (
            <li
              key={rel.id}
              className="flex items-center justify-between gap-3 p-3"
              style={{
                backgroundColor: "var(--color-ivory)",
                border: "1px solid rgba(26,23,20,0.06)",
                borderRadius: "var(--radius-paper)",
              }}
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/bang-dieu-khien/thanh-vien/${other.id}`}
                  className="font-serif text-base"
                  style={{ color: "var(--color-ink)" }}
                >
                  {other.full_name}
                </Link>
                <div
                  className="text-xs"
                  style={{ color: "var(--color-sepia)" }}
                >
                  {rel.type === "marriage" && "Hôn nhân"}
                  {rel.type === "biological_child" && "Quan hệ huyết thống"}
                  {rel.type === "adopted_child" && "Quan hệ nhận nuôi"}
                  {rel.note ? ` · ${rel.note}` : ""}
                </div>
              </div>
              <DeleteRelationshipButton
                id={rel.id}
                personAId={rel.person_a}
                personBId={rel.person_b}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

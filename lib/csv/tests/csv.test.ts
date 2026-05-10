import { describe, it, expect } from "vitest";
import {
  buildPersonsCsv,
  buildRelationshipsCsv,
  parsePersonsCsv,
  parseRelationshipsCsv,
} from "../index";
import type { Branch, Person, Relationship } from "@/types";

const ts = {
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const branch: Branch = {
  id: "b1",
  name: "Cẩm Nê",
  description: null,
  display_order: 0,
  parent_branch_id: null,
  ...ts,
};

const persons: Person[] = [
  {
    id: "p1",
    branch_id: "b1",
    full_name: "Phan Văn Sơn",
    other_names: 'Bảy "Sơn"',
    gender: "male",
    birth_year: 1950,
    birth_month: 5,
    birth_day: 15,
    death_year: 2010,
    death_month: null,
    death_day: null,
    death_lunar_year: 2010,
    death_lunar_month: 10,
    death_lunar_day: 25,
    is_deceased: true,
    is_in_law: false,
    birth_order: 1,
    generation: 8,
    avatar_url: null,
    note: "Trưởng tộc đời 8.",
    ...ts,
  },
];

const rels: Relationship[] = [
  {
    id: "r1",
    type: "marriage",
    person_a: "p1",
    person_b: "p2",
    note: null,
    marriage_order: 1,
    started_at: "1975-10-20",
    ended_at: null,
    ...ts,
  },
];

describe("CSV round-trip", () => {
  it("persons round-trips through unparse → parse", () => {
    const csv = buildPersonsCsv(persons, [branch]);
    expect(csv).toContain("Phan Văn Sơn");
    expect(csv).toContain("Cẩm Nê"); // human-readable branch_name column

    const { rows, errors } = parsePersonsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows.length).toBe(1);
    const r = rows[0]!;
    expect(r.full_name).toBe("Phan Văn Sơn");
    expect(r.other_names).toBe('Bảy "Sơn"');
    expect(r.is_deceased).toBe(true);
    expect(r.death_lunar_month).toBe(10);
    expect(r.note).toBe("Trưởng tộc đời 8.");
  });

  it("relationships round-trip", () => {
    const csv = buildRelationshipsCsv(rels, persons);
    const { rows, errors } = parseRelationshipsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]!.type).toBe("marriage");
    expect(rows[0]!.started_at).toBe("1975-10-20");
    expect(rows[0]!.marriage_order).toBe(1);
  });
});

describe("CSV import error reporting", () => {
  it("flags rows with missing full_name", () => {
    const csv = "full_name,gender\n,male\n";
    const { rows, errors } = parsePersonsCsv(csv);
    expect(rows).toEqual([]);
    expect(errors.length).toBe(1);
    expect(errors[0]!.message).toContain("full_name");
  });

  it("accepts Vietnamese gender labels", () => {
    const csv = "full_name,gender\nPhan Test,Nam\nNguyễn Test,Nữ\n";
    const { rows, errors } = parsePersonsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]!.gender).toBe("male");
    expect(rows[1]!.gender).toBe("female");
  });
});

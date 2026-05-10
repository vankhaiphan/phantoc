import { describe, it, expect } from "vitest";
import { buildGedcom, parseGedcom } from "../index";
import type { Person, Relationship } from "@/types";

const baseTimestamps = {
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const persons: Person[] = [
  {
    id: "p1",
    branch_id: null,
    full_name: "Phan Văn Sơn",
    other_names: "Bảy",
    gender: "male",
    birth_year: 1950,
    birth_month: 5,
    birth_day: 15,
    death_year: 2010,
    death_month: 11,
    death_day: 30,
    death_lunar_year: null,
    death_lunar_month: null,
    death_lunar_day: null,
    is_deceased: true,
    is_in_law: false,
    birth_order: 1,
    generation: 8,
    avatar_url: null,
    note: null,
    ...baseTimestamps,
  },
  {
    id: "p2",
    branch_id: null,
    full_name: "Nguyễn Thị Hoa",
    other_names: null,
    gender: "female",
    birth_year: 1955,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    death_lunar_year: null,
    death_lunar_month: null,
    death_lunar_day: null,
    is_deceased: false,
    is_in_law: true,
    birth_order: null,
    generation: 8,
    avatar_url: null,
    note: null,
    ...baseTimestamps,
  },
  {
    id: "p3",
    branch_id: null,
    full_name: "Phan Văn An",
    other_names: null,
    gender: "male",
    birth_year: 1980,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    death_lunar_year: null,
    death_lunar_month: null,
    death_lunar_day: null,
    is_deceased: false,
    is_in_law: false,
    birth_order: 1,
    generation: 9,
    avatar_url: null,
    note: null,
    ...baseTimestamps,
  },
];

const rels: Relationship[] = [
  {
    id: "r1",
    type: "marriage",
    person_a: "p1",
    person_b: "p2",
    note: null,
    marriage_order: null,
    started_at: "1975-10-20",
    ended_at: null,
    ...baseTimestamps,
  },
  {
    id: "r2",
    type: "biological_child",
    person_a: "p1",
    person_b: "p3",
    note: null,
    marriage_order: null,
    started_at: null,
    ended_at: null,
    ...baseTimestamps,
  },
  {
    id: "r3",
    type: "biological_child",
    person_a: "p2",
    person_b: "p3",
    note: null,
    marriage_order: null,
    started_at: null,
    ended_at: null,
    ...baseTimestamps,
  },
];

describe("buildGedcom", () => {
  it("emits a valid 5.5.1 header and INDI/FAM records", () => {
    const out = buildGedcom(persons, rels);
    expect(out).toContain("0 HEAD");
    expect(out).toContain("2 VERS 5.5.1");
    expect(out).toContain("0 TRLR");
    expect(out).toMatch(/0 @I\d+@ INDI/);
    expect(out).toMatch(/0 @F\d+@ FAM/);
    // Surname is between slashes
    expect(out).toContain("/Phan/");
    // Death record marked
    expect(out).toContain("1 DEAT Y");
    // Marriage date in GEDCOM format
    expect(out).toContain("1 MARR");
    expect(out).toContain("2 DATE 20 OCT 1975");
  });

  it("attaches a child to the parents' marriage FAM (not a synthetic FAM)", () => {
    const out = buildGedcom(persons, rels);
    // Exactly one FAM record (the marriage), with 1 CHIL
    const famCount = (out.match(/^0 @F\d+@ FAM/gm) || []).length;
    expect(famCount).toBe(1);
    expect(out).toMatch(/1 CHIL @I\d+@/);
  });
});

describe("parseGedcom", () => {
  it("round-trips through buildGedcom", () => {
    const out = buildGedcom(persons, rels);
    const parsed = parseGedcom(out);
    expect(parsed.individuals.length).toBe(3);
    const son = parsed.individuals.find((i) => i.full_name.includes("Sơn"))!;
    expect(son.gender).toBe("male");
    expect(son.birth_year).toBe(1950);
    expect(son.birth_month).toBe(5);
    expect(son.birth_day).toBe(15);
    expect(son.is_deceased).toBe(true);
    expect(son.death_year).toBe(2010);

    expect(parsed.families.length).toBe(1);
    expect(parsed.families[0]!.children.length).toBe(1);
  });

  it("handles year-only dates with ABT prefix", () => {
    const text = `0 HEAD\n1 GEDC\n2 VERS 5.5.1\n0 @I1@ INDI\n1 NAME Phan /Test/\n1 SEX M\n1 BIRT\n2 DATE ABT 1880\n0 TRLR`;
    const parsed = parseGedcom(text);
    expect(parsed.individuals[0]!.birth_year).toBe(1880);
    expect(parsed.individuals[0]!.birth_month).toBeNull();
  });
});

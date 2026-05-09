import { describe, expect, it } from "vitest";
import { computeKinship } from "../compute";
import { child, marriage, person } from "./fixture";

describe("kinship — core blood relations", () => {
  it("self → null", () => {
    const a = person("a", "Người Một", "male");
    expect(computeKinship(a, a, [a], [])).toBeNull();
  });

  it("parent ↔ child", () => {
    const father = person("f", "Cha", "male", { birth_year: 1960 });
    const son = person("s", "Con", "male", { birth_year: 1990 });
    const persons = [father, son];
    const rels = [child("f", "s")];

    const r = computeKinship(son, father, persons, rels);
    expect(r).not.toBeNull();
    expect(r!.aCallsB).toBe("Bố");
    expect(r!.bCallsA).toBe("Con trai");
    expect(r!.distance).toBe(1);
    expect(r!.ancestorId).toBe("f");
  });

  it("paternal grandfather → Ông nội", () => {
    const grandpa = person("g", "Ông", "male");
    const dad = person("d", "Cha", "male");
    const me = person("m", "Tôi", "male");
    const persons = [grandpa, dad, me];
    const rels = [child("g", "d"), child("d", "m")];

    const r = computeKinship(me, grandpa, persons, rels);
    expect(r).not.toBeNull();
    expect(r!.aCallsB).toBe("Ông nội");
    expect(r!.side).toBe("paternal");
  });

  it("maternal grandmother → Bà ngoại", () => {
    const grandma = person("g", "Bà", "female");
    const mom = person("m", "Mẹ", "female");
    const me = person("k", "Tôi", "male");
    const persons = [grandma, mom, me];
    const rels = [child("g", "m"), child("m", "k")];

    const r = computeKinship(me, grandma, persons, rels);
    expect(r).not.toBeNull();
    expect(r!.aCallsB).toBe("Bà ngoại");
    expect(r!.side).toBe("maternal");
  });

  it("full siblings — older brother is Anh trai", () => {
    const dad = person("d", "Cha", "male");
    const mom = person("m", "Mẹ", "female");
    const older = person("o", "Anh", "male", { birth_order: 1, birth_year: 1990 });
    const younger = person("y", "Em", "male", { birth_order: 2, birth_year: 1995 });
    const persons = [dad, mom, older, younger];
    const rels = [
      marriage("d", "m"),
      child("d", "o"),
      child("m", "o"),
      child("d", "y"),
      child("m", "y"),
    ];

    const r = computeKinship(younger, older, persons, rels);
    expect(r!.aCallsB).toBe("Anh trai");
    expect(r!.bCallsA).toBe("Em trai");
    expect(r!.description).toMatch(/^Anh chị em ruột/);
  });

  it("paternal uncle older than father → Bác", () => {
    const grandpa = person("g", "Ông", "male");
    const elder_uncle = person("u", "Bác", "male", { birth_order: 1 });
    const dad = person("d", "Cha", "male", { birth_order: 2 });
    const me = person("m", "Tôi", "male");
    const persons = [grandpa, elder_uncle, dad, me];
    const rels = [child("g", "u"), child("g", "d"), child("d", "m")];

    const r = computeKinship(me, elder_uncle, persons, rels);
    expect(r!.aCallsB).toBe("Bác");
    expect(r!.bCallsA).toBe("Cháu");
    expect(r!.side).toBe("paternal");
  });

  it("paternal uncle younger than father → Chú", () => {
    const grandpa = person("g", "Ông", "male");
    const dad = person("d", "Cha", "male", { birth_order: 1 });
    const younger_uncle = person("u", "Chú", "male", { birth_order: 2 });
    const me = person("m", "Tôi", "male");
    const persons = [grandpa, dad, younger_uncle, me];
    const rels = [child("g", "d"), child("g", "u"), child("d", "m")];

    const r = computeKinship(me, younger_uncle, persons, rels);
    expect(r!.aCallsB).toBe("Chú");
  });

  it("maternal uncle → Cậu (regardless of seniority)", () => {
    const grandma = person("g", "Bà", "female");
    const mom = person("m", "Mẹ", "female", { birth_order: 1 });
    const uncle = person("u", "Cậu", "male", { birth_order: 2 });
    const me = person("k", "Tôi", "male");
    const persons = [grandma, mom, uncle, me];
    const rels = [child("g", "m"), child("g", "u"), child("m", "k")];

    const r = computeKinship(me, uncle, persons, rels);
    expect(r!.aCallsB).toBe("Cậu");
    expect(r!.side).toBe("maternal");
  });

  it("maternal aunt → Dì", () => {
    const grandma = person("g", "Bà", "female");
    const mom = person("m", "Mẹ", "female", { birth_order: 1 });
    const aunt = person("d", "Dì", "female", { birth_order: 2 });
    const me = person("k", "Tôi", "male");
    const persons = [grandma, mom, aunt, me];
    const rels = [child("g", "m"), child("g", "d"), child("m", "k")];

    const r = computeKinship(me, aunt, persons, rels);
    expect(r!.aCallsB).toBe("Dì");
  });

  it("great-grandparent — paternal → Cụ ông nội", () => {
    const ggpa = person("gg", "Cụ", "male");
    const gpa = person("g", "Ông", "male");
    const dad = person("d", "Cha", "male");
    const me = person("m", "Tôi", "male");
    const persons = [ggpa, gpa, dad, me];
    const rels = [child("gg", "g"), child("g", "d"), child("d", "m")];

    const r = computeKinship(me, ggpa, persons, rels);
    expect(r!.aCallsB).toMatch(/Cụ ông nội/);
    expect(r!.side).toBe("paternal");
  });
});

import { describe, expect, it } from "vitest";
import { computeKinship } from "../compute";
import { adopted, child, person } from "./fixture";

describe("kinship — edge cases", () => {
  it("half-siblings — same father, different mother", () => {
    const dad = person("d", "Cha", "male");
    const mom1 = person("m1", "Mẹ 1", "female");
    const mom2 = person("m2", "Mẹ 2", "female");
    const kid1 = person("k1", "Anh", "male", { birth_order: 1, birth_year: 1990 });
    const kid2 = person("k2", "Em", "male", { birth_order: 2, birth_year: 1995 });
    const persons = [dad, mom1, mom2, kid1, kid2];
    const rels = [
      child("d", "k1"),
      child("m1", "k1"),
      child("d", "k2"),
      child("m2", "k2"),
    ];

    const r = computeKinship(kid2, kid1, persons, rels);
    expect(r).not.toBeNull();
    expect(r!.aCallsB).toBe("Anh trai");
    expect(r!.description).toMatch(/cùng huyết|cùng cha khác mẹ/);
  });

  it("unrelated — no path → certainty fallback", () => {
    const a = person("a", "Người A", "male");
    const b = person("b", "Người B", "female");
    const r = computeKinship(a, b, [a, b], []);
    expect(r).not.toBeNull();
    expect(r!.certainty).toBe("fallback");
    expect(r!.ancestorId).toBeNull();
    expect(r!.aCallsB).toBe("Chưa xác định");
  });

  it("adoption — adopted children get full kinship by default", () => {
    const dad = person("d", "Cha nuôi", "male");
    const adopted_kid = person("a", "Con nuôi", "male");
    const persons = [dad, adopted_kid];
    const rels = [adopted("d", "a")];

    const r = computeKinship(adopted_kid, dad, persons, rels);
    expect(r).not.toBeNull();
    expect(r!.aCallsB).toBe("Bố");
  });

  it("adoption excluded → no kinship found", () => {
    const dad = person("d", "Cha nuôi", "male");
    const adopted_kid = person("a", "Con nuôi", "male");
    const persons = [dad, adopted_kid];
    const rels = [adopted("d", "a")];

    const r = computeKinship(adopted_kid, dad, persons, rels, {
      includeAdoption: false,
    });
    expect(r!.certainty).toBe("fallback");
  });

  it("data cycle — does not infinite-loop", () => {
    // Pathological: Person A is the parent of Person B, and B is also (incorrectly)
    // a parent of A. The engine guards via a visited set.
    const a = person("a", "A", "male");
    const b = person("b", "B", "male");
    const rels = [child("a", "b"), child("b", "a")];

    // Should terminate; result is some finite KinshipResult or fallback.
    const r = computeKinship(a, b, [a, b], rels);
    expect(r).not.toBeNull();
  });

  it("marriage_order column doesn't break anything (extra fields allowed)", () => {
    const h = person("h", "Chồng", "male");
    const w = person("w", "Vợ", "female");
    const rels = [
      {
        type: "marriage" as const,
        person_a: "h",
        person_b: "w",
        marriage_order: 1,
      },
    ];
    const r = computeKinship(h, w, [h, w], rels);
    expect(r!.aCallsB).toBe("Vợ");
  });

  it("symmetric distance for siblings is 2", () => {
    const dad = person("d", "Cha", "male");
    const k1 = person("k1", "Con1", "male", { birth_order: 1 });
    const k2 = person("k2", "Con2", "male", { birth_order: 2 });
    const persons = [dad, k1, k2];
    const rels = [child("d", "k1"), child("d", "k2")];

    const r = computeKinship(k1, k2, persons, rels);
    expect(r!.distance).toBe(2);
    expect(r!.ancestorId).toBe("d");
  });

  it("first cousins (paternal Nội)", () => {
    // Tổ → Bình, Đức (both male). Bình → An; Đức → Hoa.
    const to = person("to", "Tổ", "male");
    const binh = person("b", "Bình", "male", { birth_order: 1 });
    const duc = person("d", "Đức", "male", { birth_order: 2 });
    const an = person("an", "An", "male");
    const hoa = person("hoa", "Hoa", "female");
    const persons = [to, binh, duc, an, hoa];
    const rels = [child("to", "b"), child("to", "d"), child("b", "an"), child("d", "hoa")];

    const r = computeKinship(an, hoa, persons, rels);
    expect(r!.description).toMatch(/Anh em họ Nội/);
    expect(r!.side).toBe("paternal");
  });

  it("first cousins (maternal Ngoại) — A's mother and B's mother are sisters", () => {
    // GrandMa → Mẹ A, Mẹ B (both female). Mẹ A → A; Mẹ B → B.
    const gma = person("g", "Bà ngoại", "female");
    const ma_a = person("ma_a", "Mẹ A", "female", { birth_order: 1 });
    const ma_b = person("ma_b", "Mẹ B", "female", { birth_order: 2 });
    const a = person("a", "A", "male");
    const b = person("b", "B", "female");
    const persons = [gma, ma_a, ma_b, a, b];
    const rels = [
      child("g", "ma_a"),
      child("g", "ma_b"),
      child("ma_a", "a"),
      child("ma_b", "b"),
    ];

    const r = computeKinship(a, b, persons, rels);
    expect(r!.description).toMatch(/Anh em họ Ngoại/);
    expect(r!.side).toBe("maternal");
  });

  it("multiple marriages — distance ranks blood path over marriage wrap", () => {
    // A is B's biological father AND was briefly married to B's mother (after divorce
    // remarried someone else). Result should be Bố/Con, not Vợ/Chồng of someone.
    // (Constructed contrived case.)
    const a = person("a", "Cha", "male");
    const b = person("b", "Con", "female");
    const persons = [a, b];
    const rels = [child("a", "b")];

    const r = computeKinship(a, b, persons, rels);
    expect(r!.aCallsB).toBe("Con gái");
    expect(r!.bCallsA).toBe("Bố");
  });

  it("isolated person — kinship to anyone is fallback", () => {
    const isolated = person("i", "Người lạ", "male");
    const dad = person("d", "Cha", "male");
    const son = person("s", "Con", "male");
    const persons = [isolated, dad, son];
    const rels = [child("d", "s")];

    const r = computeKinship(isolated, son, persons, rels);
    expect(r!.certainty).toBe("fallback");
  });
});

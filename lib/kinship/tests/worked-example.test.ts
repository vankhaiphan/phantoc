import { describe, expect, it } from "vitest";
import { computeKinship } from "../compute";
import { child, marriage, person } from "./fixture";

/**
 * The canonical worked example from architecture-proposal.md §5.5.
 *
 *                  Phan Văn Tổ ──┬── Lê Thị Lan
 *                                │
 *           ┌────────────────────┼─────────────────────┐
 *           │                    │                     │
 *      Phan Văn Bình       Phan Thị Cúc        Phan Văn Đức
 *      ──┬── Trần Thị Hoa                       ──┬── Vũ Thị Mai
 *        │                                        │
 *      Phan Minh An (m, 1985)              Phan Thanh Hà (f, 1990)
 *
 * Bình (birth_order 1) is senior to Đức (birth_order 3); both are male
 * children of Tổ. Therefore An is in the senior branch and addresses
 * Hà as "Em họ"; Hà calls An "Anh họ"; both via the paternal (Nội) side.
 */
describe("kinship — §5.5 worked example", () => {
  const persons = [
    person("to", "Phan Văn Tổ", "male", { birth_year: 1900, birth_order: 1 }),
    person("lan", "Lê Thị Lan", "female", { birth_year: 1902, is_in_law: true }),
    person("binh", "Phan Văn Bình", "male", { birth_year: 1925, birth_order: 1 }),
    person("cuc", "Phan Thị Cúc", "female", { birth_year: 1928, birth_order: 2 }),
    person("duc", "Phan Văn Đức", "male", { birth_year: 1930, birth_order: 3 }),
    person("hoa", "Trần Thị Hoa", "female", { birth_year: 1928, is_in_law: true }),
    person("mai", "Vũ Thị Mai", "female", { birth_year: 1934, is_in_law: true }),
    person("an", "Phan Minh An", "male", { birth_year: 1985, birth_order: 1 }),
    person("ha", "Phan Thanh Hà", "female", { birth_year: 1990, birth_order: 1 }),
  ];

  const rels = [
    marriage("to", "lan"),
    child("to", "binh"),
    child("to", "cuc"),
    child("to", "duc"),
    child("lan", "binh"),
    child("lan", "cuc"),
    child("lan", "duc"),
    marriage("binh", "hoa"),
    child("binh", "an"),
    child("hoa", "an"),
    marriage("duc", "mai"),
    child("duc", "ha"),
    child("mai", "ha"),
  ];

  it("An gọi Hà là Em họ; Hà gọi An là Anh họ; bên Nội", () => {
    const an = persons.find((p) => p.id === "an")!;
    const ha = persons.find((p) => p.id === "ha")!;
    const result = computeKinship(an, ha, persons, rels);
    expect(result).not.toBeNull();
    expect(result!.aCallsB).toBe("Em họ");
    expect(result!.bCallsA).toBe("Anh họ");
    expect(result!.description).toContain("Anh em họ Nội");
    expect(result!.description).toContain("Phan Văn Tổ");
    expect(result!.side).toBe("paternal");
    expect(result!.certainty).toBe("certain");
    expect(result!.ancestorId).toBe("to");
    expect(result!.distance).toBe(4);
  });

  it("symmetric — Hà gọi An là Anh họ; An gọi Hà là Em họ", () => {
    const an = persons.find((p) => p.id === "an")!;
    const ha = persons.find((p) => p.id === "ha")!;
    const result = computeKinship(ha, an, persons, rels);
    expect(result).not.toBeNull();
    expect(result!.aCallsB).toBe("Anh họ");
    expect(result!.bCallsA).toBe("Em họ");
    expect(result!.ancestorId).toBe("to");
  });

  it("An's father Bình is his Bố", () => {
    const binh = persons.find((p) => p.id === "binh")!;
    const an = persons.find((p) => p.id === "an")!;
    const result = computeKinship(an, binh, persons, rels);
    expect(result).not.toBeNull();
    expect(result!.aCallsB).toBe("Bố");
    expect(result!.bCallsA).toBe("Con trai");
  });

  it("Tổ is An's Ông nội (paternal grandfather)", () => {
    const to = persons.find((p) => p.id === "to")!;
    const an = persons.find((p) => p.id === "an")!;
    const result = computeKinship(an, to, persons, rels);
    expect(result).not.toBeNull();
    expect(result!.aCallsB).toBe("Ông nội");
    expect(result!.side).toBe("paternal");
  });

  it("Đức is An's Chú (paternal uncle, younger than An's father)", () => {
    const duc = persons.find((p) => p.id === "duc")!;
    const an = persons.find((p) => p.id === "an")!;
    const result = computeKinship(an, duc, persons, rels);
    expect(result).not.toBeNull();
    expect(result!.aCallsB).toBe("Chú");
    expect(result!.bCallsA).toBe("Cháu");
    expect(result!.side).toBe("paternal");
  });

  it("Cúc is An's Cô (paternal aunt, younger than An's father)", () => {
    const cuc = persons.find((p) => p.id === "cuc")!;
    const an = persons.find((p) => p.id === "an")!;
    const result = computeKinship(an, cuc, persons, rels);
    expect(result).not.toBeNull();
    expect(result!.aCallsB).toBe("Cô");
    expect(result!.side).toBe("paternal");
  });
});

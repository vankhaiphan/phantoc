import { describe, expect, it } from "vitest";
import { computeKinship } from "../compute";
import { child, marriage, person } from "./fixture";

describe("kinship — marriage and in-law relations", () => {
  it("husband ↔ wife → Vợ / Chồng", () => {
    const h = person("h", "Chồng", "male");
    const w = person("w", "Vợ", "female");
    const r = computeKinship(h, w, [h, w], [marriage("h", "w")]);
    expect(r!.aCallsB).toBe("Vợ");
    expect(r!.bCallsA).toBe("Chồng");
    expect(r!.side).toBe("marital");
    expect(r!.distance).toBe(0);
  });

  it("wife's father → Bố vợ; he calls husband Con rể", () => {
    const fil = person("f", "Bố vợ", "male");
    const wife = person("w", "Vợ", "female");
    const husband = person("h", "Chồng", "male");
    const persons = [fil, wife, husband];
    const rels = [child("f", "w"), marriage("h", "w")];

    const r = computeKinship(husband, fil, persons, rels);
    expect(r!.aCallsB).toBe("Bố vợ");
    expect(r!.bCallsA).toBe("Con rể");
    expect(r!.side).toBe("marital");
  });

  it("husband's mother → Mẹ chồng; she calls wife Con dâu", () => {
    const mil = person("m", "Mẹ chồng", "female");
    const husband = person("h", "Chồng", "male");
    const wife = person("w", "Vợ", "female");
    const persons = [mil, husband, wife];
    const rels = [child("m", "h"), marriage("h", "w")];

    const r = computeKinship(wife, mil, persons, rels);
    expect(r!.aCallsB).toBe("Mẹ chồng");
    expect(r!.bCallsA).toBe("Con dâu");
  });

  it("anh em cột chèo — two men married to sisters", () => {
    // Tổ has daughters Hoa & Mai. Hoa marries Bình; Mai marries Đức.
    // Bình and Đức are anh em cột chèo.
    const to = person("to", "Tổ", "male");
    const hoa = person("hoa", "Hoa", "female", { birth_order: 1 });
    const mai = person("mai", "Mai", "female", { birth_order: 2 });
    const binh = person("binh", "Bình", "male");
    const duc = person("duc", "Đức", "male");
    const persons = [to, hoa, mai, binh, duc];
    const rels = [
      child("to", "hoa"),
      child("to", "mai"),
      marriage("binh", "hoa"),
      marriage("duc", "mai"),
    ];

    const r = computeKinship(binh, duc, persons, rels);
    expect(r!.aCallsB).toBe("Anh em cột chèo");
    expect(r!.bCallsA).toBe("Anh em cột chèo");
    expect(r!.side).toBe("marital");
  });

  it("chị em dâu — two women married to brothers", () => {
    const to = person("to", "Tổ", "male");
    const binh = person("binh", "Bình", "male", { birth_order: 1 });
    const duc = person("duc", "Đức", "male", { birth_order: 2 });
    const hoa = person("hoa", "Hoa", "female");
    const mai = person("mai", "Mai", "female");
    const persons = [to, binh, duc, hoa, mai];
    const rels = [
      child("to", "binh"),
      child("to", "duc"),
      marriage("binh", "hoa"),
      marriage("duc", "mai"),
    ];

    const r = computeKinship(hoa, mai, persons, rels);
    expect(r!.aCallsB).toBe("Chị em dâu");
    expect(r!.bCallsA).toBe("Chị em dâu");
  });

  it("Thím — Khải gọi vợ của Chú là Thím; Thím gọi Khải là Cháu", () => {
    // Ông → Bố (anh cả) → Khải
    // Ông → Chú (em)    → (married) Thím
    const ong = person("ong", "Ông", "male");
    const bo = person("bo", "Bố", "male", { birth_order: 1 });
    const chu = person("chu", "Chú", "male", { birth_order: 2 });
    const khai = person("khai", "Khải", "male");
    const thim = person("thim", "Thím", "female");
    const persons = [ong, bo, chu, khai, thim];
    const rels = [
      child("ong", "bo"),
      child("ong", "chu"),
      child("bo", "khai"),
      marriage("chu", "thim"),
    ];
    const r = computeKinship(khai, thim, persons, rels);
    expect(r!.aCallsB).toBe("Thím");
    expect(r!.bCallsA).toBe("Cháu");
  });

  it("anh rể — wife's older brother (her side) calls husband Em rể", () => {
    // Older-brother (anh) marries wife. From wife's husband perspective: anh of wife = anh vợ.
    // From anh's perspective: husband is em rể.
    const dad = person("d", "Cha", "male");
    const elder = person("e", "Anh vợ", "male", { birth_order: 1, birth_year: 1985 });
    const wife = person("w", "Vợ", "female", { birth_order: 2, birth_year: 1990 });
    const husband = person("h", "Chồng", "male", { birth_year: 1988 });
    const persons = [dad, elder, wife, husband];
    const rels = [child("d", "e"), child("d", "w"), marriage("h", "w")];

    const r = computeKinship(husband, elder, persons, rels);
    expect(r!.aCallsB).toBe("Anh vợ");
    expect(r!.bCallsA).toBe("Em rể");
  });
});

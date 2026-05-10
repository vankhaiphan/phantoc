import { describe, it, expect } from "vitest";
import {
  formatLunarDate,
  ganZhiOfYear,
  lunarToSolar,
  solarToLunar,
} from "../index";

describe("ganZhiOfYear", () => {
  it("matches well-known canonical years", () => {
    // 1984 = Giáp Tý (start of cycle)
    expect(ganZhiOfYear(1984).canChi).toBe("Giáp Tý");
    // 2006 = Bính Tuất; 2024 = Giáp Thìn; 2026 = Bính Ngọ
    expect(ganZhiOfYear(2006).canChi).toBe("Bính Tuất");
    expect(ganZhiOfYear(2024).canChi).toBe("Giáp Thìn");
  });

  it("uses Vietnamese cat for Mão (not rabbit)", () => {
    // 2023 lunar year = Quý Mão
    const r = ganZhiOfYear(2023);
    expect(r.chi).toBe("Mão");
    expect(r.conGiap).toBe("Mèo");
  });
});

describe("solarToLunar / lunarToSolar", () => {
  it("round-trips a known solar date", () => {
    const lunar = solarToLunar({ year: 2024, month: 2, day: 10 });
    expect(lunar).not.toBeNull();
    // 2024-02-10 was lunar new year — Giáp Thìn 1/1
    expect(lunar?.year).toBe(2024);
    expect(lunar?.month).toBe(1);
    expect(lunar?.day).toBe(1);

    const solar = lunarToSolar(lunar!);
    expect(solar).toEqual({ year: 2024, month: 2, day: 10 });
  });

  it("returns null on partial input", () => {
    expect(solarToLunar({ year: 2024 })).toBeNull();
    expect(lunarToSolar({ year: 2024, month: 1 })).toBeNull();
  });
});

describe("formatLunarDate", () => {
  it("appends the Can-Chi suffix when a year is given", () => {
    expect(
      formatLunarDate({ year: 2024, month: 1, day: 1, isLeap: false }),
    ).toBe("01 / 01 / 2024 (Giáp Thìn)");
  });

  it("returns a dash when no fields are set", () => {
    expect(formatLunarDate({})).toBe("—");
  });
});

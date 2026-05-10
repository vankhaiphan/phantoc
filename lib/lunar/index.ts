/**
 * Lunar calendar utilities (Vietnamese flavour).
 *
 * Wraps `lunar-javascript` (a Sino-only library) and re-presents the
 * sexagenary cycle and zodiac in Vietnamese form. Specifically:
 *   – Year names are Vietnamese transliterations of Thiên can / Địa chi
 *     ("Giáp Tý", not "甲子").
 *   – The zodiac for the chi 卯 is **Mèo (cat)**, not Rabbit. The Vietnamese
 *     zodiac diverges from the Chinese here.
 *
 * The library itself exposes plenty of cosmological data we don't need
 * (constellations, Pengzu taboos, etc.); this module is the deliberately
 * narrow surface phantoc uses.
 */
import { Solar, Lunar } from "lunar-javascript";

export interface SolarDate {
  year: number;
  month: number;
  day: number;
}

export interface LunarDate {
  year: number;
  month: number;
  day: number;
  /** True when the lunar month is a leap month (tháng nhuận). */
  isLeap: boolean;
}

// ─── Vietnamese sexagenary cycle ─────────────────────────────────────────────

export const THIEN_CAN: readonly string[] = [
  "Giáp", "Ất", "Bính", "Đinh", "Mậu",
  "Kỷ", "Canh", "Tân", "Nhâm", "Quý",
];

export const DIA_CHI: readonly string[] = [
  "Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ",
  "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi",
];

/**
 * Vietnamese zodiac animals, indexed parallel to DIA_CHI. Mão = Mèo, not Thỏ.
 */
export const CON_GIAP_VN: readonly string[] = [
  "Chuột", "Trâu", "Hổ", "Mèo", "Rồng", "Rắn",
  "Ngựa", "Dê", "Khỉ", "Gà", "Chó", "Lợn",
];

/**
 * Sexagenary cycle for a *lunar* year. The cycle resets every 60 years; the
 * formula `(y - 4) mod 10` / `(y - 4) mod 12` is exact for any year ≥ 4 BC.
 * Pass the lunar year, not the solar year — they differ at the boundary
 * (a January 30 solar date can fall in the previous lunar year).
 */
export function ganZhiOfYear(lunarYear: number): {
  can: string;
  chi: string;
  canChi: string;
  conGiap: string;
} {
  // JS `%` is truncated, so add the modulus to handle pre-AD years robustly.
  const ganIdx = (((lunarYear - 4) % 10) + 10) % 10;
  const zhiIdx = (((lunarYear - 4) % 12) + 12) % 12;
  const can = THIEN_CAN[ganIdx]!;
  const chi = DIA_CHI[zhiIdx]!;
  return {
    can,
    chi,
    canChi: `${can} ${chi}`,
    conGiap: CON_GIAP_VN[zhiIdx]!,
  };
}

// ─── Conversion ──────────────────────────────────────────────────────────────

/**
 * Convert a solar (Gregorian) date to a lunar date. Returns `null` if any
 * field is missing (we never guess — gia phả entries with year-only solar
 * dates simply don't have a corresponding lunar day).
 */
export function solarToLunar(d: Partial<SolarDate>): LunarDate | null {
  if (!d.year || !d.month || !d.day) return null;
  try {
    const solar = Solar.fromYmd(d.year, d.month, d.day);
    const lunar = solar.getLunar();
    // lunar-javascript represents leap months as a negative month number.
    const rawMonth = lunar.getMonth();
    return {
      year: lunar.getYear(),
      month: Math.abs(rawMonth),
      day: lunar.getDay(),
      isLeap: rawMonth < 0,
    };
  } catch {
    return null;
  }
}

/**
 * Convert a lunar date back to a solar one. `isLeap` defaults to false; pass
 * true only for the rare entry whose lunar month was a leap month in that
 * year (otherwise the conversion silently shifts by ~30 days).
 */
export function lunarToSolar(d: Partial<LunarDate>): SolarDate | null {
  if (!d.year || !d.month || !d.day) return null;
  try {
    const m = d.isLeap ? -d.month : d.month;
    const lunar = Lunar.fromYmd(d.year, m, d.day);
    const solar = lunar.getSolar();
    return {
      year: solar.getYear(),
      month: solar.getMonth(),
      day: solar.getDay(),
    };
  } catch {
    return null;
  }
}

// ─── Anniversaries (giỗ) ─────────────────────────────────────────────────────

/**
 * Given the lunar month/day of a death anniversary (giỗ), return the next
 * solar date on which it falls — counting from `from` (default: today).
 *
 * Walks forward year-by-year because a few lunar dates (the 30th of certain
 * short months) don't exist every year; we skip those and advance.
 */
export function nextSolarOfLunarAnniversary(
  lunarMonth: number,
  lunarDay: number,
  from: Date = new Date(),
  isLeap = false,
): SolarDate | null {
  if (!lunarMonth || !lunarDay) return null;

  const fromY = from.getFullYear();
  const fromM = from.getMonth() + 1;
  const fromD = from.getDate();

  // Try the current solar year first, then the next 4. Five tries is enough
  // even when the lunar new year sits at the very end of the solar year and
  // the giỗ falls on a lunar 30 that's missing this year.
  for (let i = 0; i < 5; i++) {
    const lunarYear = fromY + i;
    const candidate = lunarToSolar({
      year: lunarYear,
      month: lunarMonth,
      day: lunarDay,
      isLeap,
    });
    if (!candidate) continue;
    const isFuture =
      candidate.year > fromY ||
      (candidate.year === fromY && candidate.month > fromM) ||
      (candidate.year === fromY &&
        candidate.month === fromM &&
        candidate.day >= fromD);
    if (isFuture) return candidate;
  }
  return null;
}

/**
 * Whole-day delta between two solar dates. Positive when `to` is in the
 * future. Uses UTC midnight to avoid DST drift.
 */
export function daysBetween(from: Date, to: SolarDate): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((b - a) / 86_400_000);
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/**
 * "DD / MM / YYYY (Bính Tuất)" — the canonical lunar display in this app.
 * Returns `—` when nothing can be shown. The Can-Chi suffix is appended
 * only when a year is present; Mèo/Hợi/etc fall out of the same map.
 */
export function formatLunarDate(d: Partial<LunarDate>): string {
  const parts: string[] = [];
  if (d.day) parts.push(String(d.day).padStart(2, "0"));
  if (d.month) {
    parts.push(
      d.isLeap ? `${d.month}n`.padStart(3, "0") : String(d.month).padStart(2, "0"),
    );
  }
  if (d.year) parts.push(String(d.year));
  if (parts.length === 0) return "—";

  const head = parts.join(" / ");
  if (!d.year) return head;
  const { canChi } = ganZhiOfYear(d.year);
  return `${head} (${canChi})`;
}

/**
 * Pretty Vietnamese form for the year alone, e.g. "Bính Tuất (Chó) — 2006".
 */
export function formatLunarYear(year: number): string {
  const { canChi, conGiap } = ganZhiOfYear(year);
  return `${canChi} (${conGiap}) — ${year}`;
}

/**
 * "DD / MM / YYYY (Giáp Thìn)" for a solar (Gregorian) date. When the full
 * Y/M/D is present, the Can-Chi is taken from the *lunar* year that the
 * date falls in (more accurate near the Lunar New Year boundary). When
 * only the year is known, the solar year is used as the Can-Chi anchor —
 * close enough for the year-only entries common in old gia phả records.
 */
export function formatSolarDate(d: Partial<SolarDate>): string {
  const parts: string[] = [];
  if (d.day) parts.push(String(d.day).padStart(2, "0"));
  if (d.month) parts.push(String(d.month).padStart(2, "0"));
  if (d.year) parts.push(String(d.year));
  if (parts.length === 0) return "—";
  const head = parts.join(" / ");

  let canChiYear: number | null = null;
  if (d.year && d.month && d.day) {
    const lunar = solarToLunar({ year: d.year, month: d.month, day: d.day });
    canChiYear = lunar?.year ?? d.year;
  } else if (d.year) {
    canChiYear = d.year;
  }
  if (canChiYear == null) return head;
  const { canChi } = ganZhiOfYear(canChiYear);
  return `${head} (${canChi})`;
}

/**
 * Minimal ambient typings for lunar-javascript (no upstream types).
 * Only the surface phantoc actually uses is declared here.
 */
declare module "lunar-javascript" {
  export interface SolarLike {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getLunar(): LunarLike;
  }

  export interface LunarLike {
    /** Negative when the month is a leap month. */
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getSolar(): SolarLike;
    getYearInGanZhi(): string;
    getYearShengXiao(): string;
    getMonthInChinese(): string;
    getDayInChinese(): string;
  }

  export const Solar: {
    fromYmd(year: number, month: number, day: number): SolarLike;
  };

  export const Lunar: {
    fromYmd(year: number, month: number, day: number): LunarLike;
  };
}

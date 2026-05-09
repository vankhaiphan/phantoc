import { z } from "zod";

/**
 * Coerces empty strings / undefined / null to `null`, otherwise to a number.
 * Used for the many optional integer fields on `persons` (partial dates,
 * birth_order, generation).
 */
const nullableInt = (opts: { min?: number; max?: number } = {}) =>
  z.preprocess(
    (v) => {
      if (v === "" || v === null || v === undefined) return null;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    },
    z
      .number()
      .int()
      .refine((n) => opts.min === undefined || n >= opts.min, {
        message: opts.min !== undefined ? `Tối thiểu ${opts.min}` : "",
      })
      .refine((n) => opts.max === undefined || n <= opts.max, {
        message: opts.max !== undefined ? `Tối đa ${opts.max}` : "",
      })
      .nullable(),
  );

const nullableString = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.string().trim().nullable(),
);

const nullableUuid = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.string().uuid().nullable(),
);

export const PersonInputSchema = z
  .object({
    full_name: z
      .string({ required_error: "Bắt buộc" })
      .trim()
      .min(1, "Bắt buộc"),
    other_names: nullableString,
    gender: z.enum(["male", "female", "other"], {
      required_error: "Bắt buộc",
    }),

    branch_id: nullableUuid,

    birth_year: nullableInt({ min: 1000, max: 2200 }),
    birth_month: nullableInt({ min: 1, max: 12 }),
    birth_day: nullableInt({ min: 1, max: 31 }),

    death_year: nullableInt({ min: 1000, max: 2200 }),
    death_month: nullableInt({ min: 1, max: 12 }),
    death_day: nullableInt({ min: 1, max: 31 }),

    death_lunar_year: nullableInt({ min: 1000, max: 2200 }),
    death_lunar_month: nullableInt({ min: 1, max: 12 }),
    death_lunar_day: nullableInt({ min: 1, max: 30 }),

    is_deceased: z.coerce.boolean().default(false),
    is_in_law: z.coerce.boolean().default(false),

    birth_order: nullableInt({ min: 1 }),
    generation: nullableInt({ min: 0 }),

    avatar_url: nullableString,
    note: nullableString,
  })
  .superRefine((val, ctx) => {
    // Birth and death dates are deliberately optional. Many older Vietnamese
    // gia phả records preserve a name and lineage position without precise
    // dates, and the app must accept those entries unchanged. The only
    // sanity check we keep is "death cannot precede birth" — and only when
    // both are actually present.
    if (
      val.birth_year &&
      val.death_year &&
      val.death_year < val.birth_year
    ) {
      ctx.addIssue({
        path: ["death_year"],
        code: z.ZodIssueCode.custom,
        message: "Năm mất không thể trước năm sinh",
      });
    }
  });

export type PersonInput = z.infer<typeof PersonInputSchema>;

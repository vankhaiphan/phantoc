import { z } from "zod";

const nullableInt = z.preprocess(
  (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  },
  z.number().int().nullable(),
);

const nullableString = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.string().trim().nullable(),
);

const nullableDate = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Định dạng: YYYY-MM-DD")
    .nullable(),
);

export const RelationshipInputSchema = z
  .object({
    type: z.enum(["marriage", "biological_child", "adopted_child"], {
      required_error: "Bắt buộc",
    }),
    person_a: z.string().uuid("Không hợp lệ"),
    person_b: z.string().uuid("Không hợp lệ"),
    note: nullableString,
    marriage_order: nullableInt,
    started_at: nullableDate,
    ended_at: nullableDate,
  })
  .refine((val) => val.person_a !== val.person_b, {
    path: ["person_b"],
    message: "Hai người phải khác nhau",
  });

export type RelationshipInput = z.infer<typeof RelationshipInputSchema>;

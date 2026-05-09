import type { Gender, RelationshipType } from "@/types";
import type { KinshipPerson } from "../terms";

/**
 * Test helpers — build small kinship graphs without paying the cost of
 * constructing full Person / Relationship records.
 */

export interface TestRel {
  type: RelationshipType;
  person_a: string;
  person_b: string;
}

export function person(
  id: string,
  full_name: string,
  gender: Gender,
  opts: {
    birth_year?: number | null;
    birth_order?: number | null;
    generation?: number | null;
    is_in_law?: boolean;
  } = {},
): KinshipPerson {
  return {
    id,
    full_name,
    gender,
    birth_year: opts.birth_year ?? null,
    birth_order: opts.birth_order ?? null,
    generation: opts.generation ?? null,
    is_in_law: opts.is_in_law ?? false,
  };
}

/** Mark `parent` as the biological parent of `child`. */
export function child(parent: string, child: string): TestRel {
  return { type: "biological_child", person_a: parent, person_b: child };
}

/** Adopted variant — engine treats identically by default. */
export function adopted(parent: string, child: string): TestRel {
  return { type: "adopted_child", person_a: parent, person_b: child };
}

/** Marriage edge (symmetric). */
export function marriage(a: string, b: string): TestRel {
  return { type: "marriage", person_a: a, person_b: b };
}

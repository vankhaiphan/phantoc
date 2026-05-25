import type { Gender, KinshipSide } from "@/types";

/**
 * Vietnamese kinship vocabulary.
 *
 * Ported from the reference's `kinshipHelpers.ts` (utils/) and refactored to:
 *   - separate vocabulary from algorithm
 *   - return structured results (term + side + certainty) instead of plain strings
 *
 * See docs/architecture-proposal.md §5 for the full design.
 */

// ─── Person shape consumed by the engine ───────────────────────────────────
//
// The engine works on a small subset of `Person`. We accept anything
// structurally compatible — typically `Person` or `PersonNode` from @/types.

export interface KinshipPerson {
  id: string;
  full_name: string;
  gender: Gender;
  birth_year: number | null;
  birth_order: number | null;
  generation?: number | null;
  is_in_law?: boolean;
}

// ─── Ancestor / descendant term arrays (depth-indexed) ─────────────────────

/**
 * Direct-line ancestor labels indexed by depth.
 *
 * Depth 1–4 are standard literary Vietnamese. Depth 5+ uses traditional
 * chain forms; very few families use anything beyond depth 4 in practice,
 * so beyond that we fall back to "Tổ đời thứ N".
 */
const ANCESTOR_LABELS = ["", "Bố/Mẹ", "Ông/Bà", "Cụ", "Kỵ", "Sơ"] as const;

/** Direct-line descendant labels indexed by depth. */
const DESCENDANT_LABELS = [
  "",
  "Con",
  "Cháu",
  "Chắt",
  "Chít",
  "Chút",
] as const;

// ─── Direct-line term resolution ───────────────────────────────────────────

/**
 * Term used by the descendant addressing the ancestor at `depth`.
 * `ancestorGender` is the gender of the ancestor; `isPaternal` is true when
 * the immediate child of the ancestor (toward the descendant) is male.
 */
export function getDirectAncestorTerm(
  depth: number,
  ancestorGender: Gender,
  isPaternal: boolean,
): string {
  if (depth === 1) return ancestorGender === "female" ? "Mẹ" : "Bố";
  if (depth === 2) {
    const base = ancestorGender === "female" ? "Bà" : "Ông";
    return `${base} ${isPaternal ? "nội" : "ngoại"}`;
  }
  if (depth === 3) {
    const base = ancestorGender === "female" ? "Cụ bà" : "Cụ ông";
    return `${base} ${isPaternal ? "nội" : "ngoại"}`;
  }
  if (depth === 4) return "Kỵ";
  if (depth === 5) return "Sơ";
  return `Tổ đời thứ ${depth}`;
}

/**
 * Term used by the ancestor addressing the descendant at `depth`.
 * Vietnamese typically genders descendants only at depth 1
 * ("Con trai/gái") — beyond that, we keep the neutral form.
 */
export function getDirectDescendantTerm(
  depth: number,
  descendantGender: Gender,
): string {
  if (depth === 1) {
    if (descendantGender === "male") return "Con trai";
    if (descendantGender === "female") return "Con gái";
    return "Con";
  }
  return DESCENDANT_LABELS[depth] ?? `Cháu đời thứ ${depth}`;
}

// ─── Sibling / cousin term resolution ──────────────────────────────────────

/**
 * Symmetric sibling relation. Returns the term junior calls senior and
 * the term senior calls junior, given who is older.
 */
export function getSiblingTerms(
  aGender: Gender,
  bGender: Gender,
  aIsSenior: boolean,
  isHalf: boolean,
): { aCallsB: string; bCallsA: string; description: string } {
  const halfQual = isHalf ? " (cùng cha khác mẹ hoặc cùng mẹ khác cha)" : "";
  const description = isHalf ? "Anh chị em cùng huyết" : "Anh chị em ruột";
  const senior = (g: Gender) => (g === "female" ? "Chị gái" : "Anh trai");
  const junior = (g: Gender) => (g === "female" ? "Em gái" : "Em trai");

  if (aIsSenior) {
    return {
      aCallsB: junior(bGender),
      bCallsA: senior(aGender),
      description: description + halfQual,
    };
  }
  return {
    aCallsB: senior(bGender),
    bCallsA: junior(aGender),
    description: description + halfQual,
  };
}

/**
 * Uncle/aunt term — B is sibling of A's ancestor at depth (depthA - 1).
 * `branchGender` is the gender of A's ancestor on the path to LCA at depth 1
 * (the LCA's child on A's side) — this determines Nội vs Ngoại.
 * `bIsSenior` means B is older than that ancestor.
 */
export function getUncleAuntTerm(
  depthA: number,
  bGender: Gender,
  branchGender: Gender,
  bIsSenior: boolean,
): { term: string; isPaternal: boolean } {
  const isPaternal = branchGender === "male";

  // Base term — uncle/aunt of A's parent
  let base: string;
  if (isPaternal) {
    if (bGender === "female") base = bIsSenior ? "Bác" : "Cô";
    else base = bIsSenior ? "Bác" : "Chú";
  } else {
    if (bGender === "female") base = "Dì";
    else base = "Cậu";
  }

  // Depth >= 3 means B is sibling of a grandparent or higher — prefix with the
  // generation marker. This mirrors how Vietnamese addresses grand-uncles
  // (e.g. "Ông chú", "Bà cô").
  let prefix = "";
  if (depthA === 3) prefix = bGender === "female" ? "Bà " : "Ông ";
  else if (depthA === 4) prefix = bGender === "female" ? "Cụ bà " : "Cụ ông ";
  else if (depthA > 4) prefix = `${ANCESTOR_LABELS[depthA - 1] ?? `Đời ${depthA - 1}`} `;

  return { term: (prefix + base).trim(), isPaternal };
}

/**
 * Cousin term — same generation (depthA === depthB > 1).
 * "Anh/Chị/Em họ" with Nội/Ngoại side from A's branch gender.
 */
export function getCousinTerms(
  aGender: Gender,
  bGender: Gender,
  aIsSenior: boolean,
  branchGender: Gender,
): { aCallsB: string; bCallsA: string; description: string; isPaternal: boolean } {
  const isPaternal = branchGender === "male";
  const sideLabel = isPaternal ? "Nội" : "Ngoại";

  if (aIsSenior) {
    return {
      aCallsB: "Em họ",
      bCallsA: aGender === "female" ? "Chị họ" : "Anh họ",
      description: `Anh em họ ${sideLabel}`,
      isPaternal,
    };
  }
  return {
    aCallsB: bGender === "female" ? "Chị họ" : "Anh họ",
    bCallsA: "Em họ",
    description: `Anh em họ ${sideLabel}`,
    isPaternal,
  };
}

/**
 * Distant-cousin term — different generations beyond depth 1 each
 * (e.g. parent's cousin = "Bác họ" / "Chú họ" / etc.)
 */
export function getDistantCousinTerms(
  depthA: number,
  depthB: number,
  bGender: Gender,
  branchGender: Gender,
  bIsSenior: boolean,
): { term: string; isPaternal: boolean } {
  const isPaternal = branchGender === "male";
  const genDiff = depthA - depthB; // positive: B is older generation

  if (genDiff === 1) {
    // B is in A's parent's generation
    if (isPaternal) {
      if (bGender === "female") return { term: bIsSenior ? "Bác họ" : "Cô họ", isPaternal };
      return { term: bIsSenior ? "Bác họ" : "Chú họ", isPaternal };
    }
    return { term: bGender === "female" ? "Dì họ" : "Cậu họ", isPaternal };
  }

  // Two or more generations up: distant great-uncle/aunt
  return { term: bGender === "female" ? "Bà họ" : "Ông họ", isPaternal };
}

// ─── Side resolution helper ────────────────────────────────────────────────

/**
 * Resolve Nội/Ngoại/marital/self based on path geometry.
 * For pure blood relations: side from A's perspective via the gender of
 * A's first step toward the LCA. For direct lineage where A is the LCA,
 * fall back to B's perspective.
 */
export function computeSide(
  depthA: number,
  depthB: number,
  pathA: KinshipPerson[],
  pathB: KinshipPerson[],
): KinshipSide {
  if (depthA > 0 && pathA.length > 0) {
    return pathA[pathA.length - 1].gender === "male" ? "paternal" : "maternal";
  }
  if (depthB > 0 && pathB.length > 0) {
    return pathB[pathB.length - 1].gender === "male" ? "paternal" : "maternal";
  }
  return "self";
}

// ─── Marriage suffix transforms ────────────────────────────────────────────
//
// These wrap a blood-kinship term with a marriage hop. Used when the
// connection between A and B passes through one or both spouses.

/**
 * A is connected to B via A's spouse (sA, with sA's blood relation to B).
 * Returns A's term for B, and B's term for A, after the wrap.
 *
 * Vietnamese convention: A addresses B as "{spouse-blood-term} {vợ|chồng}"
 * (e.g. "Bố vợ", "Anh vợ"); B addresses A as "Con dâu" / "Con rể" / "Anh rể"
 * / "Chị dâu" / etc.
 */
export function wrapThroughASpouse(
  res: { aCallsB: string; bCallsA: string },
  aGender: Gender,
): { aCallsB: string; bCallsA: string } {
  const suffix = aGender === "male" ? " vợ" : " chồng";
  let aCallsB = res.aCallsB;
  let bCallsA = res.bCallsA;

  // A → B: A addresses someone in A's spouse's family
  if (
    res.aCallsB === "Bố" ||
    res.aCallsB === "Mẹ" ||
    res.aCallsB.startsWith("Ông") ||
    res.aCallsB.startsWith("Bà") ||
    res.aCallsB.startsWith("Cụ")
  ) {
    aCallsB = res.aCallsB + suffix;
  } else if (res.aCallsB.includes("Anh trai")) {
    aCallsB = "Anh" + suffix;
  } else if (res.aCallsB.includes("Chị gái")) {
    aCallsB = "Chị" + suffix;
  } else if (res.aCallsB === "Em họ") {
    aCallsB = "Em" + suffix + " (họ)";
  } else if (res.aCallsB === "Chị họ") {
    aCallsB = "Chị" + suffix + " (họ)";
  } else if (res.aCallsB === "Anh họ") {
    aCallsB = "Anh" + suffix + " (họ)";
  } else if (res.aCallsB.includes("Em")) {
    aCallsB = "Em" + suffix;
  } else if (
    ["Bác", "Chú", "Cô", "Cậu", "Dì"].includes(res.aCallsB) ||
    res.aCallsB.endsWith(" họ")
  ) {
    aCallsB = res.aCallsB.replace(" họ", "") + suffix;
  }

  // B → A: B addresses A as the dâu/rể of B's blood relative
  if (res.bCallsA === "Con" || res.bCallsA === "Con trai" || res.bCallsA === "Con gái") {
    bCallsA = aGender === "male" ? "Con rể" : "Con dâu";
  } else if (res.bCallsA === "Cháu") {
    bCallsA = aGender === "male" ? "Cháu rể" : "Cháu dâu";
  } else if (res.bCallsA.includes("Anh trai") || res.bCallsA.includes("Chị gái")) {
    bCallsA = aGender === "male" ? "Anh rể" : "Chị dâu";
  } else if (res.bCallsA.includes("Em")) {
    bCallsA = aGender === "male" ? "Em rể" : "Em dâu";
    if (res.bCallsA.includes("họ")) bCallsA += " (họ)";
  } else if (res.bCallsA === "Chị họ") {
    bCallsA = "Anh rể (họ)";
  } else if (res.bCallsA === "Anh họ") {
    bCallsA = "Chị dâu (họ)";
  } else if (res.bCallsA === "Chú") {
    bCallsA = "Thím"; // vợ của Chú = Thím (không phải Cô — Cô là chị/em gái ruột của Bố)
  } else if (res.bCallsA === "Chú họ") {
    bCallsA = "Thím họ";
  } else if (res.bCallsA === "Cô") {
    bCallsA = "Chú";
  } else if (res.bCallsA === "Cậu") {
    bCallsA = "Dì";
  } else if (res.bCallsA === "Dì") {
    bCallsA = "Cậu";
  } else {
    bCallsA = (aGender === "male" ? "Chồng" : "Vợ") + " của " + res.bCallsA;
  }

  return { aCallsB, bCallsA };
}

/**
 * A is connected to B via B's spouse (sB, with A's blood relation to sB).
 * Mirror of `wrapThroughASpouse` from B's perspective.
 */
export function wrapThroughBSpouse(
  res: { aCallsB: string; bCallsA: string },
  bGender: Gender,
): { aCallsB: string; bCallsA: string } {
  const suffix = bGender === "male" ? " vợ" : " chồng";
  let aCallsB = res.aCallsB;
  let bCallsA = res.bCallsA;

  // A → B: A addresses B as the dâu/rể of A's blood relative
  if (res.aCallsB === "Con" || res.aCallsB === "Con trai" || res.aCallsB === "Con gái") {
    aCallsB = bGender === "male" ? "Con rể" : "Con dâu";
  } else if (res.aCallsB === "Cháu") {
    aCallsB = bGender === "male" ? "Cháu rể" : "Cháu dâu";
  } else if (res.aCallsB.includes("Anh trai") || res.aCallsB.includes("Chị gái")) {
    aCallsB = bGender === "male" ? "Anh rể" : "Chị dâu";
  } else if (res.aCallsB.includes("Chị họ")) {
    aCallsB = "Anh rể (họ)";
  } else if (res.aCallsB.includes("Anh họ")) {
    aCallsB = "Chị dâu (họ)";
  } else if (res.aCallsB.includes("Em")) {
    aCallsB = bGender === "male" ? "Em rể" : "Em dâu";
    if (res.aCallsB.includes("họ")) aCallsB += " (họ)";
  } else if (res.aCallsB === "Chú") {
    aCallsB = "Thím"; // vợ của Chú = Thím
  } else if (res.aCallsB === "Chú họ") {
    aCallsB = "Thím họ";
  } else if (res.aCallsB === "Cô") {
    aCallsB = "Chú";
  } else if (res.aCallsB === "Cậu") {
    aCallsB = "Dì";
  } else if (res.aCallsB === "Dì") {
    aCallsB = "Cậu";
  } else {
    aCallsB = (bGender === "male" ? "Chồng" : "Vợ") + " của " + res.aCallsB;
  }

  // B → A: B addresses someone in B's spouse's family
  if (
    res.bCallsA === "Bố" ||
    res.bCallsA === "Mẹ" ||
    res.bCallsA.startsWith("Ông") ||
    res.bCallsA.startsWith("Bà") ||
    res.bCallsA.startsWith("Cụ")
  ) {
    bCallsA = res.bCallsA + suffix;
  } else if (res.bCallsA.includes("Anh trai")) {
    bCallsA = "Anh" + suffix;
  } else if (res.bCallsA.includes("Chị gái")) {
    bCallsA = "Chị" + suffix;
  } else if (res.bCallsA === "Em họ") {
    bCallsA = "Em" + suffix + " (họ)";
  } else if (res.bCallsA === "Chị họ") {
    bCallsA = "Chị" + suffix + " (họ)";
  } else if (res.bCallsA === "Anh họ") {
    bCallsA = "Anh" + suffix + " (họ)";
  } else if (res.bCallsA.includes("Em")) {
    bCallsA = "Em" + suffix;
  } else if (
    ["Bác", "Chú", "Cô", "Cậu", "Dì"].includes(res.bCallsA) ||
    res.bCallsA.endsWith(" họ")
  ) {
    bCallsA = res.bCallsA.replace(" họ", "") + suffix;
  }

  return { aCallsB, bCallsA };
}

/**
 * Both A and B reach a blood path only via their respective spouses.
 * Special case: when sA and sB are full siblings, A and B are
 * "anh em cột chèo" (men married to sisters) or "chị em dâu" (women
 * married to brothers). Otherwise it's the generic "{prefix} của {term}".
 */
export function wrapThroughBothSpouses(
  res: { aCallsB: string; bCallsA: string; description: string },
  aGender: Gender,
  bGender: Gender,
  sAGender: Gender,
  sBGender: Gender,
): { aCallsB: string; bCallsA: string } {
  const prefixA = aGender === "male" ? "Chồng" : "Vợ";
  const prefixB = bGender === "male" ? "Chồng" : "Vợ";

  // sA and sB siblings → cột chèo / chị em dâu
  if (res.description.startsWith("Anh chị em ruột")) {
    if (
      aGender === "male" &&
      bGender === "male" &&
      sAGender === "female" &&
      sBGender === "female"
    ) {
      return { aCallsB: "Anh em cột chèo", bCallsA: "Anh em cột chèo" };
    }
    if (
      aGender === "female" &&
      bGender === "female" &&
      sAGender === "male" &&
      sBGender === "male"
    ) {
      return { aCallsB: "Chị em dâu", bCallsA: "Chị em dâu" };
    }
  }

  return {
    aCallsB: `${prefixB} của ${res.aCallsB}`,
    bCallsA: `${prefixA} của ${res.bCallsA}`,
  };
}

// ─── Comparators ───────────────────────────────────────────────────────────

/**
 * Compare seniority of two people of the same generation.
 * Falls back to birth_year if birth_order is missing on either side.
 */
export function compareSeniority(
  a: KinshipPerson | undefined,
  b: KinshipPerson | undefined,
): "senior" | "junior" | "equal" {
  if (!a || !b || a.id === b.id) return "equal";

  if (a.birth_order != null && b.birth_order != null) {
    if (a.birth_order < b.birth_order) return "senior";
    if (a.birth_order > b.birth_order) return "junior";
  }
  if (a.birth_year != null && b.birth_year != null) {
    if (a.birth_year < b.birth_year) return "senior";
    if (a.birth_year > b.birth_year) return "junior";
  }
  return "equal";
}

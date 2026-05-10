/**
 * CSV import / export.
 *
 * Two CSVs round-trip the dataset: `persons.csv` and `relationships.csv`.
 * Columns are chosen so an editor can open the file in Excel / Google
 * Sheets, fix typos, and paste back without losing data.
 *
 * Design notes:
 *   – IDs are the canonical join key. The optional *_name columns are
 *     present for human readability only; the parser ignores them.
 *   – Boolean columns are written as the literal strings "true" / "false"
 *     (papaparse keeps them as strings; we coerce in the parser).
 *   – Empty cells become `null`, never `""`. This matches the DB schema's
 *     nullable shape.
 */
import Papa from "papaparse";
import type { Branch, Person, Relationship, Gender, RelationshipType } from "@/types";

// ─── Persons ─────────────────────────────────────────────────────────────────

const PERSON_HEADERS = [
  "id",
  "full_name",
  "other_names",
  "gender",
  "branch_id",
  "branch_name",
  "birth_year",
  "birth_month",
  "birth_day",
  "death_year",
  "death_month",
  "death_day",
  "death_lunar_year",
  "death_lunar_month",
  "death_lunar_day",
  "is_deceased",
  "is_in_law",
  "birth_order",
  "generation",
  "avatar_url",
  "note",
] as const;

export function buildPersonsCsv(
  persons: Person[],
  branches: Branch[] = [],
): string {
  const branchById = new Map(branches.map((b) => [b.id, b.name]));
  const rows = persons.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    other_names: p.other_names ?? "",
    gender: p.gender,
    branch_id: p.branch_id ?? "",
    branch_name: p.branch_id ? (branchById.get(p.branch_id) ?? "") : "",
    birth_year: p.birth_year ?? "",
    birth_month: p.birth_month ?? "",
    birth_day: p.birth_day ?? "",
    death_year: p.death_year ?? "",
    death_month: p.death_month ?? "",
    death_day: p.death_day ?? "",
    death_lunar_year: p.death_lunar_year ?? "",
    death_lunar_month: p.death_lunar_month ?? "",
    death_lunar_day: p.death_lunar_day ?? "",
    is_deceased: String(p.is_deceased),
    is_in_law: String(p.is_in_law),
    birth_order: p.birth_order ?? "",
    generation: p.generation ?? "",
    avatar_url: p.avatar_url ?? "",
    note: p.note ?? "",
  }));
  return Papa.unparse({ fields: [...PERSON_HEADERS], data: rows });
}

export interface ParsedPersonRow {
  id: string | null;
  full_name: string;
  other_names: string | null;
  gender: Gender;
  branch_id: string | null;
  birth_year: number | null;
  birth_month: number | null;
  birth_day: number | null;
  death_year: number | null;
  death_month: number | null;
  death_day: number | null;
  death_lunar_year: number | null;
  death_lunar_month: number | null;
  death_lunar_day: number | null;
  is_deceased: boolean;
  is_in_law: boolean;
  birth_order: number | null;
  generation: number | null;
  avatar_url: string | null;
  note: string | null;
}

export interface ParseResult<T> {
  rows: T[];
  errors: { row: number; message: string }[];
}

export function parsePersonsCsv(input: string): ParseResult<ParsedPersonRow> {
  const parsed = Papa.parse<Record<string, string>>(input, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const errors: { row: number; message: string }[] = [];
  for (const e of parsed.errors) {
    errors.push({ row: (e.row ?? 0) + 2, message: e.message });
  }

  const rows: ParsedPersonRow[] = [];
  parsed.data.forEach((raw, idx) => {
    const lineNum = idx + 2; // header + 1-indexed
    if (!raw.full_name?.trim()) {
      errors.push({ row: lineNum, message: "Thiếu full_name" });
      return;
    }
    const gender = parseGender(raw.gender);
    if (!gender) {
      errors.push({ row: lineNum, message: `Giới tính không hợp lệ: "${raw.gender}"` });
      return;
    }
    rows.push({
      id: nullIfBlank(raw.id),
      full_name: raw.full_name.trim(),
      other_names: nullIfBlank(raw.other_names),
      gender,
      branch_id: nullIfBlank(raw.branch_id),
      birth_year: parseIntOrNull(raw.birth_year),
      birth_month: parseIntOrNull(raw.birth_month),
      birth_day: parseIntOrNull(raw.birth_day),
      death_year: parseIntOrNull(raw.death_year),
      death_month: parseIntOrNull(raw.death_month),
      death_day: parseIntOrNull(raw.death_day),
      death_lunar_year: parseIntOrNull(raw.death_lunar_year),
      death_lunar_month: parseIntOrNull(raw.death_lunar_month),
      death_lunar_day: parseIntOrNull(raw.death_lunar_day),
      is_deceased: parseBool(raw.is_deceased),
      is_in_law: parseBool(raw.is_in_law),
      birth_order: parseIntOrNull(raw.birth_order),
      generation: parseIntOrNull(raw.generation),
      avatar_url: nullIfBlank(raw.avatar_url),
      note: nullIfBlank(raw.note),
    });
  });
  return { rows, errors };
}

// ─── Relationships ───────────────────────────────────────────────────────────

const REL_HEADERS = [
  "id",
  "type",
  "person_a_id",
  "person_a_name",
  "person_b_id",
  "person_b_name",
  "marriage_order",
  "started_at",
  "ended_at",
  "note",
] as const;

export function buildRelationshipsCsv(
  rels: Relationship[],
  persons: Person[] = [],
): string {
  const nameById = new Map(persons.map((p) => [p.id, p.full_name]));
  const rows = rels.map((r) => ({
    id: r.id,
    type: r.type,
    person_a_id: r.person_a,
    person_a_name: nameById.get(r.person_a) ?? "",
    person_b_id: r.person_b,
    person_b_name: nameById.get(r.person_b) ?? "",
    marriage_order: r.marriage_order ?? "",
    started_at: r.started_at ?? "",
    ended_at: r.ended_at ?? "",
    note: r.note ?? "",
  }));
  return Papa.unparse({ fields: [...REL_HEADERS], data: rows });
}

export interface ParsedRelationshipRow {
  id: string | null;
  type: RelationshipType;
  person_a: string;
  person_b: string;
  marriage_order: number | null;
  started_at: string | null;
  ended_at: string | null;
  note: string | null;
}

const REL_TYPES: ReadonlySet<RelationshipType> = new Set([
  "marriage",
  "biological_child",
  "adopted_child",
]);

export function parseRelationshipsCsv(
  input: string,
): ParseResult<ParsedRelationshipRow> {
  const parsed = Papa.parse<Record<string, string>>(input, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const errors: { row: number; message: string }[] = [];
  for (const e of parsed.errors) {
    errors.push({ row: (e.row ?? 0) + 2, message: e.message });
  }

  const rows: ParsedRelationshipRow[] = [];
  parsed.data.forEach((raw, idx) => {
    const lineNum = idx + 2;
    const type = (raw.type ?? "").trim() as RelationshipType;
    if (!REL_TYPES.has(type)) {
      errors.push({ row: lineNum, message: `Loại quan hệ không hợp lệ: "${raw.type}"` });
      return;
    }
    if (!raw.person_a_id?.trim() || !raw.person_b_id?.trim()) {
      errors.push({ row: lineNum, message: "Thiếu person_a_id hoặc person_b_id" });
      return;
    }
    if (raw.person_a_id.trim() === raw.person_b_id.trim()) {
      errors.push({ row: lineNum, message: "person_a và person_b không thể trùng nhau" });
      return;
    }
    rows.push({
      id: nullIfBlank(raw.id),
      type,
      person_a: raw.person_a_id.trim(),
      person_b: raw.person_b_id.trim(),
      marriage_order: parseIntOrNull(raw.marriage_order),
      started_at: nullIfBlank(raw.started_at),
      ended_at: nullIfBlank(raw.ended_at),
      note: nullIfBlank(raw.note),
    });
  });
  return { rows, errors };
}

// ─── Internals ───────────────────────────────────────────────────────────────

function nullIfBlank(v: string | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function parseIntOrNull(v: string | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function parseBool(v: string | undefined): boolean {
  if (!v) return false;
  const t = v.trim().toLowerCase();
  return t === "true" || t === "1" || t === "yes" || t === "y";
}

function parseGender(v: string | undefined): Gender | null {
  const t = (v ?? "").trim().toLowerCase();
  if (t === "male" || t === "m" || t === "nam") return "male";
  if (t === "female" || t === "f" || t === "nữ" || t === "nu") return "female";
  if (t === "other" || t === "o" || t === "khác" || t === "khac") return "other";
  return null;
}

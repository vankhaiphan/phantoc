/**
 * GEDCOM 5.5.1 import / export.
 *
 * Scope is intentionally narrow: round-trip the fields phantoc actually
 * stores — names, sex, birth/death dates, parent/child edges, marriages.
 * Extended GEDCOM features (sources, citations, residences, multimedia
 * records) are not preserved on either side.
 *
 * The exporter writes a deterministic record order so two consecutive
 * exports of an unchanged dataset produce identical files (useful for
 * diff-style backups).
 */
import type { Person, Relationship } from "@/types";

export interface GedcomExportOptions {
  /** Header SOUR tag — defaults to "PHANTOC". */
  source?: string;
  /** Submitter name. Optional; some readers require it. */
  submitter?: string;
}

const GEDCOM_MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const SEX_OUT: Record<Person["gender"], string> = {
  male: "M",
  female: "F",
  other: "U",
};

const SEX_IN: Record<string, Person["gender"]> = {
  M: "male",
  F: "female",
  U: "other",
};

// ─── Export ──────────────────────────────────────────────────────────────────

/**
 * Build a GEDCOM 5.5.1 string from phantoc persons + relationships.
 *
 * FAM records are derived as follows:
 *   – Every marriage edge becomes a FAM with HUSB/WIFE assigned by gender.
 *   – Children with two recorded parents that match an existing marriage
 *     edge are attached to that FAM.
 *   – Children with one recorded parent (or two parents who aren't married
 *     in the data) get a synthetic single-parent FAM.
 */
export function buildGedcom(
  persons: Person[],
  relationships: Relationship[],
  opts: GedcomExportOptions = {},
): string {
  const source = opts.source ?? "PHANTOC";
  const lines: string[] = [];

  // ── Header ──
  lines.push("0 HEAD");
  lines.push(`1 SOUR ${source}`);
  lines.push("2 NAME Phan Tộc — Gia Phả Họ Phan");
  lines.push("1 GEDC");
  lines.push("2 VERS 5.5.1");
  lines.push("2 FORM LINEAGE-LINKED");
  lines.push("1 CHAR UTF-8");
  if (opts.submitter) {
    lines.push("1 SUBM @SUBM1@");
  }
  lines.push(`1 DATE ${formatGedcomDate(new Date())}`);

  if (opts.submitter) {
    lines.push("0 @SUBM1@ SUBM");
    lines.push(`1 NAME ${opts.submitter}`);
  }

  // ── Stable XREF assignment ──
  // GEDCOM XREF IDs must be ≤ 22 chars and start with a letter, so we use
  // a sequential numbering rather than embedding the UUID. The map is what
  // links the FAM records back to INDI references.
  const orderedPersons = [...persons].sort((a, b) =>
    a.full_name.localeCompare(b.full_name, "vi"),
  );
  const indiId = new Map<string, string>();
  orderedPersons.forEach((p, i) => indiId.set(p.id, `@I${i + 1}@`));

  // ── Build FAM records before writing INDI so we can emit FAMS/FAMC links ──
  const families = buildFamilies(persons, relationships);
  const famsByPerson = new Map<string, string[]>();
  const famcByPerson = new Map<string, string[]>();
  families.forEach((fam, i) => {
    fam.xref = `@F${i + 1}@`;
    if (fam.husband) push(famsByPerson, fam.husband, fam.xref);
    if (fam.wife) push(famsByPerson, fam.wife, fam.xref);
    for (const c of fam.children) push(famcByPerson, c.childId, fam.xref);
  });

  // ── INDI records ──
  for (const p of orderedPersons) {
    const xref = indiId.get(p.id)!;
    lines.push(`0 ${xref} INDI`);
    lines.push(`1 NAME ${formatGedcomName(p.full_name)}`);
    if (p.other_names) {
      lines.push("2 NICK " + escapeText(p.other_names));
    }
    lines.push(`1 SEX ${SEX_OUT[p.gender]}`);

    const birth = formatPartialGedcomDate(
      p.birth_year,
      p.birth_month,
      p.birth_day,
    );
    if (birth) {
      lines.push("1 BIRT");
      lines.push(`2 DATE ${birth}`);
    }
    if (p.is_deceased) {
      const death = formatPartialGedcomDate(
        p.death_year,
        p.death_month,
        p.death_day,
      );
      lines.push("1 DEAT Y");
      if (death) lines.push(`2 DATE ${death}`);
    }
    if (p.note) {
      for (const ln of String(p.note).split(/\r?\n/)) {
        lines.push(`1 NOTE ${escapeText(ln)}`);
      }
    }
    for (const fam of famsByPerson.get(p.id) ?? []) lines.push(`1 FAMS ${fam}`);
    for (const fam of famcByPerson.get(p.id) ?? []) lines.push(`1 FAMC ${fam}`);
  }

  // ── FAM records ──
  for (const fam of families) {
    lines.push(`0 ${fam.xref} FAM`);
    if (fam.husband) lines.push(`1 HUSB ${indiId.get(fam.husband)}`);
    if (fam.wife) lines.push(`1 WIFE ${indiId.get(fam.wife)}`);
    for (const c of fam.children) {
      lines.push(`1 CHIL ${indiId.get(c.childId)}`);
    }
    if (fam.marriageDate) {
      lines.push("1 MARR");
      lines.push(`2 DATE ${fam.marriageDate}`);
    }
  }

  // ── Trailer ──
  lines.push("0 TRLR");
  return lines.join("\n") + "\n";
}

interface BuiltFamily {
  xref: string;
  husband: string | null;
  wife: string | null;
  children: { childId: string; relType: Relationship["type"] }[];
  marriageDate: string | null;
}

function buildFamilies(
  persons: Person[],
  rels: Relationship[],
): BuiltFamily[] {
  const personById = new Map(persons.map((p) => [p.id, p]));

  // Marriage edges → FAM seeds
  const families: BuiltFamily[] = [];
  const marriageKey = (a: string, b: string) => [a, b].sort().join("::");
  const familyByMarriage = new Map<string, BuiltFamily>();

  for (const r of rels) {
    if (r.type !== "marriage") continue;
    const pa = personById.get(r.person_a);
    const pb = personById.get(r.person_b);
    if (!pa || !pb) continue;
    const husband = pa.gender === "female" ? pb.id : pa.id;
    const wife = pa.gender === "female" ? pa.id : pb.id;
    const fam: BuiltFamily = {
      xref: "",
      husband: pa.gender === "other" && pb.gender === "other" ? null : husband,
      wife: pa.gender === "other" && pb.gender === "other" ? null : wife,
      children: [],
      marriageDate: r.started_at ? formatGedcomDateString(r.started_at) : null,
    };
    families.push(fam);
    familyByMarriage.set(marriageKey(r.person_a, r.person_b), fam);
  }

  // Index parents by child to attach children to families
  const parentsByChild = new Map<
    string,
    { parentId: string; type: Relationship["type"] }[]
  >();
  for (const r of rels) {
    if (r.type !== "biological_child" && r.type !== "adopted_child") continue;
    push2(parentsByChild, r.person_b, { parentId: r.person_a, type: r.type });
  }

  for (const [childId, parents] of parentsByChild) {
    if (parents.length === 0) continue;

    if (parents.length >= 2) {
      const [p1, p2] = parents;
      const fam = familyByMarriage.get(marriageKey(p1.parentId, p2.parentId));
      if (fam) {
        fam.children.push({ childId, relType: p1.type });
        continue;
      }
    }
    // Synthesize a single- or unmarried-parent FAM
    const synthetic: BuiltFamily = {
      xref: "",
      husband: null,
      wife: null,
      children: [{ childId, relType: parents[0].type }],
      marriageDate: null,
    };
    for (const p of parents) {
      const pp = personById.get(p.parentId);
      if (!pp) continue;
      if (pp.gender === "female" && !synthetic.wife) synthetic.wife = pp.id;
      else if (pp.gender === "male" && !synthetic.husband)
        synthetic.husband = pp.id;
      else if (!synthetic.husband) synthetic.husband = pp.id;
    }
    families.push(synthetic);
  }
  return families;
}

// ─── Date formatting ─────────────────────────────────────────────────────────

function formatPartialGedcomDate(
  year: number | null,
  month: number | null,
  day: number | null,
): string | null {
  if (!year && !month && !day) return null;
  const parts: string[] = [];
  if (day && month) parts.push(String(day));
  if (month) parts.push(GEDCOM_MONTHS[month - 1]!);
  if (year) parts.push(String(year));
  return parts.length === 0 ? null : parts.join(" ");
}

function formatGedcomDate(d: Date): string {
  return `${d.getDate()} ${GEDCOM_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatGedcomDateString(s: string): string {
  // Accept "YYYY-MM-DD" (Postgres DATE) and convert; pass through anything
  // else verbatim so the importer round-trip stays lossless.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  return `${parseInt(m[3]!, 10)} ${GEDCOM_MONTHS[parseInt(m[2]!, 10) - 1]} ${m[1]}`;
}

function formatGedcomName(fullName: string): string {
  // GEDCOM convention: surname goes between slashes. Vietnamese names lead
  // with the family name, so the first whitespace-separated token is the
  // surname.
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return `/${parts[0]}/`;
  const [surname, ...rest] = parts;
  return `${rest.join(" ")} /${surname}/`;
}

function escapeText(s: string): string {
  // GEDCOM lines are physically capped at 255 bytes by the spec. We trim
  // long lines rather than emitting CONT continuations because phantoc's
  // notes are typically short and CONT would complicate the parser.
  const cleaned = s.replace(/[\r\n]+/g, " ").trim();
  return cleaned.length > 240 ? cleaned.slice(0, 237) + "…" : cleaned;
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
}
function push2<K, V>(m: Map<K, V[]>, k: K, v: V) {
  push(m, k, v);
}

// ─── Import ──────────────────────────────────────────────────────────────────

export interface ParsedIndividual {
  /** Stable XREF (e.g. @I1@) — used to wire FAM cross-references. */
  xref: string;
  full_name: string;
  other_names: string | null;
  gender: Person["gender"];
  birth_year: number | null;
  birth_month: number | null;
  birth_day: number | null;
  death_year: number | null;
  death_month: number | null;
  death_day: number | null;
  is_deceased: boolean;
  note: string | null;
}

export interface ParsedFamily {
  xref: string;
  husband: string | null;
  wife: string | null;
  children: string[];
  marriageDate: { year: number | null; month: number | null; day: number | null } | null;
}

export interface ParsedGedcom {
  individuals: ParsedIndividual[];
  families: ParsedFamily[];
  warnings: string[];
}

/**
 * Parse a GEDCOM string into the same shape phantoc's UI uses to preview
 * an import. The parser is forgiving: unknown tags are ignored, missing
 * required tags become warnings rather than errors.
 */
export function parseGedcom(input: string): ParsedGedcom {
  const lines = normalizeLines(input);
  const individuals: ParsedIndividual[] = [];
  const families: ParsedFamily[] = [];
  const warnings: string[] = [];

  let cursor = 0;
  while (cursor < lines.length) {
    const line = lines[cursor]!;
    if (line.level === 0 && line.tag === "INDI" && line.xref) {
      const { record, next } = readBlock(lines, cursor);
      individuals.push(parseIndi(line.xref, record, warnings));
      cursor = next;
      continue;
    }
    if (line.level === 0 && line.tag === "FAM" && line.xref) {
      const { record, next } = readBlock(lines, cursor);
      families.push(parseFam(line.xref, record));
      cursor = next;
      continue;
    }
    cursor++;
  }

  return { individuals, families, warnings };
}

interface GedcomLine {
  level: number;
  xref: string | null;
  tag: string;
  value: string;
}

function normalizeLines(input: string): GedcomLine[] {
  const out: GedcomLine[] = [];
  for (const raw of input.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // "<level> [<xref>] <tag> [<value>]"
    const m = /^(\d+)\s+(?:(@[^@\s]+@)\s+)?(\S+)(?:\s(.*))?$/.exec(line);
    if (!m) continue;
    out.push({
      level: parseInt(m[1]!, 10),
      xref: m[2] ?? null,
      tag: m[3]!,
      value: (m[4] ?? "").trim(),
    });
  }
  return out;
}

function readBlock(
  lines: GedcomLine[],
  start: number,
): { record: GedcomLine[]; next: number } {
  const rootLevel = lines[start]!.level;
  let i = start + 1;
  while (i < lines.length && lines[i]!.level > rootLevel) i++;
  return { record: lines.slice(start, i), next: i };
}

function parseIndi(
  xref: string,
  record: GedcomLine[],
  warnings: string[],
): ParsedIndividual {
  let name = "";
  let nick: string | null = null;
  let gender: Person["gender"] = "other";
  let birth: PartialDate = {};
  let death: PartialDate = {};
  let isDeceased = false;
  let note: string | null = null;

  for (let i = 1; i < record.length; i++) {
    const ln = record[i]!;
    if (ln.level === 1) {
      if (ln.tag === "NAME") name = parseGedcomName(ln.value);
      else if (ln.tag === "SEX") gender = SEX_IN[ln.value.trim()] ?? "other";
      else if (ln.tag === "BIRT") {
        birth = readSubDate(record, i);
      } else if (ln.tag === "DEAT") {
        isDeceased = true;
        death = readSubDate(record, i);
      } else if (ln.tag === "NOTE") {
        note = note ? `${note}\n${ln.value}` : ln.value;
      }
    } else if (ln.level === 2 && ln.tag === "NICK") {
      nick = ln.value || null;
    }
  }

  if (!name) warnings.push(`${xref}: thiếu trường NAME`);

  return {
    xref,
    full_name: name || xref.replace(/@/g, ""),
    other_names: nick,
    gender,
    birth_year: birth.year ?? null,
    birth_month: birth.month ?? null,
    birth_day: birth.day ?? null,
    death_year: death.year ?? null,
    death_month: death.month ?? null,
    death_day: death.day ?? null,
    is_deceased: isDeceased,
    note,
  };
}

function parseFam(xref: string, record: GedcomLine[]): ParsedFamily {
  let husband: string | null = null;
  let wife: string | null = null;
  const children: string[] = [];
  let marriageDate: ParsedFamily["marriageDate"] = null;

  for (let i = 1; i < record.length; i++) {
    const ln = record[i]!;
    if (ln.level !== 1) continue;
    if (ln.tag === "HUSB") husband = ln.value || null;
    else if (ln.tag === "WIFE") wife = ln.value || null;
    else if (ln.tag === "CHIL") {
      if (ln.value) children.push(ln.value);
    } else if (ln.tag === "MARR") {
      const d = readSubDate(record, i);
      if (d.year || d.month || d.day) {
        marriageDate = {
          year: d.year ?? null,
          month: d.month ?? null,
          day: d.day ?? null,
        };
      }
    }
  }

  return { xref, husband, wife, children, marriageDate };
}

interface PartialDate {
  year?: number;
  month?: number;
  day?: number;
}

function readSubDate(record: GedcomLine[], parentIdx: number): PartialDate {
  const parentLevel = record[parentIdx]!.level;
  for (let j = parentIdx + 1; j < record.length; j++) {
    const sub = record[j]!;
    if (sub.level <= parentLevel) break;
    if (sub.tag === "DATE" && sub.value) return parseDateValue(sub.value);
  }
  return {};
}

function parseDateValue(value: string): PartialDate {
  // Strip qualifiers (ABT/BEF/AFT/EST/CAL/INT/FROM/TO) — phantoc only stores
  // exact partial dates, so we keep the year and discard the qualifier.
  const cleaned = value
    .replace(/\b(ABT|BEF|AFT|EST|CAL|INT|FROM|TO|BET|AND)\b/gi, "")
    .trim();

  // "DD MON YYYY", "MON YYYY", "YYYY"
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  let day: number | undefined;
  let month: number | undefined;
  let year: number | undefined;
  for (const t of tokens) {
    if (/^\d{4}$/.test(t)) {
      year = parseInt(t, 10);
    } else if (/^\d{1,2}$/.test(t) && day === undefined) {
      day = parseInt(t, 10);
    } else {
      const idx = GEDCOM_MONTHS.indexOf(t.toUpperCase());
      if (idx >= 0) month = idx + 1;
    }
  }
  return { year, month, day };
}

function parseGedcomName(value: string): string {
  // GEDCOM emits "Given Names /Surname/ Suffix". Vietnamese reading order
  // is surname-first, so we re-flow back to "Surname Given Names".
  const m = /^(.*?)\/([^/]+)\/(.*)$/.exec(value);
  if (!m) return value.trim();
  const given = m[1]!.trim();
  const surname = m[2]!.trim();
  const suffix = m[3]!.trim();
  return [surname, given, suffix].filter(Boolean).join(" ");
}

"use server";

import { revalidatePath } from "next/cache";
import { getIsAdmin, getIsEditor, getSupabase } from "@/lib/supabase/queries";
import {
  buildPersonsCsv,
  buildRelationshipsCsv,
  parsePersonsCsv,
  parseRelationshipsCsv,
} from "@/lib/csv";
import { buildGedcom, parseGedcom } from "@/lib/gedcom";
import type { Branch, Person, Relationship } from "@/types";

export interface ExportPayload {
  ok: boolean;
  text?: string;
  filename?: string;
  error?: string;
}

export interface ImportPayload {
  ok: boolean;
  inserted?: number;
  updated?: number;
  skipped?: number;
  warnings?: string[];
  error?: string;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export async function exportPersonsCsv(): Promise<ExportPayload> {
  if (!(await getIsEditor())) {
    return { ok: false, error: "Cần quyền biên soạn." };
  }
  const supabase = await getSupabase();
  const [{ data: persons }, { data: branches }] = await Promise.all([
    supabase.from("persons").select("*"),
    supabase.from("branches").select("*"),
  ]);
  const text = buildPersonsCsv(
    (persons ?? []) as Person[],
    (branches ?? []) as Branch[],
  );
  return { ok: true, text, filename: stampedFilename("persons", "csv") };
}

export async function exportRelationshipsCsv(): Promise<ExportPayload> {
  if (!(await getIsEditor())) {
    return { ok: false, error: "Cần quyền biên soạn." };
  }
  const supabase = await getSupabase();
  const [{ data: rels }, { data: persons }] = await Promise.all([
    supabase.from("relationships").select("*"),
    supabase.from("persons").select("id, full_name"),
  ]);
  const text = buildRelationshipsCsv(
    (rels ?? []) as Relationship[],
    (persons ?? []) as Person[],
  );
  return { ok: true, text, filename: stampedFilename("relationships", "csv") };
}

export async function exportGedcom(): Promise<ExportPayload> {
  if (!(await getIsEditor())) {
    return { ok: false, error: "Cần quyền biên soạn." };
  }
  const supabase = await getSupabase();
  const [{ data: persons }, { data: rels }] = await Promise.all([
    supabase.from("persons").select("*"),
    supabase.from("relationships").select("*"),
  ]);
  const text = buildGedcom(
    (persons ?? []) as Person[],
    (rels ?? []) as Relationship[],
  );
  return { ok: true, text, filename: stampedFilename("phantoc", "ged") };
}

// ─── Imports ─────────────────────────────────────────────────────────────────

/**
 * Import a persons CSV. Rows with `id` matching an existing record are
 * **updated**; rows without `id` are **inserted** (Postgres assigns a new
 * UUID via the column DEFAULT).
 */
export async function importPersonsCsv(
  text: string,
): Promise<ImportPayload> {
  if (!(await getIsAdmin())) {
    return { ok: false, error: "Chỉ Trưởng tộc mới nhập dữ liệu." };
  }
  const { rows, errors } = parsePersonsCsv(text);
  if (rows.length === 0) {
    return {
      ok: false,
      error: "Không có dòng hợp lệ.",
      warnings: errors.map((e) => `Dòng ${e.row}: ${e.message}`),
    };
  }
  const supabase = await getSupabase();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const warnings = errors.map((e) => `Dòng ${e.row}: ${e.message}`);

  for (const r of rows) {
    if (r.id) {
      const { error } = await supabase
        .from("persons")
        .update({ ...r, id: undefined })
        .eq("id", r.id);
      if (error) {
        warnings.push(`${r.full_name}: ${error.message}`);
        skipped++;
      } else {
        updated++;
      }
    } else {
      const { error } = await supabase
        .from("persons")
        .insert({ ...r, id: undefined });
      if (error) {
        warnings.push(`${r.full_name}: ${error.message}`);
        skipped++;
      } else {
        inserted++;
      }
    }
  }
  revalidatePath("/bang-dieu-khien/thanh-vien");
  revalidatePath("/cay");
  return { ok: true, inserted, updated, skipped, warnings };
}

export async function importRelationshipsCsv(
  text: string,
): Promise<ImportPayload> {
  if (!(await getIsAdmin())) {
    return { ok: false, error: "Chỉ Trưởng tộc mới nhập dữ liệu." };
  }
  const { rows, errors } = parseRelationshipsCsv(text);
  if (rows.length === 0) {
    return {
      ok: false,
      error: "Không có dòng hợp lệ.",
      warnings: errors.map((e) => `Dòng ${e.row}: ${e.message}`),
    };
  }
  const supabase = await getSupabase();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const warnings = errors.map((e) => `Dòng ${e.row}: ${e.message}`);

  for (const r of rows) {
    if (r.id) {
      const { error } = await supabase
        .from("relationships")
        .update({ ...r, id: undefined })
        .eq("id", r.id);
      if (error) {
        warnings.push(`${r.person_a} → ${r.person_b}: ${error.message}`);
        skipped++;
      } else {
        updated++;
      }
    } else {
      const { error } = await supabase
        .from("relationships")
        .insert({ ...r, id: undefined });
      if (error) {
        // 23505 = unique_violation: relationship already exists
        if (error.code === "23505") {
          skipped++;
        } else {
          warnings.push(`${r.person_a} → ${r.person_b}: ${error.message}`);
          skipped++;
        }
      } else {
        inserted++;
      }
    }
  }
  revalidatePath("/bang-dieu-khien/thanh-vien");
  revalidatePath("/cay");
  return { ok: true, inserted, updated, skipped, warnings };
}

/**
 * Import a GEDCOM file. Always inserts new persons (the import has no UUID
 * mapping back to the existing dataset). Returns counts and warnings; does
 * not attempt to merge.
 */
export async function importGedcom(text: string): Promise<ImportPayload> {
  if (!(await getIsAdmin())) {
    return { ok: false, error: "Chỉ Trưởng tộc mới nhập dữ liệu." };
  }
  const parsed = parseGedcom(text);
  if (parsed.individuals.length === 0) {
    return { ok: false, error: "Không tìm thấy bản ghi INDI." };
  }

  const supabase = await getSupabase();
  const xrefToId = new Map<string, string>();
  let inserted = 0;
  let skipped = 0;
  const warnings = [...parsed.warnings];

  // Insert individuals first
  for (const ind of parsed.individuals) {
    const { data, error } = await supabase
      .from("persons")
      .insert({
        full_name: ind.full_name,
        other_names: ind.other_names,
        gender: ind.gender,
        birth_year: ind.birth_year,
        birth_month: ind.birth_month,
        birth_day: ind.birth_day,
        death_year: ind.death_year,
        death_month: ind.death_month,
        death_day: ind.death_day,
        is_deceased: ind.is_deceased,
        note: ind.note,
      })
      .select("id")
      .single();
    if (error || !data) {
      warnings.push(`${ind.full_name}: ${error?.message ?? "không thêm được"}`);
      skipped++;
      continue;
    }
    xrefToId.set(ind.xref, data.id as string);
    inserted++;
  }

  // Then walk families to create marriage + parent edges
  let edgesInserted = 0;
  for (const fam of parsed.families) {
    const husbandId = fam.husband ? xrefToId.get(fam.husband) : null;
    const wifeId = fam.wife ? xrefToId.get(fam.wife) : null;
    if (husbandId && wifeId) {
      const { error } = await supabase.from("relationships").insert({
        type: "marriage",
        person_a: husbandId,
        person_b: wifeId,
        started_at: fam.marriageDate
          ? toIsoDate(
              fam.marriageDate.year,
              fam.marriageDate.month,
              fam.marriageDate.day,
            )
          : null,
      });
      if (!error) edgesInserted++;
      else if (error.code !== "23505") {
        warnings.push(`Hôn nhân ${fam.xref}: ${error.message}`);
      }
    }
    for (const childXref of fam.children) {
      const childId = xrefToId.get(childXref);
      if (!childId) continue;
      for (const parent of [husbandId, wifeId]) {
        if (!parent) continue;
        const { error } = await supabase.from("relationships").insert({
          type: "biological_child",
          person_a: parent,
          person_b: childId,
        });
        if (!error) edgesInserted++;
        else if (error.code !== "23505") {
          warnings.push(`Quan hệ con ${childXref}: ${error.message}`);
        }
      }
    }
  }

  revalidatePath("/bang-dieu-khien/thanh-vien");
  revalidatePath("/cay");
  return {
    ok: true,
    inserted: inserted + edgesInserted,
    updated: 0,
    skipped,
    warnings,
  };
}

// ─── Internals ───────────────────────────────────────────────────────────────

function stampedFilename(base: string, ext: string): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${base}-${stamp}.${ext}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toIsoDate(
  year: number | null,
  month: number | null,
  day: number | null,
): string | null {
  if (!year || !month || !day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

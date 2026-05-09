// ─── Enums ───────────────────────────────────────────────────────────────────

export type Gender = "male" | "female" | "other";

export type RelationshipType =
  | "marriage"
  | "biological_child"
  | "adopted_child";

export type UserRole = "admin" | "editor" | "member";

export type DocType =
  | "birth_certificate"
  | "death_certificate"
  | "marriage_certificate"
  | "id_card"
  | "gia_pha_scan"
  | "other";

export type AuditOp = "INSERT" | "UPDATE" | "DELETE";

// ─── Users & profiles ────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUserData {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

// ─── Branches (chi) ──────────────────────────────────────────────────────────

export interface Branch {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  parent_branch_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Persons ─────────────────────────────────────────────────────────────────

export interface Person {
  id: string;
  branch_id: string | null;

  full_name: string;
  other_names: string | null;
  gender: Gender;

  birth_year: number | null;
  birth_month: number | null;
  birth_day: number | null;
  death_year: number | null;
  death_month: number | null;
  death_day: number | null;

  // Lunar death date (giỗ)
  death_lunar_year: number | null;
  death_lunar_month: number | null;
  death_lunar_day: number | null;

  is_deceased: boolean;
  is_in_law: boolean;
  birth_order: number | null;
  generation: number | null;

  avatar_url: string | null;
  note: string | null;

  // Private — only present for admin reads
  phone_number?: string | null;
  occupation?: string | null;
  current_residence?: string | null;
  email?: string | null;
  address_history?: string | null;

  created_at: string;
  updated_at: string;
}

export interface PersonDetailsPrivate {
  person_id: string;
  phone_number: string | null;
  occupation: string | null;
  current_residence: string | null;
  email: string | null;
  address_history: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonPhoto {
  id: string;
  person_id: string;
  storage_path: string;
  caption: string | null;
  display_order: number;
  taken_at: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface PersonDocument {
  id: string;
  person_id: string;
  storage_path: string;
  title: string | null;
  doc_type: DocType;
  uploaded_by: string | null;
  created_at: string;
}

export interface MemorialPage {
  person_id: string;
  body_markdown: string;
  last_edited_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Relationships ───────────────────────────────────────────────────────────

export interface Relationship {
  id: string;
  type: RelationshipType;
  person_a: string;
  person_b: string;
  note: string | null;
  marriage_order: number | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Custom events ───────────────────────────────────────────────────────────

export interface CustomEvent {
  id: string;
  name: string;
  content: string | null;
  event_date: string;
  is_lunar: boolean;
  location: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Audit log ───────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  table_name: string;
  op: AuditOp;
  row_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  at: string;
}

// ─── UI helper types ─────────────────────────────────────────────────────────

export interface PersonWithDetails extends Person {
  spouses?: Person[];
  children?: Person[];
  parents?: Person[];
}

// ─── Kinship engine ──────────────────────────────────────────────────────────

export type KinshipSide = "paternal" | "maternal" | "marital" | "self";
export type KinshipCertainty = "certain" | "ambiguous" | "fallback";

export interface KinshipResult {
  /** A gọi B là gì */
  aCallsB: string;
  /** B gọi A là gì */
  bCallsA: string;
  /** Mô tả quan hệ */
  description: string;
  /** Tổng số bậc cách nhau qua tổ tiên chung */
  distance: number;
  /** Các bước trên đường đi */
  pathLabels: string[];
  /** Bên nội / ngoại / hôn nhân / chính bản thân */
  side: KinshipSide;
  /** Mức độ chắc chắn của kết quả — dùng cho UI */
  certainty: KinshipCertainty;
  /** ID tổ tiên chung — null nếu không xác định được */
  ancestorId: string | null;
}

export interface PersonNode {
  id: string;
  full_name: string;
  gender: Gender;
  birth_year: number | null;
  birth_order: number | null;
  generation: number | null;
  is_in_law: boolean;
}

-- =============================================================================
-- PHAN TỘC — Init migration
-- Schema for the Phan family genealogy archive (Cẩm Nê, Đà Nẵng).
-- See docs/architecture-proposal.md §4 for the full design rationale.
-- Forward-only. Apply via Supabase SQL Editor.
-- =============================================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ─── Enums ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.gender_enum AS ENUM ('male', 'female', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.relationship_type_enum AS ENUM ('marriage', 'biological_child', 'adopted_child');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.user_role_enum AS ENUM ('admin', 'editor', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.doc_type_enum AS ENUM (
    'birth_certificate', 'death_certificate', 'marriage_certificate',
    'id_card', 'gia_pha_scan', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Utility functions ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TABLES (in dependency order)
-- =============================================================================

-- PROFILES (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role public.user_role_enum NOT NULL DEFAULT 'member',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BRANCHES (chi tộc — gia phả groupings, self-referential)
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  parent_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PERSONS (core entity)
CREATE TABLE IF NOT EXISTS public.persons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,

  full_name TEXT NOT NULL,
  other_names TEXT,
  gender public.gender_enum NOT NULL,

  -- Partial dates allowed (year-only, year+month, etc.)
  birth_year INT,
  birth_month INT,
  birth_day INT,
  death_year INT,
  death_month INT,
  death_day INT,
  death_lunar_year INT,
  death_lunar_month INT,
  death_lunar_day INT,

  is_deceased BOOLEAN NOT NULL DEFAULT FALSE,
  is_in_law BOOLEAN NOT NULL DEFAULT FALSE,
  birth_order INT,
  generation INT,

  avatar_url TEXT,
  note TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PERSON_DETAILS_PRIVATE (sensitive fields, admin-only RLS)
CREATE TABLE IF NOT EXISTS public.person_details_private (
  person_id UUID PRIMARY KEY REFERENCES public.persons(id) ON DELETE CASCADE,
  phone_number TEXT,
  occupation TEXT,
  current_residence TEXT,
  email TEXT,
  address_history TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PERSON_PHOTOS (gallery beyond avatar_url)
CREATE TABLE IF NOT EXISTS public.person_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  display_order INT NOT NULL DEFAULT 0,
  taken_at TIMESTAMPTZ,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PERSON_DOCUMENTS (private; signed-URL access)
CREATE TABLE IF NOT EXISTS public.person_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  title TEXT,
  doc_type public.doc_type_enum NOT NULL DEFAULT 'other',
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MEMORIAL_PAGES (long-form biographies; activated in V2)
CREATE TABLE IF NOT EXISTS public.memorial_pages (
  person_id UUID PRIMARY KEY REFERENCES public.persons(id) ON DELETE CASCADE,
  body_markdown TEXT NOT NULL,
  last_edited_by UUID REFERENCES public.profiles(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RELATIONSHIPS (typed edges between persons)
CREATE TABLE IF NOT EXISTS public.relationships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type public.relationship_type_enum NOT NULL,
  person_a UUID REFERENCES public.persons(id) ON DELETE CASCADE NOT NULL,
  person_b UUID REFERENCES public.persons(id) ON DELETE CASCADE NOT NULL,
  note TEXT,
  marriage_order INT,
  started_at DATE,
  ended_at DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_self_relationship CHECK (person_a != person_b),
  UNIQUE(person_a, person_b, type)
);

-- CUSTOM_EVENTS (giỗ, ceremonies, milestones)
CREATE TABLE IF NOT EXISTS public.custom_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT,
  event_date DATE NOT NULL,
  is_lunar BOOLEAN NOT NULL DEFAULT FALSE,
  location TEXT,
  created_by UUID REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AUDIT_LOG (append-only ledger of mutations)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES public.profiles(id),
  table_name TEXT NOT NULL,
  op TEXT NOT NULL CHECK (op IN ('INSERT','UPDATE','DELETE')),
  row_id UUID,
  before JSONB,
  after JSONB,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_branches_parent ON public.branches(parent_branch_id);

CREATE INDEX IF NOT EXISTS idx_persons_full_name ON public.persons(full_name);
CREATE INDEX IF NOT EXISTS idx_persons_generation ON public.persons(generation);
CREATE INDEX IF NOT EXISTS idx_persons_gender ON public.persons(gender);
CREATE INDEX IF NOT EXISTS idx_persons_is_deceased ON public.persons(is_deceased);
CREATE INDEX IF NOT EXISTS idx_persons_branch ON public.persons(branch_id);
CREATE INDEX IF NOT EXISTS idx_persons_generation_branch ON public.persons(generation, branch_id);
CREATE INDEX IF NOT EXISTS idx_persons_birth_year ON public.persons(birth_year)
  WHERE birth_year IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_relationships_person_a ON public.relationships(person_a);
CREATE INDEX IF NOT EXISTS idx_relationships_person_b ON public.relationships(person_b);
CREATE INDEX IF NOT EXISTS idx_relationships_type ON public.relationships(type);
CREATE INDEX IF NOT EXISTS idx_relationships_pair ON public.relationships(person_a, person_b, type);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

CREATE INDEX IF NOT EXISTS idx_person_photos_person ON public.person_photos(person_id, display_order);
CREATE INDEX IF NOT EXISTS idx_person_documents_person ON public.person_documents(person_id);

CREATE INDEX IF NOT EXISTS idx_custom_events_date ON public.custom_events(event_date);
CREATE INDEX IF NOT EXISTS idx_custom_events_created_by ON public.custom_events(created_by);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log(actor_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_row ON public.audit_log(table_name, row_id, at DESC);

-- =============================================================================
-- RLS HELPERS
-- =============================================================================

ALTER TABLE public.profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persons                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_details_private  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_photos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memorial_pages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationships           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log               ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
  );
END;
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_editor()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin','editor') AND is_active = TRUE
  );
END;
$$;
REVOKE ALL ON FUNCTION public.is_editor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_editor() TO authenticated;

-- =============================================================================
-- PUBLIC GUEST VIEW (redacted persons for unauthenticated visitors)
-- =============================================================================

-- security_invoker = false: the view runs as its owner (postgres), bypassing
-- the underlying RLS on persons. The view IS the security boundary for anon —
-- it exposes only columns that are safe to publish. Birth & death dates (solar
-- and lunar) are intentionally exposed: a gia phả's purpose is to publish them.
-- The free-text `note` field is included: a gia phả's purpose is to publish
-- biographical notes. Sensitive data lives in `person_details_private` instead.
DROP VIEW IF EXISTS public.persons_public_view;
CREATE VIEW public.persons_public_view
  WITH (security_invoker = false) AS
SELECT
  id, full_name, other_names, gender,
  birth_year, birth_month, birth_day,
  death_year, death_month, death_day,
  death_lunar_year, death_lunar_month, death_lunar_day,
  is_deceased, is_in_law,
  generation, branch_id, birth_order,
  avatar_url, note, created_at, updated_at
FROM public.persons;

GRANT SELECT ON public.persons_public_view TO anon;
GRANT SELECT ON public.persons_public_view TO authenticated;

GRANT SELECT ON public.branches TO anon;
GRANT SELECT ON public.relationships TO anon;
GRANT SELECT ON public.person_photos TO anon;

-- ── Anon RLS policies — required since the view itself bypasses RLS but the
--    relationships/branches tables are queried directly by the public tree. ──

DROP POLICY IF EXISTS "Anon read relationships" ON public.relationships;
CREATE POLICY "Anon read relationships" ON public.relationships
  FOR SELECT TO anon USING (TRUE);

DROP POLICY IF EXISTS "Anon read branches" ON public.branches;
CREATE POLICY "Anon read branches" ON public.branches
  FOR SELECT TO anon USING (TRUE);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- ── profiles ──
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

-- ── branches ──
DROP POLICY IF EXISTS "Authenticated read branches" ON public.branches;
CREATE POLICY "Authenticated read branches" ON public.branches
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Editors manage branches" ON public.branches;
CREATE POLICY "Editors manage branches" ON public.branches
  FOR ALL TO authenticated
  USING (public.is_editor()) WITH CHECK (public.is_editor());

-- ── persons ──
DROP POLICY IF EXISTS "Authenticated read persons" ON public.persons;
CREATE POLICY "Authenticated read persons" ON public.persons
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Editors insert persons" ON public.persons;
CREATE POLICY "Editors insert persons" ON public.persons
  FOR INSERT TO authenticated WITH CHECK (public.is_editor());

DROP POLICY IF EXISTS "Editors update persons" ON public.persons;
CREATE POLICY "Editors update persons" ON public.persons
  FOR UPDATE TO authenticated
  USING (public.is_editor()) WITH CHECK (public.is_editor());

DROP POLICY IF EXISTS "Editors delete persons" ON public.persons;
CREATE POLICY "Editors delete persons" ON public.persons
  FOR DELETE TO authenticated USING (public.is_editor());

-- ── person_details_private — admin only ──
DROP POLICY IF EXISTS "Admins read private details" ON public.person_details_private;
CREATE POLICY "Admins read private details" ON public.person_details_private
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins manage private details" ON public.person_details_private;
CREATE POLICY "Admins manage private details" ON public.person_details_private
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── person_photos ──
DROP POLICY IF EXISTS "Anon read photos" ON public.person_photos;
CREATE POLICY "Anon read photos" ON public.person_photos
  FOR SELECT TO anon USING (TRUE);

DROP POLICY IF EXISTS "Authenticated read photos" ON public.person_photos;
CREATE POLICY "Authenticated read photos" ON public.person_photos
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Editors manage photos" ON public.person_photos;
CREATE POLICY "Editors manage photos" ON public.person_photos
  FOR ALL TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());

-- ── person_documents — editor read, admin write ──
DROP POLICY IF EXISTS "Editors read documents" ON public.person_documents;
CREATE POLICY "Editors read documents" ON public.person_documents
  FOR SELECT TO authenticated USING (public.is_editor());

DROP POLICY IF EXISTS "Admins manage documents" ON public.person_documents;
CREATE POLICY "Admins manage documents" ON public.person_documents
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── memorial_pages ──
DROP POLICY IF EXISTS "Authenticated read memorials" ON public.memorial_pages;
CREATE POLICY "Authenticated read memorials" ON public.memorial_pages
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Editors manage memorials" ON public.memorial_pages;
CREATE POLICY "Editors manage memorials" ON public.memorial_pages
  FOR ALL TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());

-- ── relationships ──
DROP POLICY IF EXISTS "Authenticated read relationships" ON public.relationships;
CREATE POLICY "Authenticated read relationships" ON public.relationships
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Editors manage relationships" ON public.relationships;
CREATE POLICY "Editors manage relationships" ON public.relationships
  FOR ALL TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());

-- ── custom_events ──
DROP POLICY IF EXISTS "Authenticated read events" ON public.custom_events;
CREATE POLICY "Authenticated read events" ON public.custom_events
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Authenticated insert events" ON public.custom_events;
CREATE POLICY "Authenticated insert events" ON public.custom_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Owner or admin update events" ON public.custom_events;
CREATE POLICY "Owner or admin update events" ON public.custom_events
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_admin());

DROP POLICY IF EXISTS "Owner or admin delete events" ON public.custom_events;
CREATE POLICY "Owner or admin delete events" ON public.custom_events
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_admin());

-- ── audit_log — read-only for admin, written only via trigger ──
DROP POLICY IF EXISTS "Admins read audit log" ON public.audit_log;
CREATE POLICY "Admins read audit log" ON public.audit_log
  FOR SELECT TO authenticated USING (public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM authenticated;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- updated_at maintenance
DROP TRIGGER IF EXISTS tr_profiles_updated_at ON public.profiles;
CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_branches_updated_at ON public.branches;
CREATE TRIGGER tr_branches_updated_at BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_persons_updated_at ON public.persons;
CREATE TRIGGER tr_persons_updated_at BEFORE UPDATE ON public.persons
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_person_details_private_updated_at ON public.person_details_private;
CREATE TRIGGER tr_person_details_private_updated_at BEFORE UPDATE ON public.person_details_private
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_memorial_pages_updated_at ON public.memorial_pages;
CREATE TRIGGER tr_memorial_pages_updated_at BEFORE UPDATE ON public.memorial_pages
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_relationships_updated_at ON public.relationships;
CREATE TRIGGER tr_relationships_updated_at BEFORE UPDATE ON public.relationships
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_custom_events_updated_at ON public.custom_events;
CREATE TRIGGER tr_custom_events_updated_at BEFORE UPDATE ON public.custom_events
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- ── First-user-becomes-admin pattern (mirrors giapha-os) ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  SELECT count(*) = 1 FROM auth.users INTO is_first_user;

  INSERT INTO public.profiles (id, role, is_active)
  VALUES (
    NEW.id,
    CASE WHEN is_first_user THEN 'admin'::public.user_role_enum ELSE 'member'::public.user_role_enum END,
    is_first_user
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_first_user_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = auth
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users) THEN
    NEW.email_confirmed_at := NOW();
    NEW.last_sign_in_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_created_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_first_user_confirmation();

-- ── Generic audit trigger ──
CREATE OR REPLACE FUNCTION public.fn_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row_id UUID;
BEGIN
  v_row_id := COALESCE(
    (CASE TG_OP WHEN 'DELETE' THEN OLD.id ELSE NEW.id END),
    NULL
  );
  INSERT INTO public.audit_log(actor_id, table_name, op, row_id, before, after)
  VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    TG_OP,
    v_row_id,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tr_audit_persons ON public.persons;
CREATE TRIGGER tr_audit_persons AFTER INSERT OR UPDATE OR DELETE ON public.persons
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit();

DROP TRIGGER IF EXISTS tr_audit_relationships ON public.relationships;
CREATE TRIGGER tr_audit_relationships AFTER INSERT OR UPDATE OR DELETE ON public.relationships
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit();

DROP TRIGGER IF EXISTS tr_audit_branches ON public.branches;
CREATE TRIGGER tr_audit_branches AFTER INSERT OR UPDATE OR DELETE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit();

-- =============================================================================
-- STORAGE BUCKETS
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', FALSE)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

-- avatars policies — public read, editor write
DROP POLICY IF EXISTS "Avatar images publicly readable" ON storage.objects;
CREATE POLICY "Avatar images publicly readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Editors upload avatars" ON storage.objects;
CREATE POLICY "Editors upload avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND public.is_editor());

DROP POLICY IF EXISTS "Editors update avatars" ON storage.objects;
CREATE POLICY "Editors update avatars" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND public.is_editor());

DROP POLICY IF EXISTS "Editors delete avatars" ON storage.objects;
CREATE POLICY "Editors delete avatars" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND public.is_editor());

-- documents policies — admin only
DROP POLICY IF EXISTS "Admins read documents" ON storage.objects;
CREATE POLICY "Admins read documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND public.is_admin());

DROP POLICY IF EXISTS "Admins manage documents" ON storage.objects;
CREATE POLICY "Admins manage documents" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'documents' AND public.is_admin())
  WITH CHECK (bucket_id = 'documents' AND public.is_admin());

-- =============================================================================
-- ADMIN RPC FUNCTIONS
-- =============================================================================

DROP TYPE IF EXISTS public.admin_user_data CASCADE;
CREATE TYPE public.admin_user_data AS (
  id UUID,
  email TEXT,
  role public.user_role_enum,
  created_at TIMESTAMPTZ,
  is_active BOOLEAN
);

CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS SETOF public.admin_user_data
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

  RETURN QUERY
  SELECT au.id, au.email::text, p.role, au.created_at, p.is_active
  FROM auth.users au
  LEFT JOIN public.profiles p ON au.id = p.id
  ORDER BY au.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_role(target_user_id UUID, new_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

  UPDATE public.profiles
  SET role = new_role::public.user_role_enum
  WHERE id = target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_active_status(target_user_id UUID, new_status BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

  UPDATE public.profiles
  SET is_active = new_status
  WHERE id = target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;
  IF auth.uid() = target_user_id THEN
    RAISE EXCEPTION 'Cannot delete yourself.';
  END IF;

  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- =============================================================================
-- TRAVERSAL RPC FUNCTIONS (recursive CTEs respecting RLS via SECURITY INVOKER)
-- See architecture-proposal.md §4.4
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_ancestors(p_id UUID, max_depth INT DEFAULT 20)
RETURNS TABLE(person_id UUID, depth INT)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE anc AS (
    SELECT r.person_a AS person_id, 1 AS depth
    FROM public.relationships r
    WHERE r.person_b = p_id AND r.type IN ('biological_child','adopted_child')
    UNION ALL
    SELECT r.person_a, a.depth + 1
    FROM anc a
    JOIN public.relationships r ON r.person_b = a.person_id
    WHERE r.type IN ('biological_child','adopted_child') AND a.depth < max_depth
  )
  SELECT * FROM anc;
$$;

CREATE OR REPLACE FUNCTION public.get_descendants(p_id UUID, max_depth INT DEFAULT 20)
RETURNS TABLE(person_id UUID, depth INT)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE des AS (
    SELECT r.person_b AS person_id, 1 AS depth
    FROM public.relationships r
    WHERE r.person_a = p_id AND r.type IN ('biological_child','adopted_child')
    UNION ALL
    SELECT r.person_b, d.depth + 1
    FROM des d
    JOIN public.relationships r ON r.person_a = d.person_id
    WHERE r.type IN ('biological_child','adopted_child') AND d.depth < max_depth
  )
  SELECT * FROM des;
$$;

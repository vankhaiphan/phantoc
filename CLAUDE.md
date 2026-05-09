# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository status

This repository is **scaffolded** (Steps 1–3 of the architecture proposal complete) and ready for feature work. Three things live here:

1. **`README.MD`** (root) — Not user-facing documentation. It is a **project brief / system prompt** that defines the product: a private, family-only Vietnamese genealogy web app for the Phan family of Cẩm Nê (Đà Nẵng), with imperial-Vietnamese / Indochine aesthetics. Treat it as the spec to satisfy.

2. **`docs/architecture-proposal.md`** — The 11-section design document (Vision, Architecture, Tech Stack, Database, Kinship Engine, UI/UX System, Tree Visualization, Repo Structure, Security, Roadmap, Future Enhancements). User has approved sections 1–11. When making architectural decisions, this is the source of truth; cite section numbers when referencing it.

3. **`reference_source/giapha-os/`** — A **read-only reference implementation** of a similar Vietnamese family-tree app. Don't modify files inside it unless explicitly asked.

The new app's name is **Phan Tộc** (codename `phantoc`, subtitle *Gia Phả Họ Phan*). The reference app's name is **giapha-os**. Don't conflate them.

## Working in the new app (root of repo)

The Next.js 16 + Bun + Supabase project lives at the repo root.

```bash
bun install
bun run dev          # http://localhost:3000
bun run build
bun run start
bun run lint         # eslint
bun run typecheck    # tsc --noEmit
bun run test         # vitest
```

Required env vars (copy `.env.example` → `.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SITE_NAME` (defaults to *Phan Tộc*), `SITE_SUBTITLE` (defaults to *Gia Phả Họ Phan*).

Without env vars, middleware redirects every request to `/missing-db-config`. With env vars but no schema, it redirects auth-protected paths to `/thiet-lap` (which displays the migration + seed SQL for paste-into-Supabase).

### Database setup

The schema is a **single forward-only migration** at `supabase/migrations/20260509120000_phantoc_init.sql`, plus `supabase/seed.sql` which inserts the founding chi (*Chi tộc Phan - làng Cẩm Nê*).

To bootstrap a fresh Supabase project:

1. Open the Supabase SQL Editor for your project.
2. Run the migration (the entire file).
3. Run `supabase/seed.sql`.
4. Visit `/dang-nhap` and register; the **first registered user becomes admin** automatically (auth trigger).

### Vietnamese routes

Routes are deliberately in Vietnamese — the URL is part of the product:

| Route | Purpose |
|---|---|
| `/` | Landing (public) |
| `/cay` | Tree view — Sơ đồ phả hệ (D3 tidy tree, pan/zoom, root selector) |
| `/thanh-vien/[id]` | Public member detail (redacted view) |
| `/dang-nhap` | Login (real form, uses signIn server action) |
| `/thiet-lap` | First-run setup; displays migration + seed SQL |
| `/bang-dieu-khien` | Auth-required dashboard (member + relationship counts) |
| `/bang-dieu-khien/thanh-vien` | Member list (editor) |
| `/bang-dieu-khien/thanh-vien/them` | Add member (RHF + Zod) |
| `/bang-dieu-khien/thanh-vien/[id]` | Member detail (full record + relationships UI) |
| `/bang-dieu-khien/thanh-vien/[id]/sua` | Edit member |
| `/missing-db-config` | Shown when env vars missing |

### Folder layout (current)

```
app/                    Next.js App Router pages
  globals.css           Tailwind v4 + @theme tokens (Lụa & Sơn Mài palette)
  layout.tsx            Root: lang="vi-VN", Cormorant + Playfair + Inter
  config.ts             siteName, siteSubtitle, foundingChi
  page.tsx              Landing
  dang-nhap/            Login (stub)
  thiet-lap/            First-run setup (reads migration SQL via fs.readFile)
  bang-dieu-khien/      Authenticated dashboard
  missing-db-config/    Env var instructions
lib/supabase/           client.ts, server.ts, middleware.ts, queries.ts
types/index.ts          Person, Relationship, Branch, KinshipResult, etc.
proxy.ts                Next.js middleware (auth + redirects)
supabase/
  config.toml           Supabase CLI config
  migrations/
    20260509120000_phantoc_init.sql
  seed.sql              Cẩm Nê chi
docs/
  architecture-proposal.md
```

Folders **not yet created** (will appear when first occupant arrives, per proposal §8.2): `lib/kinship/`, `lib/tree/`, `lib/lunar/`, `lib/gedcom/`, `lib/csv/`, `components/{ui,patterns,features,visual}/`, `app/actions/`, `app/cay/`, `app/thanh-vien/[id]/`, `app/danh-xung/`, `.github/workflows/`.

### Design tokens — quick reference

The heritage palette (full spec in `docs/architecture-proposal.md` §6) is defined as Tailwind v4 `@theme` CSS variables in `app/globals.css`:

| Token | Hex | Use |
|---|---|---|
| `--color-ink` | `#1A1714` | Primary text |
| `--color-parchment` | `#F4ECDC` | Default background |
| `--color-parchment-warm` | `#EAE0CB` | Card background |
| `--color-lacquer` | `#7A1F2C` | Primary action |
| `--color-gold` | `#A8843E` | Accent (use sparingly) |
| `--color-sage` | `#5C6B4F` | Living member indicator |
| `--color-sepia` | `#8B7355` | Deceased / muted text |
| `--color-ivory` | `#FBF7EE` | Modal/sheet bg |

Fonts: **Cormorant Garamond** (display, wordmark), **Playfair Display** (section heads), **Inter** (body) — all loaded via `next/font/google` with the `vietnamese` subset.

### Auth model

Three roles (per proposal §2.4): `admin` (Trưởng tộc), `editor` (Biên soạn), `member` (Thành viên). RLS in the migration enforces:

- `anon` → reads `persons_public_view`, `branches`, `relationships`. No private fields.
- `member` → reads full `persons` (still excludes `person_details_private`).
- `editor` → CRUD on `persons`, `relationships`, `branches`, `person_photos`, `memorial_pages`.
- `admin` → everything + `person_details_private` + `person_documents` + `audit_log` reads.

The `audit_log` table is append-only — `INSERT, UPDATE, DELETE` are revoked from `authenticated`; rows are written exclusively by the `fn_audit` trigger on `persons`, `relationships`, `branches`.

**Anon access pattern:** the public tree (`/cay`, `/thanh-vien/[id]`) queries `persons_public_view` for unauthenticated visitors and `persons` for logged-in users. The view is created `WITH (security_invoker = false)` so it runs as its owner (postgres), bypassing the underlying table's RLS — the column projection in the view *is* the security boundary. The view excludes `birth_month`, `birth_day`, `death_month`, `death_day`, all lunar fields, and `note`. Anon SELECT policies on `relationships` and `branches` are required separately because those tables are queried directly (not through a view).

## Working with the reference (`reference_source/giapha-os/`)

The reference is a Next.js 16 (App Router) + Supabase + TypeScript project, package-managed with **Bun**. It has its own `.git`, so it is effectively a vendored snapshot.

Reference scripts (run from `reference_source/giapha-os/`):

```bash
bun install
bun run dev      # next dev — http://localhost:3000
bun run build    # next build
bun run start    # next start
bun run lint     # eslint (flat config, extends eslint-config-next)
```

Required env vars (copy `.env.example` → `.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, optional `SITE_NAME`. Without them, middleware redirects to `/missing-db-config`; if the `profiles` table doesn't exist, it redirects to `/setup` (which renders `docs/schema.sql` for the operator to paste into Supabase).

### Key files in the reference (study these before designing phantoc)

- **`utils/kinshipHelpers.ts`** — The Vietnamese kinship resolution engine. `computeKinship(personA, personB, persons, relationships)` is the entry point. The algorithm: build `parentMap` and `spouseMap` from edges; check direct marriage; else BFS ancestors of A and B to find the **Lowest Common Ancestor (LCA)**; resolve terms in `resolveBloodTerms` based on depth-from-LCA on each side, the gender of the branch person at the LCA (paternal=`Nội` if male, maternal=`Ngoại` if female), and seniority via `birth_order` then `birth_year`. If no blood path exists, it iterates spouses of A, then spouses of B, then both, transforming the blood term with marriage suffixes (`Bố vợ`, `Anh em cột chèo`, `Chị em dâu`, `Con dâu`/`Con rể`, etc.). When designing phantoc's engine, this is the de facto spec.
- **`docs/schema.sql`** — Postgres schema (Supabase). Core tables: `profiles` (linked to `auth.users`, role enum `admin|editor|member`), `persons`, `person_details_private` (split for RLS on phone/occupation/residence), `relationships` (typed: `marriage`, `biological_child`, `adopted_child`), `custom_events`. RLS policies and helper functions also live here.
- **`docs/migrations/`** — Numeric-prefixed forward-only SQL migrations layered on top of `schema.sql`.
- **`utils/treeHelpers.ts`** — Builds adjacency lists (`spousesByPersonId`, `childrenByPersonId`) once and provides filtered traversal (`hideDaughtersInLaw`, `hideSons`, etc.) for tree/mindmap rendering.
- **`utils/supabase/{client,server,middleware,queries}.ts`** — The four-file Supabase SSR pattern: `client.ts` for browser, `server.ts` for server components/actions, `middleware.ts` for cookie refresh + auth guarding, `queries.ts` for `cache()`-wrapped helpers (`getSupabase`, `getUser`, `getProfile`, `getIsAdmin`).
- **`proxy.ts`** — Next.js middleware (named `proxy` here, exported `config.matcher`). Redirects `/dashboard/*` to `/login` when unauthenticated, `/login` → `/dashboard` when authenticated, and to `/setup` if the DB schema isn't initialized.
- **`app/actions/{data,member,user}.ts`** — Server Actions. `data.ts` implements full backup/restore (JSON v3 payload with `persons`, `relationships`, `person_details_private`, `custom_events`); admin-only via `getIsAdmin()`. Imports DELETE-then-INSERT in dependency order (custom_events → relationships → person_details_private → persons), chunked at 200.
- **`types/index.ts`** — Canonical `Person`, `Relationship`, `Profile`, `Gender`, `RelationshipType`, `UserRole` shapes.

### Reference architectural conventions worth carrying over

- Path alias `@/*` → repo root (set in `tsconfig.json`).
- Server Actions for mutations (`"use server"` at top of file in `app/actions/`).
- All admin-gated mutations call `getIsAdmin()` first and return `{ error }` on denial.
- Lunar dates stored as separate `death_lunar_{year,month,day}` columns; date components are nullable to support partial dates (year-only, etc.).
- Vietnamese-first UI strings; locale `vi` set in `<html lang="vi">`.
- Fonts: `Inter` (sans) + `Playfair_Display` (serif) via `next/font/google` with `vietnamese` subset.

## Designing phantoc

When the user asks for the design proposal, the deliverable is documentation/architecture (Mermaid diagrams, schemas, pseudo-code, file trees) that satisfies the sections enumerated in `README.MD`. Don't generate generic SaaS boilerplate — `README.MD` explicitly forbids it. Lean on giapha-os for what already works (Next.js App Router + Supabase + D3 + Tailwind + Bun, the kinship LCA algorithm, the persons/relationships split with `is_in_law` and `birth_order`) and propose changes only where the brief demands more (museum-grade aesthetics, tree visualization modes beyond Tree+Mindmap, branch/lineage management, RBAC nuances).

## Things to avoid

- Don't `cd reference_source/giapha-os && git ...` — it's a separate git repo; commits there don't belong to this project.
- Don't treat `README.MD` as documentation to extend or trim — it is the input brief.
- Don't translate Vietnamese routes (`/cay`, `/danh-xung`, `/bang-dieu-khien`, etc.) to English — the URL is part of the product. SEO is in Vietnamese intentionally.
- Don't add a second migration to "patch" the schema in early development — until the family is using the app, prefer editing `20260509120000_phantoc_init.sql` directly. Forward-only migrations start once the schema is in production.
- Don't initialize shadcn/ui (`bunx shadcn init`) blindly — Radix peer deps are already in `package.json`; add components on demand with `bunx shadcn@latest add <component>` when first needed. There is no `components.json` yet, and that's intentional.

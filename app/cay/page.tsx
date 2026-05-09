import { getSupabase, getUser } from "@/lib/supabase/queries";
import FamilyTree from "@/components/features/FamilyTree";
import SiteHeader from "@/components/patterns/SiteHeader";
import type { Person, Relationship } from "@/types";

export const revalidate = 0;

export default async function FamilyTreePage({
  searchParams,
}: {
  searchParams: Promise<{ root?: string }>;
}) {
  const params = await searchParams;
  const requestedRoot =
    typeof params?.root === "string" ? params.root : undefined;

  const supabase = await getSupabase();
  const user = await getUser();

  // Anon visitors read the redacted view; authenticated users see everything.
  // The view exposes name/gender/birth_year/death_year/etc. — enough to render
  // the tree — but excludes month/day specificity, lunar dates, and notes.
  const personsSource = user ? "persons" : "persons_public_view";

  const [{ data: persons }, { data: relationships }] = await Promise.all([
    supabase.from(personsSource).select("*"),
    supabase.from("relationships").select("*"),
  ]);

  return (
    <main className="min-h-screen">
      <SiteHeader
        subtitle="Sơ đồ phả hệ"
        authed={Boolean(user)}
        hideTreeLink
      />

      <FamilyTree
        persons={(persons ?? []) as Person[]}
        relationships={(relationships ?? []) as Relationship[]}
        initialRootId={requestedRoot}
        editorMode={Boolean(user)}
      />
    </main>
  );
}

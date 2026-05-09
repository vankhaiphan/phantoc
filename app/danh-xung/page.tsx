import { getSupabase, getUser } from "@/lib/supabase/queries";
import KinshipFinder from "@/components/features/KinshipFinder";
import SiteHeader from "@/components/patterns/SiteHeader";
import type { Person, Relationship } from "@/types";

export const revalidate = 0;

/**
 * /danh-xung — public Vietnamese kinship lookup.
 *
 * Anon visitors hit `persons_public_view` (redacted columns); authenticated
 * users hit `persons` directly. The kinship engine only needs id, full_name,
 * gender, birth_year, birth_order, generation, is_in_law — all exposed in
 * the public view per the proposal §9.2.
 */
export default async function KinshipPage() {
  const supabase = await getSupabase();
  const user = await getUser();

  const personsSource = user ? "persons" : "persons_public_view";
  const [{ data: persons }, { data: relationships }] = await Promise.all([
    supabase.from(personsSource).select("*"),
    supabase.from("relationships").select("*"),
  ]);

  return (
    <main className="min-h-screen">
      <SiteHeader
        subtitle="Tra cứu danh xưng"
        authed={Boolean(user)}
        hideKinshipLink
      />

      <section className="px-4 sm:px-6 py-8 sm:py-12 max-w-5xl mx-auto">
        <div className="text-center mb-8 sm:mb-10">
          <h1
            className="font-display font-bold"
            style={{
              fontSize: "clamp(2rem, 5vw, 3rem)",
              color: "var(--color-ink)",
              lineHeight: 1.1,
            }}
          >
            Tra cứu danh xưng
          </h1>
          <p
            className="font-serif italic mt-3 text-sm sm:text-base"
            style={{ color: "var(--color-sepia)" }}
          >
            Hai người trong dòng họ gọi nhau là gì?
          </p>
          <div className="divider-rosette mx-auto mt-6 w-32" />
        </div>

        <KinshipFinder
          persons={(persons ?? []) as Person[]}
          relationships={(relationships ?? []) as Relationship[]}
        />
      </section>
    </main>
  );
}

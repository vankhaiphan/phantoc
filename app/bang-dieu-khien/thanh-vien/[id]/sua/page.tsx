import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase/queries";
import MemberForm from "@/components/features/MemberForm";
import type { Branch, Person } from "@/types";

export const revalidate = 0;

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabase();

  const [{ data: person }, { data: branches }] = await Promise.all([
    supabase.from("persons").select("*").eq("id", id).single(),
    supabase
      .from("branches")
      .select("*")
      .order("display_order", { ascending: true }),
  ]);

  if (!person) notFound();

  const p = person as Person;

  return (
    <main className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <Link
        href={`/bang-dieu-khien/thanh-vien/${p.id}`}
        className="text-sm"
        style={{ color: "var(--color-sepia)" }}
      >
        ← {p.full_name}
      </Link>

      <header className="mt-6 mb-10">
        <h1
          className="font-display font-bold text-4xl"
          style={{ color: "var(--color-ink)" }}
        >
          Sửa thành viên
        </h1>
        <p
          className="font-serif italic mt-2"
          style={{ color: "var(--color-sepia)" }}
        >
          {p.full_name}
        </p>
      </header>

      <div className="divider-rosette mb-10 w-full" />

      <MemberForm
        branches={(branches ?? []) as Branch[]}
        existing={p}
      />
    </main>
  );
}

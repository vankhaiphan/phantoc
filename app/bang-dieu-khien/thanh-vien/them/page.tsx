import Link from "next/link";
import { getSupabase } from "@/lib/supabase/queries";
import MemberForm from "@/components/features/MemberForm";
import type { Branch } from "@/types";

export const revalidate = 0;

export default async function NewMemberPage() {
  const supabase = await getSupabase();
  const { data: branches } = await supabase
    .from("branches")
    .select("*")
    .order("display_order", { ascending: true });

  return (
    <main className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <Link
        href="/bang-dieu-khien/thanh-vien"
        className="text-sm"
        style={{ color: "var(--color-sepia)" }}
      >
        ← Thành viên
      </Link>

      <header className="mt-6 mb-10">
        <h1
          className="font-display font-bold text-4xl"
          style={{ color: "var(--color-ink)" }}
        >
          Thêm thành viên
        </h1>
        <p
          className="font-serif italic mt-2"
          style={{ color: "var(--color-sepia)" }}
        >
          Mỗi cái tên là một câu chuyện được giữ lại.
        </p>
      </header>

      <div className="divider-rosette mb-10 w-full" />

      <MemberForm branches={(branches ?? []) as Branch[]} />
    </main>
  );
}

import Link from "next/link";
import { getSupabase } from "@/lib/supabase/queries";
import MemberCard from "@/components/features/MemberCard";
import type { Person } from "@/types";

export const revalidate = 0;

export default async function MembersListPage() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("persons")
    .select("*")
    .order("generation", { ascending: true, nullsFirst: false })
    .order("birth_year", { ascending: true, nullsFirst: false })
    .order("birth_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const persons = (data ?? []) as Person[];

  return (
    <main className="min-h-screen px-6 py-12 max-w-5xl mx-auto">
      <Link
        href="/bang-dieu-khien"
        className="text-sm"
        style={{ color: "var(--color-sepia)" }}
      >
        ← Bảng điều khiển
      </Link>

      <header className="mt-6 mb-10 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="font-display font-bold text-4xl"
            style={{ color: "var(--color-ink)" }}
          >
            Thành viên
          </h1>
          <p
            className="font-serif italic mt-2"
            style={{ color: "var(--color-sepia)" }}
          >
            {persons.length} người trong gia phả
          </p>
        </div>
        <Link
          href="/bang-dieu-khien/thanh-vien/them"
          className="px-5 py-2.5 font-serif text-base"
          style={{
            backgroundColor: "var(--color-lacquer)",
            color: "var(--color-ivory)",
            borderRadius: "var(--radius-paper)",
          }}
        >
          + Thêm thành viên
        </Link>
      </header>

      <div className="divider-rosette mb-10 w-full" />

      {error && (
        <p
          className="text-sm px-4 py-3 mb-6"
          style={{
            color: "var(--color-lacquer-deep)",
            backgroundColor: "rgba(122,31,44,0.08)",
            borderLeft: "3px solid var(--color-lacquer)",
          }}
        >
          {error.message}
        </p>
      )}

      {persons.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {persons.map((p) => (
            <li key={p.id}>
              <MemberCard person={p} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div
      className="text-center py-20 px-6"
      style={{
        backgroundColor: "var(--color-ivory)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <p className="font-serif text-2xl mb-3">Gia phả còn trống</p>
      <p
        className="text-base mb-6 max-w-md mx-auto"
        style={{ color: "var(--color-sepia)" }}
      >
        Hãy bắt đầu bằng việc thêm vị tổ tiên đầu tiên của Chi tộc Phan, làng
        Cẩm Nê. Mỗi cái tên là một câu chuyện được giữ lại.
      </p>
      <Link
        href="/bang-dieu-khien/thanh-vien/them"
        className="inline-block px-6 py-3 font-serif"
        style={{
          backgroundColor: "var(--color-lacquer)",
          color: "var(--color-ivory)",
          borderRadius: "var(--radius-paper)",
        }}
      >
        Thêm vị đầu tiên
      </Link>
    </div>
  );
}

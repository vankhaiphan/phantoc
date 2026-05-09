"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { computeKinship } from "@/lib/kinship/compute";
import type { KinshipResult, Person, Relationship } from "@/types";

interface KinshipFinderProps {
  persons: Person[];
  relationships: Relationship[];
}

/**
 * /danh-xung — kinship finder.
 *
 * Touch-first design:
 *   – Two slots ("Người A" / "Người B"). Each slot is a wide, tap-friendly
 *     card. Tapping opens a modal sheet with a search field + a scrollable
 *     list that fills the viewport on mobile.
 *   – No nested scroll inside the slot card itself, which is what made the
 *     prior dual-panel layout fragile on iOS.
 *   – Result card runs the engine client-side once both slots are filled.
 */
export default function KinshipFinder({
  persons,
  relationships,
}: KinshipFinderProps) {
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);
  const [openSlot, setOpenSlot] = useState<"a" | "b" | null>(null);

  const personA = useMemo(
    () => (aId ? persons.find((p) => p.id === aId) ?? null : null),
    [aId, persons],
  );
  const personB = useMemo(
    () => (bId ? persons.find((p) => p.id === bId) ?? null : null),
    [bId, persons],
  );

  const result: KinshipResult | null = useMemo(() => {
    if (!personA || !personB) return null;
    if (personA.id === personB.id) return null;
    return computeKinship(personA, personB, persons, relationships);
  }, [personA, personB, persons, relationships]);

  const swap = () => {
    setAId(bId);
    setBId(aId);
  };

  if (persons.length === 0) {
    return (
      <div
        className="text-center py-16 px-6 max-w-xl mx-auto"
        style={{
          backgroundColor: "var(--color-ivory)",
          borderRadius: "var(--radius-card)",
        }}
      >
        <p className="font-serif text-2xl mb-3">Chưa có dữ liệu</p>
        <p style={{ color: "var(--color-sepia)" }}>
          Hãy thêm thành viên và quan hệ vào gia phả để bắt đầu tra cứu.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Slots — stacked on mobile, side-by-side on tablet+ */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 md:gap-5 items-stretch">
        <PersonSlot
          label="Người A"
          person={personA}
          onOpen={() => setOpenSlot("a")}
          onClear={() => setAId(null)}
        />

        <button
          type="button"
          onClick={swap}
          disabled={!aId && !bId}
          className="self-stretch md:self-center px-4 py-3 md:py-2 text-sm font-serif transition-opacity disabled:opacity-30"
          style={{
            color: "var(--color-lacquer)",
            border: "1px solid rgba(122,31,44,0.25)",
            borderRadius: "var(--radius-paper)",
            backgroundColor: "var(--color-ivory)",
            minHeight: 44,
          }}
          aria-label="Đổi chiều A và B"
        >
          ↔ Đổi chiều
        </button>

        <PersonSlot
          label="Người B"
          person={personB}
          onOpen={() => setOpenSlot("b")}
          onClear={() => setBId(null)}
        />
      </div>

      {/* Result */}
      {personA && personB && result ? (
        <ResultCard
          personA={personA}
          personB={personB}
          result={result}
        />
      ) : (
        <EmptyResult bothSelected={Boolean(aId && bId)} />
      )}

      {/* Picker sheet — mounted only while open. Remounting on every open
          gives us a fresh search query without state-in-effect plumbing. */}
      {openSlot !== null ? (
        <PickerSheet
          key={openSlot}
          title={openSlot === "a" ? "Chọn Người A" : "Chọn Người B"}
          persons={persons}
          excludeId={openSlot === "a" ? bId : aId}
          currentId={openSlot === "a" ? aId : bId}
          onPick={(id) => {
            if (openSlot === "a") setAId(id);
            else setBId(id);
            setOpenSlot(null);
          }}
          onClose={() => setOpenSlot(null)}
        />
      ) : null}
    </div>
  );
}

// ─── Person slot ───────────────────────────────────────────────────────────

function PersonSlot({
  label,
  person,
  onOpen,
  onClear,
}: {
  label: string;
  person: Person | null;
  onOpen: () => void;
  onClear: () => void;
}) {
  return (
    <div
      className="relative"
      style={{
        backgroundColor: "var(--color-ivory)",
        borderRadius: "var(--radius-card)",
        padding: "1rem",
        minHeight: 96,
      }}
    >
      <p
        className="text-xs font-serif tracking-wider uppercase mb-2"
        style={{ color: "var(--color-sepia)" }}
      >
        {label}
      </p>

      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left transition-opacity active:opacity-70"
        style={{
          minHeight: 56,
          padding: "0.5rem 0",
        }}
        aria-haspopup="dialog"
        aria-label={person ? `${label}: ${person.full_name}. Chạm để đổi.` : `${label}: chưa chọn. Chạm để chọn.`}
      >
        {person ? (
          <>
            <p
              className="font-serif text-lg"
              style={{
                color: person.is_deceased
                  ? "var(--color-sepia)"
                  : "var(--color-ink)",
              }}
            >
              {person.full_name}
              {person.birth_year ? (
                <span
                  className="ml-2 text-sm tabular-nums"
                  style={{ color: "var(--color-sepia)" }}
                >
                  ({person.birth_year})
                </span>
              ) : null}
            </p>
            {person.other_names ? (
              <p
                className="text-sm font-serif italic mt-0.5"
                style={{ color: "var(--color-sepia)" }}
              >
                {person.other_names}
              </p>
            ) : null}
            {person.generation != null ? (
              <p
                className="text-xs mt-1 tracking-wider uppercase"
                style={{ color: "var(--color-gold)" }}
              >
                Thế hệ {person.generation}
              </p>
            ) : null}
          </>
        ) : (
          <p
            className="font-serif text-base"
            style={{ color: "var(--color-sepia)" }}
          >
            Chạm để chọn người…
          </p>
        )}
      </button>

      {person ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="absolute top-3 right-3 text-xs px-2 py-1"
          style={{
            color: "var(--color-sepia)",
            border: "1px solid rgba(26,23,20,0.10)",
            borderRadius: "var(--radius-paper)",
            backgroundColor: "var(--color-parchment)",
            minHeight: 32,
            minWidth: 56,
          }}
          aria-label="Bỏ chọn"
        >
          Bỏ
        </button>
      ) : null}
    </div>
  );
}

// ─── Picker sheet (modal overlay) ──────────────────────────────────────────

function PickerSheet({
  title,
  persons,
  excludeId,
  currentId,
  onPick,
  onClose,
}: {
  title: string;
  persons: Person[];
  excludeId: string | null;
  currentId: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Esc closes, body scroll locks, focus desktop input. Runs once at mount
  // because the parent only renders this component while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Don't autofocus on touch devices — the on-screen keyboard would shove
    // the list under it. Desktop users can still Tab into the input.
    const isFinePointer =
      typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: fine)").matches;
    if (isFinePointer) {
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => {
        clearTimeout(t);
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = prevOverflow;
      };
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("vi");
    return persons
      .filter((p) => p.id !== excludeId)
      .filter((p) => {
        if (!q) return true;
        return (
          p.full_name.toLocaleLowerCase("vi").includes(q) ||
          (p.other_names ?? "").toLocaleLowerCase("vi").includes(q)
        );
      });
  }, [persons, query, excludeId]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        backgroundColor: "rgba(26,23,20,0.45)",
        // Account for iOS notch on the backdrop too.
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div
        ref={sheetRef}
        className="w-full sm:max-w-lg sm:rounded-[var(--radius-card)] flex flex-col"
        style={{
          backgroundColor: "var(--color-parchment)",
          maxHeight: "min(92dvh, 720px)",
          height: "92dvh",
          borderTopLeftRadius: "var(--radius-card)",
          borderTopRightRadius: "var(--radius-card)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center justify-between gap-3"
          style={{ borderBottom: "1px solid rgba(26,23,20,0.08)" }}
        >
          <p className="font-serif text-lg">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-3"
            style={{
              color: "var(--color-ink)",
              minHeight: 40,
              minWidth: 40,
            }}
            aria-label="Đóng"
          >
            Đóng
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc tên gọi khác…"
            className="w-full px-3 py-3"
            // 16px font-size prevents iOS Safari from auto-zooming on focus.
            style={{
              fontSize: 16,
              backgroundColor: "var(--color-ivory)",
              border: "1px solid rgba(26,23,20,0.12)",
              borderRadius: "var(--radius-paper)",
              color: "var(--color-ink)",
              minHeight: 48,
            }}
            // Mobile keyboards: hint search semantics
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        {/* Result list */}
        <ul
          className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-3"
          // momentum scrolling on iOS
          style={{ WebkitOverflowScrolling: "touch" as const }}
        >
          {filtered.length === 0 ? (
            <li
              className="text-center py-12 px-4 italic"
              style={{ color: "var(--color-sepia)" }}
            >
              Không tìm thấy ai phù hợp.
            </li>
          ) : (
            filtered.map((p) => {
              const isCurrent = p.id === currentId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onPick(p.id)}
                    className="w-full text-left px-3 py-3 active:opacity-70 transition-opacity"
                    style={{
                      minHeight: 56,
                      backgroundColor: isCurrent
                        ? "rgba(122,31,44,0.08)"
                        : "transparent",
                      borderRadius: "var(--radius-paper)",
                      borderLeft: isCurrent
                        ? "3px solid var(--color-lacquer)"
                        : "3px solid transparent",
                    }}
                  >
                    <p
                      className="font-serif text-base"
                      style={{
                        color: p.is_deceased
                          ? "var(--color-sepia)"
                          : "var(--color-ink)",
                      }}
                    >
                      {p.full_name}
                      {p.birth_year ? (
                        <span
                          className="ml-2 text-sm tabular-nums"
                          style={{ color: "var(--color-sepia)" }}
                        >
                          ({p.birth_year})
                        </span>
                      ) : null}
                    </p>
                    <p
                      className="text-xs mt-0.5 flex flex-wrap gap-x-3"
                      style={{ color: "var(--color-sepia)" }}
                    >
                      {p.generation != null ? (
                        <span
                          className="tracking-wider uppercase"
                          style={{ color: "var(--color-gold)" }}
                        >
                          Thế hệ {p.generation}
                        </span>
                      ) : null}
                      {p.other_names ? (
                        <span className="font-serif italic">
                          {p.other_names}
                        </span>
                      ) : null}
                      {p.is_in_law ? <span>(dâu/rể)</span> : null}
                    </p>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

// ─── Result display ────────────────────────────────────────────────────────

function ResultCard({
  personA,
  personB,
  result,
}: {
  personA: Person;
  personB: Person;
  result: KinshipResult;
}) {
  const isFallback = result.certainty === "fallback";

  return (
    <article
      className="p-6 sm:p-10 max-w-3xl mx-auto"
      style={{
        backgroundColor: "var(--color-parchment-warm)",
        borderRadius: "var(--radius-card)",
        boxShadow:
          "0 1px 0 rgba(26,23,20,0.04), 0 4px 14px rgba(26,23,20,0.06)",
      }}
    >
      {isFallback ? (
        <div className="text-center">
          <p
            className="font-display text-2xl sm:text-3xl mb-3"
            style={{ color: "var(--color-sepia)" }}
          >
            Chưa xác định
          </p>
          <p style={{ color: "var(--color-sepia)" }}>
            Vui lòng kiểm tra dữ liệu quan hệ giữa{" "}
            <span className="font-serif">{personA.full_name}</span> và{" "}
            <span className="font-serif">{personB.full_name}</span>.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8">
            <KinshipLine
              subject={personA.full_name}
              object={personB.full_name}
              term={result.aCallsB}
            />
            <KinshipLine
              subject={personB.full_name}
              object={personA.full_name}
              term={result.bCallsA}
            />
          </div>

          <div
            className="border-t pt-5 sm:pt-6 text-center"
            style={{ borderColor: "rgba(26,23,20,0.10)" }}
          >
            <p
              className="font-serif italic text-base mb-3"
              style={{ color: "var(--color-sepia)" }}
            >
              {result.description}
            </p>

            {result.pathLabels.length > 0 ? (
              <ul
                className="text-sm space-y-1 mb-4"
                style={{ color: "var(--color-sepia)" }}
              >
                {result.pathLabels.map((label, i) => (
                  <li key={i}>{label}</li>
                ))}
              </ul>
            ) : null}

            {result.ancestorId ? (
              <Link
                href={`/cay?root=${result.ancestorId}`}
                className="inline-block mt-2 text-sm font-serif px-4 py-2"
                style={{
                  color: "var(--color-lacquer)",
                  minHeight: 40,
                }}
              >
                Xem tổ tiên chung trên sơ đồ phả hệ →
              </Link>
            ) : null}
          </div>
        </>
      )}
    </article>
  );
}

function KinshipLine({
  subject,
  object,
  term,
}: {
  subject: string;
  object: string;
  term: string;
}) {
  return (
    <div className="text-center">
      <p
        className="text-xs tracking-wider uppercase mb-2 leading-relaxed"
        style={{ color: "var(--color-sepia)" }}
      >
        <span className="font-serif">{subject}</span> gọi{" "}
        <span className="font-serif">{object}</span> là
      </p>
      <p
        className="font-display font-bold"
        style={{
          fontSize: "clamp(1.75rem, 5vw, 2.441rem)",
          color: "var(--color-lacquer)",
          lineHeight: 1.1,
          wordBreak: "keep-all",
        }}
      >
        {term}
      </p>
    </div>
  );
}

function EmptyResult({ bothSelected }: { bothSelected: boolean }) {
  return (
    <div
      className="text-center py-10 px-6 max-w-xl mx-auto"
      style={{
        backgroundColor: "var(--color-ivory)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <p
        className="font-serif text-base sm:text-lg"
        style={{ color: "var(--color-sepia)" }}
      >
        {bothSelected
          ? "Đang tính toán…"
          : "Chọn hai người ở trên để xem cách họ gọi nhau."}
      </p>
    </div>
  );
}

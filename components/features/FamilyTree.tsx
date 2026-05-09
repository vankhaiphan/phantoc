"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  buildAdjacency,
  buildTreeFromRoot,
  findRoots,
  type TreeNode,
} from "@/lib/tree/adjacency";
import type { Person, Relationship } from "@/types";

// ─── Layout constants ──────────────────────────────────────────────────────

const NODE_W = 220;
const NODE_H = 92;
const NODE_GAP_X = 28;
const GENERATION_GAP = 156;

// Tap detection — distinguishes a deliberate tap from the start of a pan.
const TAP_THRESHOLD_PX = 8;
const TAP_THRESHOLD_MS = 600;

// Mobile breakpoint (matches Tailwind `sm`).
const MOBILE_BREAKPOINT = 640;

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;

export interface FamilyTreeProps {
  persons: Person[];
  relationships: Relationship[];
  /** Optional override for which person to root the tree at. */
  initialRootId?: string;
  /** When true, tapping a node opens the editor detail page. */
  editorMode?: boolean;
}

export default function FamilyTree(props: FamilyTreeProps) {
  const isMobile = useIsMobileViewport();

  if (props.persons.length === 0) {
    return <EmptyTree />;
  }

  return isMobile ? <MobileList {...props} /> : <DesktopTree {...props} />;
}

// ═══ Desktop / tablet — D3 SVG with pan/zoom ═══════════════════════════════

function DesktopTree({
  persons,
  relationships,
  initialRootId,
  editorMode = false,
}: FamilyTreeProps) {
  const router = useRouter();

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);

  // Imperative zoom controls — populated when d3.zoom is mounted.
  const zoomCtrl = useRef<{
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
  } | null>(null);

  const adj = useMemo(
    () => buildAdjacency(persons, relationships),
    [persons, relationships],
  );
  const roots = useMemo(() => findRoots(persons, adj), [persons, adj]);

  const [rootId, setRootId] = useState<string | null>(
    initialRootId ?? roots[0]?.id ?? persons[0]?.id ?? null,
  );

  const tree = useMemo(() => {
    if (!rootId) return null;
    return buildTreeFromRoot(rootId, persons, adj);
  }, [rootId, persons, adj]);

  const layout = useMemo(() => {
    if (!tree) return null;
    const root = d3.hierarchy<TreeNode>(tree, (d) => d.children);
    d3.tree<TreeNode>()
      .nodeSize([NODE_W + NODE_GAP_X, GENERATION_GAP])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.4))(root);
    return root;
  }, [tree]);

  // Mount d3.zoom on the SVG. Filter excludes the secondary mouse button
  // (right-click) and treats wheel/touch/drag uniformly.
  useEffect(() => {
    if (!svgRef.current || !gRef.current || !layout) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([ZOOM_MIN, ZOOM_MAX])
      .filter((event: Event) => {
        // Standard d3 default minus a couple of touchy edge cases:
        //   – allow wheel without ctrlKey (we don't gate behind ⌘/Ctrl)
        //   – block context-menu / right-click drag
        //   – block clicks (we handle taps independently)
        if ((event as MouseEvent).button === 2) return false;
        if (event.type === "click" || event.type === "dblclick") return false;
        return true;
      })
      .on("zoom", (e: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr("transform", e.transform.toString());
      });

    svg.call(zoom);

    const center = () => {
      const w = svgRef.current?.clientWidth ?? 0;
      svg
        .transition()
        .duration(0)
        .call(zoom.transform, d3.zoomIdentity.translate(w / 2, 80).scale(1));
    };
    center();

    zoomCtrl.current = {
      zoomIn: () => svg.transition().duration(220).call(zoom.scaleBy, 1.3),
      zoomOut: () =>
        svg.transition().duration(220).call(zoom.scaleBy, 1 / 1.3),
      reset: () => {
        const w = svgRef.current?.clientWidth ?? 0;
        svg
          .transition()
          .duration(320)
          .call(zoom.transform, d3.zoomIdentity.translate(w / 2, 80).scale(1));
      },
    };

    return () => {
      svg.on(".zoom", null);
      zoomCtrl.current = null;
    };
  }, [layout, rootId]);

  // ── Tap-vs-drag detection ────────────────────────────────────────────────
  // We intentionally do NOT use the SVG <g>'s onClick. d3.zoom can intercept
  // synthetic clicks on touch surfaces, which is the bug the user hit. Instead
  // we sample pointerdown + pointerup deltas: if the user moved less than
  // TAP_THRESHOLD_PX over less than TAP_THRESHOLD_MS, we treat it as a tap.

  const tapState = useRef<{
    pointerId: number;
    personId: string;
    startX: number;
    startY: number;
    startedAt: number;
  } | null>(null);

  const handleNodePointerDown = (
    e: React.PointerEvent<SVGGElement>,
    personId: string,
  ) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    tapState.current = {
      pointerId: e.pointerId,
      personId,
      startX: e.clientX,
      startY: e.clientY,
      // event.timeStamp is the high-res time of the event itself; it's pure
      // with respect to render and avoids React Compiler's impurity warning
      // that Date.now() would trigger.
      startedAt: e.timeStamp,
    };
  };

  const handleNodePointerUp = (
    e: React.PointerEvent<SVGGElement>,
    personId: string,
  ) => {
    const start = tapState.current;
    tapState.current = null;
    if (!start || start.personId !== personId) return;
    if (start.pointerId !== e.pointerId) return;

    const dx = e.clientX - start.startX;
    const dy = e.clientY - start.startY;
    const dist = Math.hypot(dx, dy);
    const dt = e.timeStamp - start.startedAt;

    if (dist <= TAP_THRESHOLD_PX && dt <= TAP_THRESHOLD_MS) {
      const href = editorMode
        ? `/bang-dieu-khien/thanh-vien/${personId}`
        : `/thanh-vien/${personId}`;
      router.push(href);
    }
  };

  const handleNodeKeyDown = (
    e: React.KeyboardEvent<SVGGElement>,
    personId: string,
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const href = editorMode
        ? `/bang-dieu-khien/thanh-vien/${personId}`
        : `/thanh-vien/${personId}`;
      router.push(href);
    }
  };

  if (!layout) {
    return <EmptyTree note="Không thể dựng được cây từ dữ liệu hiện có." />;
  }

  const nodes = layout.descendants();
  const links = layout.links();

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      // 100dvh accounts for mobile browser chrome; subtract approx header height.
      style={{ height: "calc(100dvh - 72px)" }}
    >
      <Toolbar
        roots={roots.length > 0 ? roots : persons}
        rootId={rootId}
        onRootChange={setRootId}
      />

      <ZoomControls
        onZoomIn={() => zoomCtrl.current?.zoomIn()}
        onZoomOut={() => zoomCtrl.current?.zoomOut()}
        onReset={() => zoomCtrl.current?.reset()}
      />

      <svg
        ref={svgRef}
        className="w-full h-full"
        // touch-action: none lets d3.zoom handle pinch + drag. The nodes still
        // receive pointer events because they sit inside the same gesture
        // surface — we use pointerdown/up deltas to tell tap from pan.
        style={{
          cursor: "grab",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          backgroundColor: "var(--color-parchment)",
        }}
        aria-label="Sơ đồ phả hệ — kéo để di chuyển, hai ngón để thu phóng"
        role="application"
      >
        <g ref={gRef}>
          {/* Edges */}
          <g aria-hidden="true">
            {links.map((link, i) => {
              const sx = link.source.x ?? 0;
              const sy = link.source.y ?? 0;
              const tx = link.target.x ?? 0;
              const ty = link.target.y ?? 0;
              const my = (sy + ty) / 2;
              return (
                <path
                  key={`l-${i}`}
                  d={`M${sx},${sy + NODE_H / 2} C${sx},${my} ${tx},${my} ${tx},${ty - NODE_H / 2}`}
                  fill="none"
                  stroke="var(--color-ink)"
                  strokeOpacity={0.3}
                  strokeWidth={1.25}
                />
              );
            })}
          </g>

          {/* Nodes */}
          <g>
            {nodes.map((node) => {
              const tn = node.data;
              const p = tn.person;
              const spouse = tn.spouses[0];
              const cx = (node.x ?? 0) - NODE_W / 2;
              const cy = (node.y ?? 0) - NODE_H / 2;

              return (
                <g
                  key={p.id}
                  transform={`translate(${cx}, ${cy})`}
                  tabIndex={0}
                  role="button"
                  aria-label={ariaLabelFor(p, spouse)}
                  style={{ cursor: "pointer", outline: "none" }}
                  onPointerDown={(e) => handleNodePointerDown(e, p.id)}
                  onPointerUp={(e) => handleNodePointerUp(e, p.id)}
                  onPointerCancel={() => {
                    tapState.current = null;
                  }}
                  onKeyDown={(e) => handleNodeKeyDown(e, p.id)}
                >
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={4}
                    fill="var(--color-ivory)"
                    stroke={
                      p.is_in_law
                        ? "rgba(139,115,85,0.55)"
                        : "rgba(26,23,20,0.18)"
                    }
                    strokeDasharray={p.is_in_law ? "4 3" : undefined}
                    strokeWidth={1}
                  />
                  {/* Focus ring — visible on keyboard nav */}
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={4}
                    fill="none"
                    stroke="var(--color-lacquer)"
                    strokeWidth={2}
                    style={{
                      pointerEvents: "none",
                      opacity: 0,
                    }}
                    className="focus-ring"
                  />
                  {p.generation != null && (
                    <text
                      x={12}
                      y={18}
                      fontSize={10}
                      fontFamily="var(--font-serif)"
                      fill="var(--color-gold)"
                      letterSpacing={1}
                    >
                      Thế hệ {p.generation}
                    </text>
                  )}
                  <text
                    x={NODE_W / 2}
                    y={spouse ? 40 : 46}
                    textAnchor="middle"
                    fontSize={16}
                    fontFamily="var(--font-serif)"
                    fontWeight={500}
                    fill={
                      p.is_deceased
                        ? "var(--color-sepia)"
                        : "var(--color-ink)"
                    }
                  >
                    {truncate(p.full_name, 24)}
                  </text>
                  {spouse && (
                    <text
                      x={NODE_W / 2}
                      y={58}
                      textAnchor="middle"
                      fontSize={12}
                      fontStyle="italic"
                      fontFamily="var(--font-serif)"
                      fill="var(--color-sepia)"
                    >
                      ⚭ {truncate(spouse.full_name, 22)}
                    </text>
                  )}
                  <text
                    x={NODE_W / 2}
                    y={NODE_H - 10}
                    textAnchor="middle"
                    fontSize={10}
                    fontFamily="var(--font-sans)"
                    fill="var(--color-sepia)"
                  >
                    {formatLifespan(p)}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

    </div>
  );
}

// ═══ Toolbar (root picker) ═════════════════════════════════════════════════

function Toolbar({
  roots,
  rootId,
  onRootChange,
}: {
  roots: Person[];
  rootId: string | null;
  onRootChange: (id: string | null) => void;
}) {
  return (
    <div
      className="absolute top-3 left-3 right-3 z-10 flex items-center gap-2 px-3 py-2 sm:right-auto"
      style={{
        backgroundColor: "var(--color-ivory)",
        borderRadius: "var(--radius-paper)",
        boxShadow:
          "0 1px 0 rgba(26,23,20,0.04), 0 4px 14px rgba(26,23,20,0.06)",
        maxWidth: "min(100% - 1.5rem, 28rem)",
      }}
    >
      <label
        htmlFor="root-select"
        className="text-xs whitespace-nowrap"
        style={{ color: "var(--color-sepia)" }}
      >
        Gốc cây:
      </label>
      <select
        id="root-select"
        value={rootId ?? ""}
        onChange={(e) => onRootChange(e.target.value || null)}
        className="text-sm bg-transparent flex-1 min-w-0"
        style={{
          color: "var(--color-ink)",
          border: "none",
          outline: "none",
          appearance: "none",
          // Adequate hit target on touch.
          minHeight: 32,
        }}
      >
        {roots.map((p) => (
          <option key={p.id} value={p.id}>
            {p.full_name}
            {p.birth_year ? ` (${p.birth_year})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

// ═══ Zoom controls — accessibility floor ═══════════════════════════════════

function ZoomControls({
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  const baseClass =
    "w-11 h-11 flex items-center justify-center text-lg transition-shadow";
  const baseStyle: React.CSSProperties = {
    backgroundColor: "var(--color-ivory)",
    border: "1px solid rgba(26,23,20,0.12)",
    borderRadius: "var(--radius-paper)",
    color: "var(--color-ink)",
    boxShadow: "0 1px 0 rgba(26,23,20,0.04)",
  };

  return (
    <div
      className="absolute z-10 flex flex-col gap-2"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
        right: "calc(env(safe-area-inset-right, 0px) + 1rem)",
      }}
    >
      <button
        type="button"
        onClick={onZoomIn}
        className={baseClass}
        style={baseStyle}
        aria-label="Phóng to"
      >
        +
      </button>
      <button
        type="button"
        onClick={onZoomOut}
        className={baseClass}
        style={baseStyle}
        aria-label="Thu nhỏ"
      >
        −
      </button>
      <button
        type="button"
        onClick={onReset}
        className={baseClass}
        style={baseStyle}
        aria-label="Đặt lại sơ đồ"
      >
        ⟳
      </button>
    </div>
  );
}

// ═══ Mobile list view ══════════════════════════════════════════════════════
//
// Per proposal §6.10: on phones, a pinch-zoom canvas frustrates older users
// more than it helps. We render a generation-grouped accordion with a parent
// picker at the top. Every interaction is a regular tap on a wide button.

function MobileList({
  persons,
  relationships,
  initialRootId,
  editorMode = false,
}: FamilyTreeProps) {
  const adj = useMemo(
    () => buildAdjacency(persons, relationships),
    [persons, relationships],
  );
  const roots = useMemo(() => findRoots(persons, adj), [persons, adj]);

  const [rootId, setRootId] = useState<string | null>(
    initialRootId ?? roots[0]?.id ?? persons[0]?.id ?? null,
  );

  const tree = useMemo(() => {
    if (!rootId) return null;
    return buildTreeFromRoot(rootId, persons, adj);
  }, [rootId, persons, adj]);

  if (!tree) return <EmptyTree />;

  const grouped = groupByGeneration(tree);

  return (
    <div
      className="w-full"
      style={{ minHeight: "calc(100dvh - 72px)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className="sticky top-0 z-10 px-4 py-3 flex items-center gap-2"
        style={{
          backgroundColor: "var(--color-parchment)",
          borderBottom: "1px solid rgba(26,23,20,0.08)",
        }}
      >
        <label
          htmlFor="root-select-mobile"
          className="text-xs whitespace-nowrap"
          style={{ color: "var(--color-sepia)" }}
        >
          Gốc cây:
        </label>
        <select
          id="root-select-mobile"
          value={rootId ?? ""}
          onChange={(e) => setRootId(e.target.value || null)}
          className="flex-1 text-sm py-2 px-2"
          style={{
            backgroundColor: "var(--color-ivory)",
            border: "1px solid rgba(26,23,20,0.12)",
            borderRadius: "var(--radius-paper)",
            color: "var(--color-ink)",
            minHeight: 40,
          }}
        >
          {(roots.length > 0 ? roots : persons).map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
              {p.birth_year ? ` (${p.birth_year})` : ""}
            </option>
          ))}
        </select>
      </div>

      <ol className="px-4 py-4 space-y-6">
        {grouped.map((group, idx) => (
          <li key={idx}>
            <p
              className="text-xs tracking-wider uppercase mb-2"
              style={{ color: "var(--color-gold)" }}
            >
              Thế hệ {group.generation ?? idx + 1}
            </p>
            <ul className="space-y-2">
              {group.entries.map((entry) => (
                <MobileNodeRow
                  key={entry.node.person.id}
                  entry={entry}
                  editorMode={editorMode}
                />
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

interface GroupedEntry {
  node: TreeNode;
  parentName: string | null;
}

interface GenerationGroup {
  generation: number | null;
  entries: GroupedEntry[];
}

function groupByGeneration(root: TreeNode): GenerationGroup[] {
  const groups = new Map<number, GroupedEntry[]>();
  const walk = (node: TreeNode, parentName: string | null, depth: number) => {
    const gen = node.person.generation ?? depth;
    const arr = groups.get(gen) ?? [];
    arr.push({ node, parentName });
    groups.set(gen, arr);
    for (const child of node.children) {
      walk(child, node.person.full_name, depth + 1);
    }
  };
  walk(root, null, 1);

  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([generation, entries]) => ({ generation, entries }));
}

function MobileNodeRow({
  entry,
  editorMode,
}: {
  entry: GroupedEntry;
  editorMode: boolean;
}) {
  const p = entry.node.person;
  const spouse = entry.node.spouses[0];
  const href = editorMode
    ? `/bang-dieu-khien/thanh-vien/${p.id}`
    : `/thanh-vien/${p.id}`;

  return (
    <li>
      <Link
        href={href}
        className="block py-3 px-4 active:opacity-80"
        style={{
          backgroundColor: "var(--color-ivory)",
          borderRadius: "var(--radius-card)",
          border: p.is_in_law
            ? "1px dashed rgba(139,115,85,0.55)"
            : "1px solid rgba(26,23,20,0.10)",
          minHeight: 56,
        }}
      >
        <p
          className="font-serif text-base"
          style={{
            color: p.is_deceased
              ? "var(--color-sepia)"
              : "var(--color-ink)",
            fontWeight: 500,
          }}
        >
          {p.full_name}
          {p.birth_year ? (
            <span
              className="ml-2 text-sm tabular-nums"
              style={{ color: "var(--color-sepia)" }}
            >
              ({formatLifespan(p)})
            </span>
          ) : null}
        </p>
        {spouse ? (
          <p
            className="text-sm font-serif italic mt-1"
            style={{ color: "var(--color-sepia)" }}
          >
            ⚭ {spouse.full_name}
          </p>
        ) : null}
        {entry.parentName ? (
          <p
            className="text-xs mt-1"
            style={{ color: "var(--color-sepia)" }}
          >
            Con của {entry.parentName}
          </p>
        ) : null}
      </Link>
    </li>
  );
}

// ═══ Helpers ═══════════════════════════════════════════════════════════════

function ariaLabelFor(p: Person, spouse?: Person): string {
  const parts: string[] = [p.full_name];
  if (p.generation != null) parts.push(`thế hệ ${p.generation}`);
  if (p.birth_year) parts.push(`sinh ${p.birth_year}`);
  if (p.is_deceased) parts.push("đã mất");
  if (spouse) parts.push(`vợ/chồng: ${spouse.full_name}`);
  return parts.join(", ");
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function formatLifespan(p: Person): string {
  if (!p.birth_year && !p.death_year) return "";
  const b = p.birth_year ? String(p.birth_year) : "?";
  if (!p.is_deceased) {
    return p.birth_year ? `sinh ${b}` : "";
  }
  const d = p.death_year ? String(p.death_year) : "?";
  return `${b} – ${d}`;
}

function EmptyTree({ note }: { note?: string }) {
  return (
    <div
      className="text-center py-24 px-6 max-w-xl mx-auto"
      style={{
        backgroundColor: "var(--color-ivory)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <p className="font-serif text-2xl mb-3">Gia phả còn trống</p>
      <p style={{ color: "var(--color-sepia)" }}>
        {note ??
          "Khi các thành viên đầu tiên được thêm vào, sơ đồ phả hệ sẽ hiện ra ở đây."}
      </p>
    </div>
  );
}

function useIsMobileViewport(): boolean {
  // Default to false during SSR so the desktop branch ships in the initial
  // HTML; the hook flips to true on client mount if the viewport is small.
  // This keeps SSR deterministic and avoids hydration mismatches.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}


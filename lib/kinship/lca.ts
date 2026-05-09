import type { KinshipPerson } from "./terms";

/**
 * BFS the ancestry of `startId`, returning a map from every reachable ancestor
 * to {depth, path}. `path` accumulates intermediate `KinshipPerson` nodes
 * walked from the start (inclusive) up to but NOT including the ancestor.
 *
 * - `path[0]` is the start itself (depth 0).
 * - `path[depth - 1]` is the immediate child of the ancestor on this branch.
 *
 * `parentMap[id]` returns the parent ids of `id`. The traversal is over the
 * blood DAG; cycles (data errors) are guarded by a visited set, and a
 * `console.warn` fires once if any are detected.
 */
export interface AncestryEntry {
  depth: number;
  path: KinshipPerson[];
}

export function bfsAncestors(
  startId: string,
  parentMap: Map<string, string[]>,
  personsMap: Map<string, KinshipPerson>,
): Map<string, AncestryEntry> {
  const out = new Map<string, AncestryEntry>();
  const start = personsMap.get(startId);
  if (!start) return out;

  const queue: { id: string; depth: number; path: KinshipPerson[] }[] = [
    { id: startId, depth: 0, path: [] },
  ];
  let cycleWarned = false;

  while (queue.length > 0) {
    const { id, depth, path } = queue.shift()!;
    if (out.has(id)) {
      // Already reached at an equal or shorter depth — skip. If the existing
      // entry's depth is strictly greater, that would imply a cycle, since BFS
      // would have visited the shorter path first.
      const existing = out.get(id)!;
      if (existing.depth > depth && !cycleWarned) {
        console.warn(`[kinship] Cycle detected in parent graph at id=${id}`);
        cycleWarned = true;
      }
      continue;
    }
    out.set(id, { depth, path });

    const node = personsMap.get(id);
    if (!node) continue;

    const parents = parentMap.get(id) ?? [];
    for (const parentId of parents) {
      if (!personsMap.has(parentId)) continue;
      queue.push({
        id: parentId,
        depth: depth + 1,
        path: [...path, node],
      });
    }
  }

  return out;
}

/**
 * Finds the Lowest Common Ancestor between two ancestor maps, minimizing
 * `depthA + depthB`. Returns `null` when no common ancestor exists.
 */
export interface LcaResult {
  lcaId: string;
  depthA: number;
  depthB: number;
  pathA: KinshipPerson[]; // start → ... → child of LCA on A's side
  pathB: KinshipPerson[];
  totalDistance: number;
}

export function findLCA(
  ancA: Map<string, AncestryEntry>,
  ancB: Map<string, AncestryEntry>,
): LcaResult | null {
  let best: LcaResult | null = null;

  for (const [id, a] of ancA) {
    const b = ancB.get(id);
    if (!b) continue;
    const total = a.depth + b.depth;
    if (!best || total < best.totalDistance) {
      best = {
        lcaId: id,
        depthA: a.depth,
        depthB: b.depth,
        pathA: a.path,
        pathB: b.path,
        totalDistance: total,
      };
    }
  }

  return best;
}

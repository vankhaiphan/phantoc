import type { Person, Relationship } from "@/types";

export interface AdjacencyLists {
  /** parentId → child ids, sorted by birth_order then birth_year */
  childrenByParent: Map<string, string[]>;
  /** personId → parent ids */
  parentsByPerson: Map<string, string[]>;
  /** personId → spouse ids */
  spousesByPerson: Map<string, string[]>;
}

export function buildAdjacency(
  persons: Person[],
  rels: Relationship[],
): AdjacencyLists {
  const personsById = new Map(persons.map((p) => [p.id, p]));
  const childrenByParent = new Map<string, string[]>();
  const parentsByPerson = new Map<string, string[]>();
  const spousesByPerson = new Map<string, string[]>();

  for (const r of rels) {
    if (r.type === "biological_child" || r.type === "adopted_child") {
      // person_a is parent, person_b is child
      pushTo(childrenByParent, r.person_a, r.person_b);
      pushTo(parentsByPerson, r.person_b, r.person_a);
    } else if (r.type === "marriage") {
      pushTo(spousesByPerson, r.person_a, r.person_b);
      pushTo(spousesByPerson, r.person_b, r.person_a);
    }
  }

  // Sort children: birth_order first, then birth_year, then full_name
  for (const [, kids] of childrenByParent) {
    kids.sort((a, b) => compareSeniority(personsById.get(a), personsById.get(b)));
  }

  return { childrenByParent, parentsByPerson, spousesByPerson };
}

function pushTo<K>(m: Map<K, string[]>, k: K, v: string) {
  const arr = m.get(k);
  if (arr) {
    if (!arr.includes(v)) arr.push(v);
  } else {
    m.set(k, [v]);
  }
}

function compareSeniority(a?: Person, b?: Person): number {
  if (!a || !b) return 0;
  const oa = a.birth_order ?? Number.POSITIVE_INFINITY;
  const ob = b.birth_order ?? Number.POSITIVE_INFINITY;
  if (oa !== ob) return oa - ob;
  const ya = a.birth_year ?? Number.POSITIVE_INFINITY;
  const yb = b.birth_year ?? Number.POSITIVE_INFINITY;
  if (ya !== yb) return ya - yb;
  return a.full_name.localeCompare(b.full_name, "vi");
}

/**
 * Persons with no parent edges in the dataset — candidate roots for the tree.
 * A root with descendants is preferred over a root that's an isolated leaf.
 */
export function findRoots(persons: Person[], adj: AdjacencyLists): Person[] {
  return persons
    .filter((p) => {
      const parents = adj.parentsByPerson.get(p.id);
      return !parents || parents.length === 0;
    })
    .sort((a, b) => {
      // Prefer roots with descendants
      const ad = adj.childrenByParent.get(a.id)?.length ?? 0;
      const bd = adj.childrenByParent.get(b.id)?.length ?? 0;
      if (ad !== bd) return bd - ad;
      // Then oldest birth year
      const ay = a.birth_year ?? Number.POSITIVE_INFINITY;
      const by = b.birth_year ?? Number.POSITIVE_INFINITY;
      if (ay !== by) return ay - by;
      // Fall back to full name
      return a.full_name.localeCompare(b.full_name, "vi");
    });
}

/** A node in the tree we render. The family graph is a DAG; a child shared by
 *  two in-tree parents appears under whichever parent we visit first. */
export interface TreeNode {
  person: Person;
  spouses: Person[];
  children: TreeNode[];
}

export function buildTreeFromRoot(
  rootId: string,
  persons: Person[],
  adj: AdjacencyLists,
): TreeNode | null {
  const personsById = new Map(persons.map((p) => [p.id, p]));
  const visited = new Set<string>();

  function build(id: string): TreeNode | null {
    if (visited.has(id)) return null;
    visited.add(id);

    const person = personsById.get(id);
    if (!person) return null;

    const spouseIds = adj.spousesByPerson.get(id) ?? [];
    const spouses = spouseIds
      .map((sid) => personsById.get(sid))
      .filter((p): p is Person => Boolean(p));

    const childIds = adj.childrenByParent.get(id) ?? [];
    const children = childIds
      .map(build)
      .filter((n): n is TreeNode => n !== null);

    return { person, spouses, children };
  }

  return build(rootId);
}

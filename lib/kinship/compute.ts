import type {
  KinshipResult,
  Relationship,
  RelationshipType,
} from "@/types";
import { bfsAncestors, findLCA } from "./lca";
import {
  compareSeniority,
  computeSide,
  getCousinTerms,
  getDirectAncestorTerm,
  getDirectDescendantTerm,
  getDistantCousinTerms,
  getSiblingTerms,
  getUncleAuntTerm,
  wrapThroughASpouse,
  wrapThroughBSpouse,
  wrapThroughBothSpouses,
  type KinshipPerson,
} from "./terms";

export interface KinshipOptions {
  /**
   * Treat adopted_child edges as blood relations. Defaults to true (matches
   * the reference). Set false to compute strictly biological kinship per
   * proposal §5.3.1.
   */
  includeAdoption?: boolean;
}

/**
 * Compute the kinship between two persons. Returns `null` if A === B.
 * Otherwise returns a `KinshipResult` with the Vietnamese terms each
 * person uses to address the other, plus path metadata for the UI.
 */
export function computeKinship(
  personA: KinshipPerson,
  personB: KinshipPerson,
  persons: KinshipPerson[],
  relationships: Relationship[] | RelationshipEdge[],
  opts: KinshipOptions = {},
): KinshipResult | null {
  if (personA.id === personB.id) return null;

  const includeAdoption = opts.includeAdoption ?? true;
  const personsMap = new Map(persons.map((p) => [p.id, p]));
  const { parentMap, spouseMap } = buildMaps(relationships, includeAdoption);

  // 0. Direct marriage
  const spousesA = spouseMap.get(personA.id) ?? [];
  if (spousesA.includes(personB.id)) {
    return {
      aCallsB: personB.gender === "female" ? "Vợ" : "Chồng",
      bCallsA: personA.gender === "female" ? "Vợ" : "Chồng",
      description: "Quan hệ hôn nhân",
      distance: 0,
      pathLabels: [`${personA.full_name} và ${personB.full_name} là vợ chồng.`],
      side: "marital",
      certainty: "certain",
      ancestorId: null,
    };
  }

  // 1. Pure blood path
  const blood = findBloodKinship(personA, personB, personsMap, parentMap);
  if (blood) return blood;

  // 2. Through A's spouse
  for (const sId of spousesA) {
    if (sId === personB.id) continue;
    const spouseA = personsMap.get(sId);
    if (!spouseA) continue;
    const res = findBloodKinship(spouseA, personB, personsMap, parentMap);
    if (!res) continue;

    const wrapped = wrapThroughASpouse(res, personA.gender);
    return {
      ...res,
      aCallsB: wrapped.aCallsB,
      bCallsA: wrapped.bCallsA,
      description: `Thông qua hôn nhân của ${spouseA.full_name}: ${res.description}`,
      pathLabels: [
        `${personA.full_name} là ${personA.gender === "male" ? "Chồng" : "Vợ"} của ${spouseA.full_name}.`,
        ...res.pathLabels,
      ],
      side: "marital",
    };
  }

  // 3. Through B's spouse
  const spousesB = spouseMap.get(personB.id) ?? [];
  for (const sId of spousesB) {
    if (sId === personA.id) continue;
    const spouseB = personsMap.get(sId);
    if (!spouseB) continue;
    const res = findBloodKinship(personA, spouseB, personsMap, parentMap);
    if (!res) continue;

    const wrapped = wrapThroughBSpouse(res, personB.gender);
    return {
      ...res,
      aCallsB: wrapped.aCallsB,
      bCallsA: wrapped.bCallsA,
      description: `Thông qua hôn nhân của ${spouseB.full_name}: ${res.description}`,
      pathLabels: [
        ...res.pathLabels,
        `${personB.full_name} là ${personB.gender === "male" ? "Chồng" : "Vợ"} của ${spouseB.full_name}.`,
      ],
      side: "marital",
    };
  }

  // 4. Through both spouses (cột chèo / chị em dâu)
  for (const sIdA of spousesA) {
    const spouseA = personsMap.get(sIdA);
    if (!spouseA) continue;
    for (const sIdB of spousesB) {
      if (sIdA === sIdB) continue;
      const spouseB = personsMap.get(sIdB);
      if (!spouseB) continue;

      const res = findBloodKinship(spouseA, spouseB, personsMap, parentMap);
      if (!res) continue;

      const wrapped = wrapThroughBothSpouses(
        res,
        personA.gender,
        personB.gender,
        spouseA.gender,
        spouseB.gender,
      );
      const prefixA = personA.gender === "male" ? "Chồng" : "Vợ";
      const prefixB = personB.gender === "male" ? "Chồng" : "Vợ";

      return {
        ...res,
        aCallsB: wrapped.aCallsB,
        bCallsA: wrapped.bCallsA,
        description: `Thông qua hôn nhân của cả ${spouseA.full_name} và ${spouseB.full_name}`,
        pathLabels: [
          `${personA.full_name} là ${prefixA} của ${spouseA.full_name}.`,
          ...res.pathLabels,
          `${personB.full_name} là ${prefixB} của ${spouseB.full_name}.`,
        ],
        side: "marital",
      };
    }
  }

  // No path found
  return {
    aCallsB: "Chưa xác định",
    bCallsA: "Chưa xác định",
    description: "Không tìm thấy quan hệ trong phạm vi dữ liệu",
    distance: -1,
    pathLabels: [],
    side: "self",
    certainty: "fallback",
    ancestorId: null,
  };
}

// ─── Internals ─────────────────────────────────────────────────────────────

/**
 * Adjacency map subset the engine needs. The relationship table normalises
 * parents as `person_a → person_b` for child rows and `person_a ↔ person_b`
 * for marriage rows.
 */
interface RelationshipEdge {
  type: RelationshipType | string;
  person_a: string;
  person_b: string;
}

function buildMaps(
  rels: Relationship[] | RelationshipEdge[],
  includeAdoption: boolean,
): {
  parentMap: Map<string, string[]>;
  spouseMap: Map<string, string[]>;
} {
  const parentMap = new Map<string, string[]>();
  const spouseMap = new Map<string, string[]>();
  const push = (map: Map<string, string[]>, k: string, v: string) => {
    const arr = map.get(k);
    if (arr) {
      if (!arr.includes(v)) arr.push(v);
    } else {
      map.set(k, [v]);
    }
  };

  for (const r of rels) {
    if (
      r.type === "biological_child" ||
      (includeAdoption && r.type === "adopted_child")
    ) {
      push(parentMap, r.person_b, r.person_a);
    } else if (r.type === "marriage") {
      push(spouseMap, r.person_a, r.person_b);
      push(spouseMap, r.person_b, r.person_a);
    }
  }
  return { parentMap, spouseMap };
}

function findBloodKinship(
  personA: KinshipPerson,
  personB: KinshipPerson,
  personsMap: Map<string, KinshipPerson>,
  parentMap: Map<string, string[]>,
): KinshipResult | null {
  const ancA = bfsAncestors(personA.id, parentMap, personsMap);
  const ancB = bfsAncestors(personB.id, parentMap, personsMap);

  const lca = findLCA(ancA, ancB);
  if (!lca) return null;

  const lcaPerson = personsMap.get(lca.lcaId);
  const lcaName = lcaPerson?.full_name ?? "Tổ tiên chung";

  const { aCallsB, bCallsA, description, side } = resolveBloodTerms(
    personA,
    personB,
    lca.depthA,
    lca.depthB,
    lca.pathA,
    lca.pathB,
    parentMap,
  );

  const pathLabels: string[] = [];
  if (personA.id !== lca.lcaId)
    pathLabels.push(`${personA.full_name} cách ${lcaName} ${lca.depthA} đời.`);
  if (personB.id !== lca.lcaId)
    pathLabels.push(`${personB.full_name} cách ${lcaName} ${lca.depthB} đời.`);

  const isSelfLineage = personA.id === lca.lcaId || personB.id === lca.lcaId;

  return {
    aCallsB,
    bCallsA,
    description: isSelfLineage
      ? description
      : `${description} (Tổ tiên chung: ${lcaName})`,
    distance: lca.totalDistance,
    pathLabels,
    side,
    certainty: "certain",
    ancestorId: lca.lcaId,
  };
}

/**
 * Term resolution for a known blood path. Returns plain strings + side;
 * `findBloodKinship` wraps in the full `KinshipResult`.
 */
function resolveBloodTerms(
  personA: KinshipPerson,
  personB: KinshipPerson,
  depthA: number,
  depthB: number,
  pathA: KinshipPerson[],
  pathB: KinshipPerson[],
  parentMap: Map<string, string[]>,
): {
  aCallsB: string;
  bCallsA: string;
  description: string;
  side: KinshipResult["side"];
} {
  const side = computeSide(depthA, depthB, pathA, pathB);

  // Direct lineage — A is the LCA, B is descendant
  if (depthA === 0) {
    const firstChildOfA = pathB[pathB.length - 1];
    const isPaternal = firstChildOfA?.gender === "male";
    return {
      aCallsB: getDirectDescendantTerm(depthB, personB.gender),
      bCallsA: getDirectAncestorTerm(depthB, personA.gender, isPaternal),
      description: "Quan hệ trực hệ",
      side: isPaternal ? "paternal" : "maternal",
    };
  }
  // Direct lineage — B is the LCA, A is descendant
  if (depthB === 0) {
    const firstChildOfB = pathA[pathA.length - 1];
    const isPaternal = firstChildOfB?.gender === "male";
    return {
      aCallsB: getDirectAncestorTerm(depthA, personB.gender, isPaternal),
      bCallsA: getDirectDescendantTerm(depthA, personA.gender),
      description: "Quan hệ trực hệ",
      side: isPaternal ? "paternal" : "maternal",
    };
  }

  // Both depths > 0 — collateral relationship
  const branchA = pathA[pathA.length - 1];
  const branchB = pathB[pathB.length - 1];

  if (!branchA || !branchB) {
    return {
      aCallsB: "Người trong họ",
      bCallsA: "Người trong họ",
      description: "Quan hệ họ hàng",
      side,
    };
  }

  // Sibling case
  if (depthA === 1 && depthB === 1) {
    const aIsSenior = compareSeniority(personA, personB) === "senior";
    const isHalf = !areFullSiblings(personA.id, personB.id, parentMap);
    const t = getSiblingTerms(personA.gender, personB.gender, aIsSenior, isHalf);
    return { ...t, side };
  }

  // Uncle / aunt (B is sibling of A's ancestor on path of length depthA - 1).
  // B is senior to that ancestor (= "Bác") iff branchA is junior to B.
  if (depthA > 1 && depthB === 1) {
    const bIsSenior = compareSeniority(branchA, personB) === "junior";
    const ua = getUncleAuntTerm(depthA, personB.gender, branchA.gender, bIsSenior);
    return {
      aCallsB: ua.term,
      bCallsA: getDirectDescendantTerm(depthA, personA.gender),
      description: ua.isPaternal ? "Họ hàng bên Nội (Vế trên)" : "Họ hàng bên Ngoại (Vế trên)",
      side: ua.isPaternal ? "paternal" : "maternal",
    };
  }
  // Inverse — A is in B's parent's generation
  if (depthA === 1 && depthB > 1) {
    const aIsSenior = compareSeniority(branchB, personA) === "junior";
    const ua = getUncleAuntTerm(depthB, personA.gender, branchB.gender, aIsSenior);
    return {
      aCallsB: getDirectDescendantTerm(depthB, personB.gender),
      bCallsA: ua.term,
      description: ua.isPaternal ? "Họ hàng bên Nội (Vế dưới)" : "Họ hàng bên Ngoại (Vế dưới)",
      side: ua.isPaternal ? "paternal" : "maternal",
    };
  }

  // Cousin — same generation beyond depth 1
  if (depthA === depthB) {
    const aIsSenior = compareSeniority(branchA, branchB) === "senior";
    const c = getCousinTerms(personA.gender, personB.gender, aIsSenior, branchA.gender);
    return {
      aCallsB: c.aCallsB,
      bCallsA: c.bCallsA,
      description: c.description,
      side: c.isPaternal ? "paternal" : "maternal",
    };
  }

  // Distant cousin (different generations, both > 1).
  // B is senior to A's branch iff branchA is junior to branchB.
  if (depthA > depthB) {
    const bIsSenior = compareSeniority(branchA, branchB) === "junior";
    const dc = getDistantCousinTerms(
      depthA,
      depthB,
      personB.gender,
      branchA.gender,
      bIsSenior,
    );
    return {
      aCallsB: dc.term,
      bCallsA: "Cháu họ",
      description: dc.isPaternal ? "Họ hàng bên Nội" : "Họ hàng bên Ngoại",
      side: dc.isPaternal ? "paternal" : "maternal",
    };
  }
  // depthA < depthB: A is in B's older-generation cousin set
  const aIsSenior = compareSeniority(branchB, branchA) === "junior";
  const dc = getDistantCousinTerms(
    depthB,
    depthA,
    personA.gender,
    branchB.gender,
    aIsSenior,
  );
  return {
    aCallsB: "Cháu họ",
    bCallsA: dc.term,
    description: dc.isPaternal ? "Họ hàng bên Nội" : "Họ hàng bên Ngoại",
    side: dc.isPaternal ? "paternal" : "maternal",
  };
}

/**
 * Two people are full siblings if they share *every* parent in the data.
 * Conservative: if either has zero parents recorded, returns true (we can't
 * distinguish; default to the simpler "anh chị em ruột" form). Half-sibling
 * detection only kicks in when both have parents and the sets differ.
 */
function areFullSiblings(
  aId: string,
  bId: string,
  parentMap: Map<string, string[]>,
): boolean {
  const pa = parentMap.get(aId);
  const pb = parentMap.get(bId);
  if (!pa?.length || !pb?.length) return true;
  if (pa.length !== pb.length) return false;
  const pbSet = new Set(pb);
  return pa.every((id) => pbSet.has(id));
}

// Re-exports so callers can build maps once and reuse.
export { bfsAncestors, findLCA } from "./lca";
export type { AncestryEntry } from "./lca";
export type { KinshipPerson } from "./terms";

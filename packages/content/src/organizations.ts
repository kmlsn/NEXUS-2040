export const NPC_ORGANIZATION_IDS = ["nexilune_industrial", "asteria_civic_grid", "free_mesh"] as const;
export type NpcOrganizationId = (typeof NPC_ORGANIZATION_IDS)[number];
export const NPC_DOCTRINES = ["centralize", "continuity", "distribute"] as const;
export type NpcDoctrine = (typeof NPC_DOCTRINES)[number];

export interface NpcOrganizationDefinition {
  readonly id: NpcOrganizationId;
  readonly name: string;
  readonly goal: string;
  readonly capacities: Readonly<Record<string, number>>;
  readonly weakness: string;
  readonly initialDoctrine: NpcDoctrine;
  readonly initialReadiness: number;
}

export const NPC_ORGANIZATIONS: readonly NpcOrganizationDefinition[] = [
  { id: "nexilune_industrial", name: "Nexilune Industrial", goal: "Verim, kâr ve merkezi kontrol", capacities: { compute: 85, industry: 80, bid_capacity: 75 }, weakness: "Kamu güveni ve yüksek görünürlük", initialDoctrine: "centralize", initialReadiness: 65 },
  { id: "asteria_civic_grid", name: "Asteria Civic Grid", goal: "Hizmet sürekliliği ve bölgesel istikrar", capacities: { resilience: 85, relationship: 75, crisis_response: 80 }, weakness: "Yavaş karar ve sınırlı esneklik", initialDoctrine: "continuity", initialReadiness: 60 },
  { id: "free_mesh", name: "Free Mesh", goal: "Özerklik ve dağıtık erişim", capacities: { intelligence: 80, stealth: 85, adaptability: 75 }, weakness: "Sermaye ve Bileşen kıtlığı", initialDoctrine: "distribute", initialReadiness: 55 },
];

export function npcOrganization(id: NpcOrganizationId): NpcOrganizationDefinition {
  const organization = NPC_ORGANIZATIONS.find((item) => item.id === id);
  if (!organization) throw new Error("Unknown NPC organization.");
  return organization;
}

import { strict as assert } from "node:assert";
import { NPC_DOCTRINES, NPC_ORGANIZATION_IDS, NPC_ORGANIZATIONS, npcOrganization } from "../src/organizations";

assert.deepEqual(NPC_ORGANIZATIONS.map((item) => item.id), NPC_ORGANIZATION_IDS);
assert.equal(new Set(NPC_ORGANIZATION_IDS).size, 3);
for (const organization of NPC_ORGANIZATIONS) {
  assert(organization.goal.length > 0 && organization.weakness.length > 0);
  assert(NPC_DOCTRINES.includes(organization.initialDoctrine));
  assert(organization.initialReadiness >= 0 && organization.initialReadiness <= 100);
  assert(Object.values(organization.capacities).every((value) => Number.isInteger(value) && value >= 0 && value <= 100));
}
assert.equal(npcOrganization("free_mesh").name, "Free Mesh");
console.log("PASS: three versioned NPC organization definitions satisfy P3.2 bounds.");

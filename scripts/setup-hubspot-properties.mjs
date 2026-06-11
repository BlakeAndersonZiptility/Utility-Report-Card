#!/usr/bin/env node
/**
 * One-time, idempotent setup of the HubSpot contact properties the report
 * card writes (MASTER_PLAN.md §3). Run with a private-app token that has
 * crm.schemas.contacts.write:
 *
 *   HUBSPOT_ACCESS_TOKEN=pat-... node scripts/setup-hubspot-properties.mjs
 *
 * Existing properties are left untouched.
 */

const TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("Set HUBSPOT_ACCESS_TOKEN first.");
  process.exit(1);
}

const BASE = "https://api.hubapi.com";
const GROUP = "report_card";

const PROPERTIES = [
  { name: "report_card_overall", label: "Report Card: Overall grade", type: "string", fieldType: "text" },
  { name: "report_card_technical", label: "Report Card: Technical grade", type: "string", fieldType: "text" },
  { name: "report_card_managerial", label: "Report Card: Managerial grade", type: "string", fieldType: "text" },
  { name: "report_card_financial", label: "Report Card: Financial grade", type: "string", fieldType: "text" },
  { name: "report_card_practical_grade", label: "Report Card: Practical grade (capped)", type: "string", fieldType: "text" },
  { name: "report_card_redline_flags", label: "Report Card: Red-line flags", type: "string", fieldType: "text", description: "Semicolon-separated dimension ids graded F on the red-line set (e.g. T5;F1)." },
  { name: "report_card_completed_date", label: "Report Card: Completed date", type: "date", fieldType: "date" },
  { name: "report_card_system_name", label: "Report Card: Water system name", type: "string", fieldType: "text" },
  { name: "report_card_state", label: "Report Card: System state", type: "string", fieldType: "text" },
  { name: "report_card_pws_id", label: "Report Card: PWS ID", type: "string", fieldType: "text" },
  { name: "report_card_connections", label: "Report Card: Connections", type: "number", fieldType: "number" },
];

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

async function ensureGroup() {
  const get = await fetch(`${BASE}/crm/v3/properties/contacts/groups/${GROUP}`, { headers });
  if (get.ok) {
    console.log(`Group "${GROUP}" exists.`);
    return;
  }
  const create = await fetch(`${BASE}/crm/v3/properties/contacts/groups`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: GROUP, label: "Utility Report Card" }),
  });
  if (!create.ok) throw new Error(`Group create failed: ${create.status} ${await create.text()}`);
  console.log(`Created group "${GROUP}".`);
}

async function ensureProperty(prop) {
  const get = await fetch(`${BASE}/crm/v3/properties/contacts/${prop.name}`, { headers });
  if (get.ok) {
    console.log(`  ✓ ${prop.name} exists`);
    return;
  }
  const create = await fetch(`${BASE}/crm/v3/properties/contacts`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...prop, groupName: GROUP }),
  });
  if (!create.ok) throw new Error(`${prop.name} create failed: ${create.status} ${await create.text()}`);
  console.log(`  + created ${prop.name}`);
}

await ensureGroup();
for (const prop of PROPERTIES) {
  await ensureProperty(prop);
}
console.log("Done.");

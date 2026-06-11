/**
 * Minimal HubSpot client for the report-card funnel. All functions are
 * no-ops returning null when HUBSPOT_ACCESS_TOKEN is unset; callers never
 * block the user's results on CRM availability.
 *
 * Custom properties must exist in the portal first — run
 * `node scripts/setup-hubspot-properties.mjs` once (see MASTER_PLAN.md §3).
 */

const BASE = "https://api.hubapi.com";

function headers(): Record<string, string> | null {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export interface LeadSummary {
  email: string;
  name: string;
  role: string;
  systemName: string;
  state: string;
  pwsId: string | null;
  connections: number | null;
  overall: string;
  practicalGrade: string | null;
  technical?: string;
  managerial?: string;
  financial?: string;
  redlineFlags: string[];
  completedAt: string;
}

/** Upsert contact by email; returns the contact id, or null when unconfigured. */
export async function upsertContact(summary: LeadSummary): Promise<string | null> {
  const h = headers();
  if (!h) return null;

  const [firstname, ...rest] = summary.name.trim().split(/\s+/);
  const properties: Record<string, string> = {
    email: summary.email,
    firstname,
    lastname: rest.join(" "),
    report_card_overall: summary.overall,
    report_card_technical: summary.technical ?? "",
    report_card_managerial: summary.managerial ?? "",
    report_card_financial: summary.financial ?? "",
    report_card_practical_grade: summary.practicalGrade ?? "",
    report_card_redline_flags: summary.redlineFlags.join(";"),
    report_card_completed_date: summary.completedAt.slice(0, 10),
    report_card_system_name: summary.systemName,
    report_card_state: summary.state,
  };
  if (summary.pwsId) properties.report_card_pws_id = summary.pwsId;
  if (summary.connections)
    properties.report_card_connections = String(summary.connections);

  const update = await fetch(
    `${BASE}/crm/v3/objects/contacts/${encodeURIComponent(summary.email)}?idProperty=email`,
    { method: "PATCH", headers: h, body: JSON.stringify({ properties }) }
  );
  if (update.ok) {
    const body = (await update.json()) as { id: string };
    return body.id;
  }
  if (update.status !== 404) {
    throw new Error(`HubSpot update failed: ${update.status} ${await update.text()}`);
  }

  const create = await fetch(`${BASE}/crm/v3/objects/contacts`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ properties }),
  });
  if (!create.ok) {
    throw new Error(`HubSpot create failed: ${create.status} ${await create.text()}`);
  }
  const body = (await create.json()) as { id: string };
  return body.id;
}

/**
 * Sales routing (MASTER_PLAN.md §3): a completion with red-line flags is the
 * highest-intent conversation — create a HIGH-priority follow-up task on the
 * contact.
 */
export async function createRedLineTask(
  contactId: string,
  summary: LeadSummary
): Promise<void> {
  const h = headers();
  if (!h) return;

  const flagList = summary.redlineFlags.join(", ");
  const response = await fetch(`${BASE}/crm/v3/objects/tasks`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      properties: {
        hs_task_subject: `Report Card red-line flags: ${summary.systemName} (${flagList})`,
        hs_task_body:
          `${summary.name} (${summary.role}) completed the Utility Health Report Card for ` +
          `${summary.systemName}, ${summary.state}` +
          (summary.connections ? ` (${summary.connections} connections)` : "") +
          `. Overall ${summary.overall}` +
          (summary.practicalGrade
            ? `, Practical Grade ${summary.practicalGrade} (capped)`
            : "") +
          `. Red-line F's: ${flagList}. ` +
          "These are existential failure modes — reach out about what the next rung looks like.",
        hs_task_status: "NOT_STARTED",
        hs_task_priority: "HIGH",
        hs_task_type: "TODO",
        hs_timestamp: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      associations: [
        {
          to: { id: contactId },
          types: [
            // 204 = task → contact (HubSpot-defined association type)
            { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 204 },
          ],
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`HubSpot task failed: ${response.status} ${await response.text()}`);
  }
}

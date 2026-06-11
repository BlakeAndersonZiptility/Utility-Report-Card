import { NextRequest, NextResponse } from "next/server";
import { score } from "@/lib/scoring";
import type { Answers, ContactInfo, UtilityInfo } from "@/lib/types";

/**
 * Lead capture endpoint, called when a completed assessment unlocks results.
 *
 * Phase 1: validates and (when HUBSPOT_ACCESS_TOKEN is configured) upserts the
 * contact into HubSpot with report-card properties. Without a token it logs
 * and returns success so the assessment flow never depends on integrations.
 *
 * Phase 2 (see MASTER_PLAN.md): persist the full submission to Postgres for
 * the anonymized benchmarking dataset, generate the action-plan PDF, and
 * trigger the nurture/routing flows.
 */

interface LeadPayload {
  contact: ContactInfo;
  utility: UtilityInfo;
  answers: Answers;
}

export async function POST(request: NextRequest) {
  let payload: LeadPayload;
  try {
    payload = (await request.json()) as LeadPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { contact, utility, answers } = payload;
  if (!contact?.email || !utility?.systemName || !answers) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  let result;
  try {
    result = score(answers);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid answers" },
      { status: 400 }
    );
  }

  const summary = {
    email: contact.email,
    name: contact.name,
    role: contact.role,
    consentBenchmarking: contact.consentBenchmarking,
    systemName: utility.systemName,
    state: utility.state,
    pwsId: utility.pwsId ?? null,
    connections: utility.connections ?? null,
    overall: result.overallLetter,
    practicalGrade: result.practicalGrade,
    technical: result.legs.find((l) => l.leg === "T")?.letter,
    managerial: result.legs.find((l) => l.leg === "M")?.letter,
    financial: result.legs.find((l) => l.leg === "F")?.letter,
    redlineFlags: result.flags.map((f) => f.dimensionId),
    completedAt: new Date().toISOString(),
  };

  let hubspotSynced = false;
  if (process.env.HUBSPOT_ACCESS_TOKEN) {
    try {
      await upsertHubSpotContact(summary);
      hubspotSynced = true;
    } catch (e) {
      // Never block the user's results on CRM availability.
      console.error("HubSpot sync failed:", e);
    }
  } else {
    console.log("Lead captured (HubSpot not configured):", JSON.stringify(summary));
  }

  return NextResponse.json({ ok: true, hubspotSynced });
}

async function upsertHubSpotContact(summary: {
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
}) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  const [firstname, ...rest] = summary.name.trim().split(/\s+/);

  // Custom properties must exist in the portal first — see MASTER_PLAN.md §3
  // for the property definitions (report_card_overall etc., lead_status=New,
  // lifecycle promotion per the CRM rulebook).
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

  const response = await fetch(
    `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(
      summary.email
    )}?idProperty=email`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties }),
    }
  );

  if (response.status === 404) {
    const create = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties }),
    });
    if (!create.ok) {
      throw new Error(`HubSpot create failed: ${create.status} ${await create.text()}`);
    }
  } else if (!response.ok) {
    throw new Error(`HubSpot update failed: ${response.status} ${await response.text()}`);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendResultsPdf } from "@/lib/email";
import { createRedLineTask, upsertContact, type LeadSummary } from "@/lib/hubspot";
import { renderReportCardPdf } from "@/lib/pdf";
import { score } from "@/lib/scoring";
import type { Answers, ContactInfo, UtilityInfo } from "@/lib/types";

/**
 * Results-unlock endpoint: persists the completed assessment (benchmarking
 * dataset), upserts the HubSpot contact, opens a sales task when red-line
 * flags are present, and emails the action-plan PDF. Every integration is
 * optional and failure-tolerant — the user's results never depend on it.
 */

interface LeadPayload {
  contact: ContactInfo;
  utility: UtilityInfo;
  answers: Answers;
  resumeToken?: string;
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

  const summary: LeadSummary = {
    email: contact.email,
    name: contact.name,
    role: contact.role,
    systemName: utility.systemName,
    state: utility.state,
    pwsId: utility.pwsId || null,
    connections: utility.connections ?? null,
    overall: result.overallLetter,
    practicalGrade: result.practicalGrade,
    technical: result.legs.find((l) => l.leg === "T")?.letter,
    managerial: result.legs.find((l) => l.leg === "M")?.letter,
    financial: result.legs.find((l) => l.leg === "F")?.letter,
    redlineFlags: result.flags.map((f) => f.dimensionId),
    completedAt: new Date().toISOString(),
  };

  // 1. Persist for the benchmarking dataset / re-assessment loop.
  let persisted = false;
  const db = getDb();
  if (db) {
    try {
      const completion = {
        systemName: utility.systemName,
        state: utility.state,
        pwsId: utility.pwsId || null,
        connections: utility.connections ?? null,
        email: contact.email,
        contactName: contact.name,
        role: contact.role,
        consentBenchmarking: contact.consentBenchmarking,
        answers,
        status: "completed",
        overall: summary.overall,
        technical: summary.technical,
        managerial: summary.managerial,
        financial: summary.financial,
        practicalGrade: summary.practicalGrade,
        redlineFlags: summary.redlineFlags,
        completedAt: new Date(),
      };
      let updated = null;
      if (payload.resumeToken) {
        try {
          updated = await db.assessment.update({
            where: { resumeToken: payload.resumeToken },
            data: completion,
          });
        } catch {
          // Unknown token — create instead.
        }
      }
      if (!updated) await db.assessment.create({ data: completion });
      persisted = true;
    } catch (e) {
      console.error("Assessment persist failed:", e);
    }
  }

  // 2. CRM: contact upsert + red-line sales routing.
  let hubspotSynced = false;
  try {
    const contactId = await upsertContact(summary);
    if (contactId) {
      hubspotSynced = true;
      if (summary.redlineFlags.length > 0) {
        await createRedLineTask(contactId, summary);
      }
    }
  } catch (e) {
    console.error("HubSpot sync failed:", e);
  }

  // 3. Email the action-plan PDF.
  let emailed = false;
  try {
    if (process.env.RESEND_API_KEY) {
      const pdf = await renderReportCardPdf({ utility, contact, answers });
      emailed = await sendResultsPdf(contact.email, utility.systemName, pdf);
    }
  } catch (e) {
    console.error("Results email failed:", e);
  }

  if (!persisted && !hubspotSynced) {
    console.log("Lead captured (no integrations configured):", JSON.stringify(summary));
  }

  return NextResponse.json({ ok: true, persisted, hubspotSynced, emailed });
}

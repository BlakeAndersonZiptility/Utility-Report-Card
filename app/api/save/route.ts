import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendResumeLink } from "@/lib/email";
import type { Answers, UtilityInfo } from "@/lib/types";

/**
 * Save-for-resume (magic link). Creates or updates an in-progress assessment
 * and returns a resume URL; emails it when an address is given and email is
 * configured. Browser localStorage remains the same-device fallback when no
 * database is configured.
 */
export async function POST(request: NextRequest) {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ ok: false, reason: "not_configured" });
  }

  let payload: {
    token?: string;
    utility: UtilityInfo;
    answers: Answers;
    email?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!payload.utility?.systemName || !payload.answers) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const data = {
    systemName: payload.utility.systemName,
    state: payload.utility.state,
    pwsId: payload.utility.pwsId || null,
    connections: payload.utility.connections ?? null,
    email: payload.email || null,
    answers: payload.answers,
  };

  let assessment = null;
  if (payload.token) {
    try {
      assessment = await db.assessment.update({
        where: { resumeToken: payload.token },
        data,
      });
    } catch {
      // Stale/unknown token — fall through and create a fresh row.
    }
  }
  assessment ??= await db.assessment.create({ data });

  const origin =
    process.env.APP_URL ?? request.nextUrl.origin ?? "http://localhost:3000";
  const resumeUrl = `${origin}/assessment?resume=${assessment.resumeToken}`;

  let emailed = false;
  if (payload.email) {
    emailed = await sendResumeLink(
      payload.email,
      resumeUrl,
      payload.utility.systemName
    );
  }

  return NextResponse.json({
    ok: true,
    token: assessment.resumeToken,
    resumeUrl,
    emailed,
  });
}

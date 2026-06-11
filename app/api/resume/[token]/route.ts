import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const { token } = await params;
  const assessment = await db.assessment.findUnique({
    where: { resumeToken: token },
  });
  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    token: assessment.resumeToken,
    utility: {
      systemName: assessment.systemName,
      state: assessment.state,
      pwsId: assessment.pwsId ?? "",
      connections: assessment.connections ?? undefined,
    },
    answers: assessment.answers,
    email: assessment.email,
  });
}

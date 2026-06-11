import { NextRequest, NextResponse } from "next/server";
import { renderReportCardPdf } from "@/lib/pdf";
import type { Answers, ContactInfo, UtilityInfo } from "@/lib/types";

export async function POST(request: NextRequest) {
  let payload: {
    utility: UtilityInfo;
    contact: ContactInfo;
    answers: Answers;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!payload.utility?.systemName || !payload.contact?.email || !payload.answers) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    const pdf = await renderReportCardPdf(payload);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="utility-report-card-${new Date().getFullYear()}.pdf"`,
      },
    });
  } catch (e) {
    console.error("PDF render failed:", e);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}

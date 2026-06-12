"use client";

import { useMemo, useState } from "react";
import { actionPlanFor, dimensions, rubric } from "@/lib/content";
import { score } from "@/lib/scoring";
import type { Answers, ContactInfo, Grade, UtilityInfo } from "@/lib/types";

// Matches the PDF grade scale (lib/pdf.tsx): no amber/yellow band — deep red,
// tomato-family coral, steel blue for stable, clear greens.
const GRADE_COLORS: Record<Grade, string> = {
  F: "text-[#d92d20]",
  D: "text-[#e8654f]",
  C: "text-[#4f7396]",
  B: "text-[#1f9d66]",
  A: "text-[#0c7a43]",
};

function DownloadPdfButton({
  utility,
  contact,
  answers,
}: {
  utility: UtilityInfo;
  contact: ContactInfo;
  answers: Answers;
}) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utility, contact, answers }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `utility-report-card-${new Date().getFullYear()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.alert(
        "PDF generation failed — use Print to save a copy, and try again in a minute."
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={download}
      disabled={busy}
      className="rounded-md bg-clay px-4 py-2 text-sm font-semibold text-white shadow hover:bg-clay/90 disabled:opacity-40"
    >
      {busy ? "Generating…" : "Download PDF action plan"}
    </button>
  );
}

const GRADE_BG: Record<Grade, string> = {
  F: "bg-[#fdf0ef] border-[#f2c5c0]",
  D: "bg-[#fdf4f2] border-[#f4d0c7]",
  C: "bg-[#f2f6f9] border-[#ccdae5]",
  B: "bg-[#eff9f4] border-[#bfe5d3]",
  A: "bg-[#edf7f1] border-[#b7ddc6]",
};

export default function Results({
  utility,
  contact,
  answers,
}: {
  utility: UtilityInfo;
  contact: ContactInfo;
  answers: Answers;
}) {
  const result = useMemo(() => score(answers), [answers]);
  const year = new Date().getFullYear();
  const notSureIds = dimensions
    .filter((d) => answers[d.id]?.notSure)
    .map((d) => d.id);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-clay">
            {year} Report Card
          </p>
          <h2 className="mt-1 text-3xl font-bold text-navy">
            {utility.systemName}
          </h2>
          <p className="mt-1 text-sm text-foreground/60">
            {utility.state}
            {utility.connections ? ` · ${utility.connections} connections` : ""}
            {utility.pwsId ? ` · PWS ID ${utility.pwsId}` : ""} · Completed by{" "}
            {contact.name} ({contact.role})
          </p>
        </div>
        <div className="no-print flex flex-col gap-2">
          <DownloadPdfButton
            utility={utility}
            contact={contact}
            answers={answers}
          />
          <button
            onClick={() => window.print()}
            className="rounded-md border border-navy/30 px-4 py-2 text-sm font-medium text-navy hover:bg-navy/5"
          >
            Print
          </button>
        </div>
      </div>

      {/* Composite grades */}
      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        {result.legs.map((leg) => (
          <div
            key={leg.leg}
            className="rounded-lg border border-navy/20 bg-white p-4 text-center"
          >
            <p className="text-sm font-medium text-foreground/60">
              {rubric.legs[leg.leg]}
            </p>
            <p className={`text-5xl font-bold ${GRADE_COLORS[leg.letter]}`}>
              {leg.letter}
            </p>
            <p className="mt-1 text-xs text-foreground/50">
              avg {leg.average.toFixed(2)}
            </p>
          </div>
        ))}
        <div className="rounded-lg border-2 border-navy bg-white p-4 text-center">
          <p className="text-sm font-medium text-foreground/60">Overall</p>
          <p
            className={`text-5xl font-bold ${GRADE_COLORS[result.overallLetter]}`}
          >
            {result.overallLetter}
          </p>
          <p className="mt-1 text-xs text-foreground/50">
            avg {result.overallAverage.toFixed(2)}
          </p>
        </div>
      </div>

      {result.practicalGrade && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4">
          <p className="font-bold text-red-700">
            Practical Grade: {result.practicalGrade} (capped by diagnostic
            flags)
          </p>
          <p className="mt-1 text-sm text-red-800/80">
            Two or more red-line dimensions are graded F. A utility with
            multiple existential failure modes is not a{" "}
            {result.overallLetter} utility no matter what the other dimensions
            say — capacity is multiplicative, not additive.
          </p>
        </div>
      )}

      {/* Diagnostic flag panel */}
      <section className="mt-10">
        <h3 className="text-xl font-bold text-navy">Diagnostic flag panel</h3>
        <p className="mt-1 text-sm text-foreground/60">
          Red-line dimensions where an F signals existential risk regardless of
          your composite — what would kill this utility next.
        </p>
        {result.flags.length === 0 ? (
          <p className="mt-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            No red-line F&apos;s. Your system has no acute existential flags —
            the composite grades above describe your development ladder.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {result.flags.map((flag) => (
              <li
                key={flag.dimensionId}
                className="rounded-lg border border-red-300 bg-red-50 p-4"
              >
                <span className="font-bold text-red-700">
                  ⚑ {flag.dimensionId} — {flag.dimensionName}
                </span>
                <p className="mt-1 text-sm text-red-800/80">
                  {actionPlanFor(flag.dimensionId, "F")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* One rung up */}
      <section className="mt-10">
        <h3 className="text-xl font-bold text-navy">
          One rung up — your three highest-leverage moves this year
        </h3>
        <p className="mt-1 text-sm text-foreground/60">
          Ranked by gap to the next grade, weighted toward red-line dimensions.
          Use this to focus the next 12 months.
        </p>
        <div className="mt-3 space-y-3">
          {result.oneRungUp.map((item, i) => (
            <div
              key={item.dimensionId}
              className="rounded-lg border border-navy/20 bg-white p-4"
            >
              <p className="font-bold text-navy">
                {i + 1}. {item.dimensionId} — {item.dimensionName}{" "}
                <span className={GRADE_COLORS[item.current]}>
                  {item.current}
                </span>{" "}
                → <span className={GRADE_COLORS[item.target]}>{item.target}</span>
                {item.redLine && (
                  <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                    red-line
                  </span>
                )}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                {actionPlanFor(item.dimensionId, item.current)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Full grade table + action plan */}
      <section className="mt-10">
        <h3 className="text-xl font-bold text-navy">
          All 23 dimensions & your personalized action plan
        </h3>
        {(["T", "M", "F"] as const).map((leg) => (
          <div key={leg} className="mt-6">
            <h4 className="font-semibold uppercase tracking-wide text-clay">
              {rubric.legs[leg]} capacity
            </h4>
            <div className="mt-2 space-y-2">
              {dimensions
                .filter((d) => d.leg === leg)
                .map((d) => {
                  const grade = answers[d.id].grade;
                  const action = actionPlanFor(d.id, grade);
                  return (
                    <details
                      key={d.id}
                      className={`rounded-lg border p-4 ${GRADE_BG[grade]}`}
                    >
                      <summary className="cursor-pointer font-medium text-foreground">
                        <span
                          className={`mr-2 inline-block w-6 text-center text-lg font-bold ${GRADE_COLORS[grade]}`}
                        >
                          {grade}
                        </span>
                        {d.id} — {d.name}
                        {answers[d.id].notSure && (
                          <span className="ml-2 text-xs text-foreground/50">
                            (flagged: not confident — confirm with the team)
                          </span>
                        )}
                      </summary>
                      <div className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/80">
                        <p>
                          <strong>Where you are ({grade}):</strong>{" "}
                          {d.grades[grade]}
                        </p>
                        {action ? (
                          <p>
                            <strong>To reach the next rung:</strong> {action}
                          </p>
                        ) : (
                          <p>
                            <strong>You&apos;re at A — Thriving.</strong> Hold
                            the practice; this is the future story for peers.
                          </p>
                        )}
                      </div>
                    </details>
                  );
                })}
            </div>
          </div>
        ))}
      </section>

      {notSureIds.length > 0 && (
        <p className="mt-8 rounded-lg border border-navy/20 bg-white p-4 text-sm text-foreground/70">
          <strong>Flagged for follow-up:</strong> {notSureIds.join(", ")}. Solo
          completion biases results toward whichever TMF leg the assessor knows
          best — confirm these with the operator, clerk, or board chair before
          treating the composite as settled.
        </p>
      )}

      <div className="mt-10 border-t border-navy/15 pt-6 text-sm text-foreground/60">
        <p>
          This report card is a self-administered diagnostic, not an engineering
          deliverable or compliance determination. Re-assess annually — a
          report card that does not move year over year is not a Living
          diagnostic. Rubric v{rubric.version}; the grading ladder is stable
          across years so results stay comparable.
        </p>
      </div>
    </div>
  );
}

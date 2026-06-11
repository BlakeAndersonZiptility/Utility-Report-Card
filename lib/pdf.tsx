import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { actionPlanFor, dimensions, rubric } from "./content";
import { score } from "./scoring";
import type { Answers, ContactInfo, Grade, UtilityInfo } from "./types";

/**
 * Personalized action-plan PDF (MASTER_PLAN.md §1.7): composite grades,
 * diagnostic flag panel, one-rung-up moves, then the per-dimension action
 * plan pulled from the 92-cell library.
 */

const NAVY = "#1F4E79";
const CLAY = "#B25D2C";
const GRADE_COLORS: Record<Grade, string> = {
  F: "#b91c1c",
  D: "#ea580c",
  C: "#ca8a04",
  B: "#059669",
  A: "#15803d",
};

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, color: "#1f2933", lineHeight: 1.45 },
  kicker: {
    fontSize: 9,
    color: CLAY,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  h1: { fontSize: 22, color: NAVY, marginTop: 4, fontWeight: "bold" },
  meta: { fontSize: 9, color: "#6b7280", marginTop: 4 },
  h2: { fontSize: 14, color: NAVY, marginTop: 18, marginBottom: 6, fontWeight: "bold" },
  h3: { fontSize: 11, color: CLAY, marginTop: 12, marginBottom: 4, fontWeight: "bold" },
  gradeRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  gradeBox: {
    flex: 1,
    border: `1pt solid ${NAVY}`,
    borderRadius: 4,
    padding: 8,
    alignItems: "center",
  },
  gradeLetter: { fontSize: 26, fontWeight: "bold", lineHeight: 1.2, marginVertical: 2 },
  gradeLabel: { fontSize: 8, color: "#6b7280" },
  flag: {
    border: "1pt solid #fca5a5",
    backgroundColor: "#fef2f2",
    borderRadius: 4,
    padding: 8,
    marginBottom: 6,
  },
  card: {
    border: "1pt solid #d1d5db",
    borderRadius: 4,
    padding: 8,
    marginBottom: 6,
  },
  bold: { fontWeight: "bold" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#9ca3af",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text>
        Utility Health Report Card v{rubric.version} · Living Map Series
      </Text>
      <Text
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

export function ReportCardPdf({
  utility,
  contact,
  answers,
}: {
  utility: UtilityInfo;
  contact: ContactInfo;
  answers: Answers;
}) {
  const result = score(answers);
  const year = new Date().getFullYear();

  return (
    <Document
      title={`${utility.systemName} — Utility Health Report Card ${year}`}
    >
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.kicker}>
          {year} Report Card · Living Map Series
        </Text>
        <Text style={styles.h1}>{utility.systemName}</Text>
        <Text style={styles.meta}>
          {utility.state}
          {utility.connections ? ` · ${utility.connections} connections` : ""}
          {utility.pwsId ? ` · PWS ID ${utility.pwsId}` : ""} · Completed by{" "}
          {contact.name} ({contact.role}) ·{" "}
          {new Date().toISOString().slice(0, 10)}
        </Text>

        <View style={styles.gradeRow}>
          {result.legs.map((leg) => (
            <View key={leg.leg} style={styles.gradeBox}>
              <Text style={styles.gradeLabel}>{rubric.legs[leg.leg]}</Text>
              <Text
                style={[styles.gradeLetter, { color: GRADE_COLORS[leg.letter] }]}
              >
                {leg.letter}
              </Text>
              <Text style={styles.gradeLabel}>avg {leg.average.toFixed(2)}</Text>
            </View>
          ))}
          <View style={[styles.gradeBox, { borderWidth: 2 }]}>
            <Text style={styles.gradeLabel}>Overall</Text>
            <Text
              style={[
                styles.gradeLetter,
                { color: GRADE_COLORS[result.overallLetter] },
              ]}
            >
              {result.overallLetter}
            </Text>
            <Text style={styles.gradeLabel}>
              avg {result.overallAverage.toFixed(2)}
            </Text>
          </View>
        </View>

        {result.practicalGrade && (
          <View style={[styles.flag, { marginTop: 10 }]}>
            <Text style={[styles.bold, { color: "#b91c1c" }]}>
              Practical Grade: {result.practicalGrade} (capped by diagnostic
              flags)
            </Text>
            <Text>
              Two or more red-line dimensions are graded F. A utility with
              multiple existential failure modes is not a{" "}
              {result.overallLetter} utility no matter what the other
              dimensions say — capacity is multiplicative, not additive.
            </Text>
          </View>
        )}

        <Text style={styles.h2}>Diagnostic flag panel</Text>
        {result.flags.length === 0 ? (
          <Text>
            No red-line F&apos;s. The system has no acute existential flags;
            the composite grades describe the development ladder.
          </Text>
        ) : (
          result.flags.map((flag) => (
            <View key={flag.dimensionId} style={styles.flag}>
              <Text style={[styles.bold, { color: "#b91c1c" }]}>
                RED-LINE F · {flag.dimensionId} — {flag.dimensionName}
              </Text>
              <Text>{actionPlanFor(flag.dimensionId, "F")}</Text>
            </View>
          ))
        )}

        <Text style={styles.h2}>
          One rung up — the three highest-leverage moves this year
        </Text>
        {result.oneRungUp.map((item, i) => (
          <View key={item.dimensionId} style={styles.card}>
            <Text style={styles.bold}>
              {i + 1}. {item.dimensionId} — {item.dimensionName}: {item.current}{" "}
              to {item.target}
              {item.redLine ? "  (red-line)" : ""}
            </Text>
            <Text>{actionPlanFor(item.dimensionId, item.current)}</Text>
          </View>
        ))}
        <Footer />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.h2}>
          Personalized action plan — all 23 dimensions
        </Text>
        <Text style={{ color: "#6b7280" }}>
          For each dimension: where the system graded today, and the specific
          actions that move it one rung up the F-to-A ladder. Resources cite by
          category (state RWA, EFCN, RCAP/RCAC, AWWA M-series, EPA, GFOA).
        </Text>
        {(["T", "M", "F"] as const).map((leg) => (
          <View key={leg}>
            <Text style={styles.h3}>{rubric.legs[leg]} capacity</Text>
            {dimensions
              .filter((d) => d.leg === leg)
              .map((d) => {
                const grade = answers[d.id].grade;
                const action = actionPlanFor(d.id, grade);
                return (
                  <View key={d.id} style={styles.card} wrap={false}>
                    <Text style={styles.bold}>
                      <Text style={{ color: GRADE_COLORS[grade] }}>
                        {grade}
                      </Text>{" "}
                      · {d.id} — {d.name}
                      {answers[d.id].notSure
                        ? "  (flagged: confirm with the team)"
                        : ""}
                    </Text>
                    <Text style={{ marginTop: 2 }}>
                      <Text style={styles.bold}>Today ({grade}): </Text>
                      {d.grades[grade]}
                    </Text>
                    <Text style={{ marginTop: 2 }}>
                      {action ? (
                        <>
                          <Text style={styles.bold}>Next rung: </Text>
                          {action}
                        </>
                      ) : (
                        <Text style={styles.bold}>
                          At A — Thriving. Hold the practice.
                        </Text>
                      )}
                    </Text>
                  </View>
                );
              })}
          </View>
        ))}
        <Text style={{ marginTop: 14, color: "#6b7280" }}>
          This report card is a self-administered diagnostic, not an
          engineering deliverable or compliance determination. Re-assess
          annually; the grading ladder is stable across years so results stay
          comparable.
        </Text>
        <Footer />
      </Page>
    </Document>
  );
}

export async function renderReportCardPdf(input: {
  utility: UtilityInfo;
  contact: ContactInfo;
  answers: Answers;
}): Promise<Buffer> {
  return renderToBuffer(<ReportCardPdf {...input} />);
}

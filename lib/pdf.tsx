import {
  Document,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  actionPlanFor,
  dimensions,
  firstAction,
  linksFor,
  rubric,
  truncate,
} from "./content";
import { ZIPTILITY_LOGO } from "./logo";
import { score } from "./scoring";
import type {
  Answers,
  ContactInfo,
  Grade,
  Leg,
  ScoreResult,
  UtilityInfo,
} from "./types";

/**
 * Board-ready report card PDF (4 pages):
 *   1. Executive summary — printable one-pager a public works director can
 *      take to a board/council meeting to advocate for investment.
 *   2-4. One page per TMF leg with every dimension's grade, current state,
 *      next-rung action, and curated resource links.
 * Brand: Ziptility palette (midnight #0c1f30, tomato #ff442f, linen #f6eee6).
 */

const MIDNIGHT = "#0c1f30";
const TOMATO = "#ff442f";
const LINEN = "#f6eee6";
const SLATE = "#42515f";
const DIM = "#5f6469";

const GRADE_COLORS: Record<Grade, string> = {
  F: "#b91c1c",
  D: "#d97706",
  C: "#a16207",
  B: "#047857",
  A: "#15803d",
};

const LEG_INTROS: Record<Leg, string> = {
  T: "Can the system reliably produce and deliver safe water? Asset knowledge, operations discipline, water loss, compliance, emergency readiness, and quality practice.",
  M: "Can the organization steer itself? Governance, training, evidence-based decisions, succession, customer trust, regional cooperation, and the operator bench.",
  F: "Can the money sustain the mission? Reserves, rates, capital planning, recordkeeping, and affordability practice.",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 44,
    paddingHorizontal: 40,
    fontSize: 9,
    color: SLATE,
    lineHeight: 1.4,
    backgroundColor: "#ffffff",
  },
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 8,
    borderBottom: `2pt solid ${MIDNIGHT}`,
    marginBottom: 14,
  },
  logo: { width: 110 },
  docLabel: {
    fontSize: 8,
    color: TOMATO,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontWeight: "bold",
  },
  h1: { fontSize: 22, color: MIDNIGHT, fontWeight: "bold", lineHeight: 1.15 },
  meta: { fontSize: 8.5, color: DIM, marginTop: 3 },
  sectionTitle: {
    fontSize: 11,
    color: MIDNIGHT,
    fontWeight: "bold",
    marginTop: 14,
    marginBottom: 6,
  },
  tileRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  tile: {
    flex: 1,
    borderRadius: 6,
    padding: 10,
    alignItems: "center",
    backgroundColor: LINEN,
  },
  tileOverall: {
    flex: 1,
    borderRadius: 6,
    padding: 10,
    alignItems: "center",
    backgroundColor: MIDNIGHT,
  },
  tileLabel: {
    fontSize: 7.5,
    color: SLATE,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  tileLetter: { fontSize: 30, fontWeight: "bold", lineHeight: 1.15 },
  tileAvg: { fontSize: 7.5, color: DIM },
  capBanner: {
    marginTop: 10,
    borderRadius: 6,
    borderLeft: `4pt solid ${TOMATO}`,
    backgroundColor: "#fff1ef",
    padding: 9,
  },
  flagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  gradeSquare: {
    width: 16,
    height: 16,
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  gradeSquareText: { fontSize: 10, color: "#ffffff", fontWeight: "bold" },
  moveCard: {
    borderRadius: 6,
    border: "1pt solid #e2dcd4",
    padding: 8,
    marginBottom: 6,
  },
  boardBox: {
    marginTop: 14,
    borderRadius: 6,
    backgroundColor: LINEN,
    borderLeft: `4pt solid ${MIDNIGHT}`,
    padding: 10,
  },
  bold: { fontWeight: "bold", color: MIDNIGHT },
  link: { color: TOMATO, textDecoration: "none", fontWeight: "bold" },
  dimCard: {
    borderRadius: 5,
    border: "1pt solid #e2dcd4",
    paddingVertical: 4,
    paddingHorizontal: 7,
    marginBottom: 4,
  },
  dimTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 1,
  },
  redLineTag: {
    fontSize: 6.5,
    color: "#ffffff",
    backgroundColor: TOMATO,
    borderRadius: 2,
    paddingHorizontal: 3,
    paddingVertical: 1,
    fontWeight: "bold",
  },
  body: { fontSize: 8, lineHeight: 1.3, color: SLATE },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 7.5,
    color: DIM,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "1pt solid #e2dcd4",
    paddingTop: 6,
  },
});

function GradeSquare({ grade }: { grade: Grade }) {
  return (
    <View style={[styles.gradeSquare, { backgroundColor: GRADE_COLORS[grade] }]}>
      <Text style={styles.gradeSquareText}>{grade}</Text>
    </View>
  );
}

function HeaderBar({ label }: { label: string }) {
  return (
    <View style={styles.headerBar} fixed>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
      <Image src={ZIPTILITY_LOGO} style={styles.logo} />
      <Text style={styles.docLabel}>{label}</Text>
    </View>
  );
}

function Footer({ systemName }: { systemName: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>
        {systemName} · Utility Health Report Card v{rubric.version} · Take or
        re-take the assessment at{" "}
        <Link style={styles.link} src="https://www.ziptility.com">
          ziptility.com
        </Link>
      </Text>
      <Text
        render={({ pageNumber, totalPages }) => `${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}

function SummaryPage({
  utility,
  contact,
  result,
  year,
}: {
  utility: UtilityInfo;
  contact: ContactInfo;
  result: ScoreResult;
  year: number;
}) {
  return (
    <Page size="LETTER" style={styles.page}>
      <HeaderBar label={`Utility Health Report Card · ${year}`} />

      <Text style={styles.h1}>{utility.systemName}</Text>
      <Text style={styles.meta}>
        {utility.state}
        {utility.connections ? ` · ${utility.connections} connections` : ""}
        {utility.pwsId ? ` · PWS ID ${utility.pwsId}` : ""} · Self-assessed by{" "}
        {contact.name} ({contact.role}) · {new Date().toISOString().slice(0, 10)}{" "}
        · EPA TMF capacity framework, 23 dimensions, graded F (Survival) to A
        (Thriving)
      </Text>

      <View style={styles.tileRow}>
        {result.legs.map((leg) => (
          <View key={leg.leg} style={styles.tile}>
            <Text style={styles.tileLabel}>{rubric.legs[leg.leg]}</Text>
            <Text style={[styles.tileLetter, { color: GRADE_COLORS[leg.letter] }]}>
              {leg.letter}
            </Text>
            <Text style={styles.tileAvg}>avg {leg.average.toFixed(2)} / 4</Text>
          </View>
        ))}
        <View style={styles.tileOverall}>
          <Text style={[styles.tileLabel, { color: "#cdd5dd" }]}>Overall</Text>
          <Text style={[styles.tileLetter, { color: "#ffffff" }]}>
            {result.overallLetter}
          </Text>
          <Text style={[styles.tileAvg, { color: "#cdd5dd" }]}>
            avg {result.overallAverage.toFixed(2)} / 4
          </Text>
        </View>
      </View>

      {result.practicalGrade && (
        <View style={styles.capBanner}>
          <Text style={[styles.bold, { color: TOMATO, fontSize: 10 }]}>
            Practical Grade: {result.practicalGrade} — capped by diagnostic
            flags
          </Text>
          <Text style={styles.body}>
            {result.flags.length} red-line dimensions are graded F. Capacity is
            multiplicative: a system with multiple existential failure modes is
            not a {result.overallLetter} system, whatever the average says.
          </Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>
        Diagnostic flags — existential risks ({result.flags.length})
      </Text>
      {result.flags.length === 0 ? (
        <Text style={styles.body}>
          No red-line F&apos;s. No dimension is currently an existential risk;
          the grades above describe the development ladder.
        </Text>
      ) : (
        result.flags.map((flag) => (
          <View key={flag.dimensionId} style={styles.flagChip}>
            <GradeSquare grade="F" />
            <Text style={[styles.bold, { fontSize: 9.5 }]}>
              {flag.dimensionId} — {flag.dimensionName}
            </Text>
            <Text style={styles.redLineTag}>RED-LINE</Text>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>
        The three highest-leverage moves this year
      </Text>
      {result.oneRungUp.map((item, i) => {
        const cell = actionPlanFor(item.dimensionId, item.current);
        return (
          <View key={item.dimensionId} style={styles.moveCard}>
            <View style={styles.dimTitleRow}>
              <Text style={[styles.bold, { fontSize: 9.5 }]}>
                {i + 1}. {item.dimensionId} — {item.dimensionName}
              </Text>
              <GradeSquare grade={item.current} />
              <Text style={{ fontSize: 8, color: DIM }}>to</Text>
              <GradeSquare grade={item.target} />
              {item.redLine && <Text style={styles.redLineTag}>RED-LINE</Text>}
            </View>
            <Text style={styles.body}>
              {cell ? truncate(firstAction(cell), 170) : ""}
            </Text>
          </View>
        );
      })}

      <View style={styles.boardBox}>
        <Text style={[styles.bold, { fontSize: 10, marginBottom: 3 }]}>
          For the board / council
        </Text>
        <Text style={styles.body}>
          This is a self-administered diagnostic built on EPA&apos;s Technical /
          Managerial / Financial capacity framework (SDWA §1420) — the same
          lens used by state regulators and SRF lenders.{" "}
          {result.flags.length > 0
            ? `The ${result.flags.length} red-line flag${
                result.flags.length > 1 ? "s" : ""
              } above ${
                result.flags.length > 1 ? "are" : "is"
              } the failure mode${
                result.flags.length > 1 ? "s" : ""
              } that could end operational capacity — fund ${
                result.flags.length > 1 ? "these" : "this"
              } first. `
            : ""}
          The three moves above are this year&apos;s best return on investment:
          each lifts one dimension a single rung, the way capacity is actually
          built. Detailed pages 2–4 show every grade with specific actions and
          no-cost assistance resources. Re-assessing annually turns this
          snapshot into a living record the board can steer by.
        </Text>
      </View>

      <Footer systemName={utility.systemName} />
    </Page>
  );
}

function LegPage({
  leg,
  utility,
  answers,
  result,
  year,
}: {
  leg: Leg;
  utility: UtilityInfo;
  answers: Answers;
  result: ScoreResult;
  year: number;
}) {
  const legScore = result.legs.find((l) => l.leg === leg)!;
  const legDims = dimensions.filter((d) => d.leg === leg);

  return (
    <Page size="LETTER" style={styles.page}>
      <HeaderBar label={`${rubric.legs[leg]} capacity · ${year}`} />

      <View
        style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}
      >
        <Text style={[styles.h1, { fontSize: 16 }]}>
          {rubric.legs[leg]} capacity
        </Text>
        <GradeSquare grade={legScore.letter} />
        <Text style={{ fontSize: 8.5, color: DIM }}>
          leg average {legScore.average.toFixed(2)} / 4 · {legDims.length}{" "}
          dimensions
        </Text>
      </View>
      <Text style={[styles.body, { marginBottom: 8, color: DIM }]}>
        {LEG_INTROS[leg]}
      </Text>

      {legDims.map((d) => {
        const grade = answers[d.id].grade;
        const cell = actionPlanFor(d.id, grade);
        const links = linksFor(d.id, grade);
        return (
          <View key={d.id} style={styles.dimCard} wrap={false}>
            <View style={styles.dimTitleRow}>
              <GradeSquare grade={grade} />
              <Text style={[styles.bold, { fontSize: 9.5 }]}>
                {d.id} — {d.name}
              </Text>
              {d.redLine && <Text style={styles.redLineTag}>RED-LINE</Text>}
              {answers[d.id].notSure && (
                <Text style={{ fontSize: 7, color: DIM }}>
                  flagged: confirm with the team
                </Text>
              )}
            </View>
            <Text style={styles.body}>
              <Text style={styles.bold}>Today: </Text>
              {truncate(d.grades[grade], 112)}
            </Text>
            {cell ? (
              <Text style={styles.body}>
                <Text style={styles.bold}>Next rung: </Text>
                {truncate(firstAction(cell), 112)}
              </Text>
            ) : (
              <Text style={styles.body}>
                <Text style={styles.bold}>At A — Thriving. </Text>
                Hold the practice; this is the future story for peers.
              </Text>
            )}
            {links.length > 0 && (
              <Text style={{ fontSize: 7.5, marginTop: 1 }}>
                {"Free help: "}
                {links.map((l, i) => (
                  <Text key={l.url}>
                    {i > 0 ? "  ·  " : ""}
                    <Link style={styles.link} src={l.url}>
                      {l.label}
                    </Link>
                  </Text>
                ))}
              </Text>
            )}
          </View>
        );
      })}

      <Footer systemName={utility.systemName} />
    </Page>
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
      author="Ziptility"
    >
      <SummaryPage
        utility={utility}
        contact={contact}
        result={result}
        year={year}
      />
      {(["T", "M", "F"] as const).map((leg) => (
        <LegPage
          key={leg}
          leg={leg}
          utility={utility}
          answers={answers}
          result={result}
          year={year}
        />
      ))}
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

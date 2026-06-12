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
  GRADE_ORDER,
  actionPlanFor,
  dimensions,
  firstAction,
  linksFor,
  rubric,
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
 * The report card reads like a real report card: grades down a left rail,
 * narrative "teacher's comments" on the right. Asset-based tone per Bridges
 * Out of Poverty — celebrate what's working, make the next rung visible
 * (the rubric's own next-grade text), and give the full path with free help.
 * Nothing is truncated: seeing what "better" looks like is the entire point.
 *
 * Page 1 is a strict one-page executive summary a public works director can
 * hand to a board or council. Each TMF leg then starts on a fresh page and
 * flows as long as its content needs.
 */

const MIDNIGHT = "#0c1f30";
const TOMATO = "#ff442f";
const SLATE = "#42515f";
const DIM = "#5f6469";
const RULE = "#ddd5ca";

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

/**
 * Honest, additive framing per rung — the bridge between "today" and "next".
 * Several variants per grade, rotated deterministically by dimension, so a
 * report card with many same-grade rows doesn't drone the same sentence.
 */
const ENCOURAGERS: Record<Grade, string[]> = {
  F: [
    "This is the rung where the climb starts, and the first step is concrete and inexpensive.",
    "Naming this honestly is the hard part — the first step out is small and specific.",
    "Every system that thrives today once stood on this rung; the ladder out is below.",
  ],
  D: [
    "There is a real foundation here — the work now is writing it down and making it routine.",
    "What exists informally already works; the next rung is mostly documentation and rhythm.",
    "The knowledge is in the room — the climb is getting it on paper and on a schedule.",
  ],
  C: [
    "The fundamentals are in place; the next rung is where good habits become systems.",
    "Stable is an achievement at this size — the next rung turns stability into momentum.",
    "This rung holds. The climb now is consistency and follow-through.",
  ],
  B: [
    "This is strong practice — one deliberate step from the top of the ladder.",
    "Most systems never reach this rung; what remains is refinement, not rescue.",
    "Strong, documented practice — the final rung is integration and foresight.",
  ],
  A: [
    "Thriving. This is the future story other systems climb toward.",
    "Thriving — worth celebrating, and worth documenting so it survives any one person.",
    "Thriving. Hold the practice, and mentor a neighboring system — this is what the field needs replicated.",
  ],
};

function encouragerFor(dimensionId: string, grade: Grade): string {
  const index = dimensions.findIndex((d) => d.id === dimensionId);
  const variants = ENCOURAGERS[grade];
  return variants[index % variants.length];
}

function nextGrade(grade: Grade): Grade | null {
  const i = GRADE_ORDER.indexOf(grade);
  return i < GRADE_ORDER.length - 1 ? GRADE_ORDER[i + 1] : null;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 46,
    paddingHorizontal: 44,
    fontSize: 8.5,
    color: SLATE,
    lineHeight: 1.45,
    backgroundColor: "#ffffff",
  },
  masthead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 7,
    borderBottom: `2pt solid ${MIDNIGHT}`,
    marginBottom: 16,
  },
  logo: { width: 100 },
  docLabel: {
    fontSize: 7.5,
    color: DIM,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  h1: { fontSize: 21, color: MIDNIGHT, fontWeight: "bold", lineHeight: 1.15 },
  meta: { fontSize: 8, color: DIM, marginTop: 3 },
  twoCol: { flexDirection: "row", gap: 18, marginTop: 16 },
  rail: { width: 124 },
  railGrade: {
    paddingVertical: 7,
    borderBottom: `1pt solid ${RULE}`,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  railLetter: { fontSize: 27, fontWeight: "bold", width: 30, lineHeight: 1.1 },
  railLabel: {
    fontSize: 7,
    color: DIM,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  railAvg: { fontSize: 7, color: DIM },
  overallBlock: {
    marginTop: 10,
    backgroundColor: MIDNIGHT,
    borderRadius: 4,
    padding: 10,
    alignItems: "center",
  },
  narrative: { flex: 1 },
  sideHead: {
    fontSize: 8,
    color: MIDNIGHT,
    fontWeight: "bold",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 3,
    marginTop: 11,
  },
  body: { fontSize: 8.5, lineHeight: 1.45, color: SLATE },
  bold: { fontWeight: "bold", color: MIDNIGHT },
  link: { color: TOMATO, textDecoration: "none", fontWeight: "bold" },
  redLineTag: {
    fontSize: 6.5,
    color: TOMATO,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  dimRow: {
    flexDirection: "row",
    gap: 14,
    paddingVertical: 9,
    borderBottom: `1pt solid ${RULE}`,
  },
  dimRail: { width: 44, alignItems: "center", paddingTop: 1 },
  dimLetter: { fontSize: 24, fontWeight: "bold", lineHeight: 1.1 },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 44,
    right: 44,
    fontSize: 7.5,
    color: DIM,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: `1pt solid ${RULE}`,
    paddingTop: 6,
  },
});

function Masthead({ label }: { label: string }) {
  return (
    <View style={styles.masthead} fixed>
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
        {systemName} · Utility Health Report Card v{rubric.version} ·{" "}
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

type ResultWithAnswers = ScoreResult & { answersByDim: Record<string, Grade> };

function CoverPage({
  utility,
  contact,
  result,
  year,
}: {
  utility: UtilityInfo;
  contact: ContactInfo;
  result: ResultWithAnswers;
  year: number;
}) {
  const strengths = dimensions
    .filter((d) => {
      const g = result.answersByDim[d.id];
      return g === "A" || g === "B";
    })
    .slice(0, 5);

  return (
    <Page size="LETTER" style={styles.page}>
      <Masthead label={`Utility Health Report Card · ${year}`} />

      <Text style={styles.h1}>{utility.systemName}</Text>
      <Text style={styles.meta}>
        {utility.state}
        {utility.connections ? ` · ${utility.connections} connections` : ""}
        {utility.pwsId ? ` · PWS ID ${utility.pwsId}` : ""} · Self-assessed by{" "}
        {contact.name} ({contact.role}) · {new Date().toISOString().slice(0, 10)}
      </Text>
      <Text style={[styles.meta, { marginTop: 2 }]}>
        23 dimensions of Technical, Managerial, and Financial capacity — EPA&apos;s
        TMF framework (SDWA §1420) — each graded F (Survival) to A (Thriving).
      </Text>

      <View style={styles.twoCol}>
        {/* Left rail: grades stacked vertically */}
        <View style={styles.rail}>
          {result.legs.map((leg) => (
            <View key={leg.leg} style={styles.railGrade}>
              <Text
                style={[styles.railLetter, { color: GRADE_COLORS[leg.letter] }]}
              >
                {leg.letter}
              </Text>
              <View>
                <Text style={styles.railLabel}>{rubric.legs[leg.leg]}</Text>
                <Text style={styles.railAvg}>avg {leg.average.toFixed(2)} / 4</Text>
              </View>
            </View>
          ))}
          <View style={styles.overallBlock}>
            <Text style={[styles.railLabel, { color: "#cdd5dd" }]}>Overall</Text>
            <Text style={[styles.railLetter, { color: "#ffffff", width: "auto" }]}>
              {result.overallLetter}
            </Text>
            <Text style={[styles.railAvg, { color: "#cdd5dd" }]}>
              avg {result.overallAverage.toFixed(2)} / 4
            </Text>
            {result.practicalGrade && (
              <Text
                style={{
                  fontSize: 7,
                  color: "#ffb4ab",
                  marginTop: 4,
                  textAlign: "center",
                }}
              >
                Practical grade {result.practicalGrade} until the{" "}
                {result.flags.length} red-line item
                {result.flags.length > 1 ? "s are" : " is"} stabilized
              </Text>
            )}
          </View>
        </View>

        {/* Right: the narrative */}
        <View style={styles.narrative}>
          <Text style={styles.sideHead}>What&apos;s working</Text>
          <Text style={styles.body}>
            {strengths.length > 0 ? (
              <>
                {strengths.map((d, i) => (
                  <Text key={d.id}>
                    {i > 0 ? " · " : ""}
                    <Text style={styles.bold}>{d.name}</Text> (
                    {result.answersByDim[d.id]})
                  </Text>
                ))}
                {". "}
                These are earned positions — most systems this size never get
                them on paper. They are the foundation the next steps build on.
              </>
            ) : (
              <>
                Completing this assessment is itself the first managerial win:
                most systems never put their position on paper. Every rung on
                this ladder has been climbed by systems with fewer resources
                than yours — and the next step in each dimension is listed
                inside.
              </>
            )}
          </Text>

          {result.flags.length > 0 && (
            <>
              <Text style={styles.sideHead}>Stabilize first</Text>
              <Text style={styles.body}>
                {result.flags.length === 1 ? (
                  <Text>
                    One dimension sits at F on the red-line set — the rungs
                    where risk is existential regardless of the composite:{" "}
                  </Text>
                ) : (
                  <Text>
                    {result.flags.length} dimensions sit at F on the red-line
                    set — the rungs where risk is existential regardless of the
                    composite:{" "}
                  </Text>
                )}
                {result.flags.map((flag, i) => (
                  <Text key={flag.dimensionId}>
                    {i > 0 ? " " : ""}
                    <Text style={[styles.bold, { color: TOMATO }]}>
                      {flag.dimensionName}
                    </Text>
                    {" — first step: "}
                    {firstAction(
                      actionPlanFor(flag.dimensionId, "F") ?? ""
                    ).replace(/\.$/, "")}
                    {"."}
                  </Text>
                ))}{" "}
                Each fix starts small; the inside pages give the full path.
              </Text>
            </>
          )}

          <Text style={styles.sideHead}>
            This year&apos;s three highest-leverage moves
          </Text>
          {result.oneRungUp.map((item, i) => {
            const cell = actionPlanFor(item.dimensionId, item.current);
            return (
              <Text key={item.dimensionId} style={[styles.body, { marginBottom: 4 }]}>
                <Text style={styles.bold}>
                  {i + 1}. {item.dimensionName} ({item.current} to {item.target}
                  ).{" "}
                </Text>
                {cell ? firstAction(cell) : ""}
              </Text>
            );
          })}

          <Text style={styles.sideHead}>For the board / council</Text>
          <Text style={styles.body}>
            This is the same Technical / Managerial / Financial lens state
            regulators and SRF lenders use. Capacity is built one rung at a
            time, and it is multiplicative — a weak leg drags the others down,
            which is why the moves above are the year&apos;s best return on
            investment. The pages inside show, for every dimension, exactly
            what the next rung looks like and the no-cost help available to
            reach it. Re-assess annually: the trend line, not the snapshot, is
            the story.
          </Text>
        </View>
      </View>

      <Footer systemName={utility.systemName} />
    </Page>
  );
}

function DimensionRow({
  dimensionId,
  grade,
  notSure,
}: {
  dimensionId: string;
  grade: Grade;
  notSure?: boolean;
}) {
  const d = dimensions.find((dim) => dim.id === dimensionId)!;
  const next = nextGrade(grade);
  const cell = actionPlanFor(d.id, grade);
  const links = linksFor(d.id, grade);

  return (
    <View style={styles.dimRow} wrap={false}>
      <View style={styles.dimRail}>
        <Text style={[styles.dimLetter, { color: GRADE_COLORS[grade] }]}>
          {grade}
        </Text>
        <Text style={[styles.railAvg, { textAlign: "center" }]}>
          {rubric.gradeLadder[grade]}
        </Text>
        {d.redLine && <Text style={styles.redLineTag}>RED-LINE</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.body, { marginBottom: 2 }]}>
          <Text style={[styles.bold, { fontSize: 9.5 }]}>{d.name}.</Text>{" "}
          {d.grades[grade]}
          {notSure
            ? " (Marked “not sure” — worth confirming together with the operator, clerk, and board chair.)"
            : ""}{" "}
          {encouragerFor(d.id, grade)}
        </Text>
        {next && (
          <Text style={[styles.body, { marginBottom: 2 }]}>
            <Text style={styles.bold}>
              What {next} — {rubric.gradeLadder[next]} — looks like:{" "}
            </Text>
            {d.grades[next]}
          </Text>
        )}
        {cell && (
          <Text style={[styles.body, { marginBottom: 2 }]}>
            <Text style={styles.bold}>How to get there: </Text>
            {cell.replace(/\s*Resources:.*$/, "")}
          </Text>
        )}
        {links.length > 0 && (
          <Text style={{ fontSize: 7.5 }}>
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
    </View>
  );
}

function LegSection({
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
  const strengths = legDims.filter((d) =>
    ["A", "B"].includes(answers[d.id].grade)
  );

  return (
    <Page size="LETTER" style={styles.page}>
      <Masthead label={`${rubric.legs[leg]} capacity · ${year}`} />

      <View style={{ flexDirection: "row", gap: 14 }}>
        <View style={styles.dimRail}>
          <Text style={[styles.dimLetter, { color: GRADE_COLORS[legScore.letter] }]}>
            {legScore.letter}
          </Text>
          <Text style={[styles.railAvg, { textAlign: "center" }]}>
            avg {legScore.average.toFixed(2)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.h1, { fontSize: 15 }]}>
            {rubric.legs[leg]} capacity
          </Text>
          <Text style={[styles.body, { color: DIM }]}>{LEG_INTROS[leg]}</Text>
          <Text style={[styles.body, { marginTop: 3 }]}>
            <Text style={styles.bold}>Strengths to build on: </Text>
            {strengths.length > 0
              ? strengths
                  .map((d) => `${d.name} (${answers[d.id].grade})`)
                  .join(" · ")
              : "every dimension in this leg has a concrete, mostly-free next step below — and a year from now this line will read differently."}
          </Text>
        </View>
      </View>
      <View
        style={{ borderBottom: `2pt solid ${MIDNIGHT}`, marginTop: 8 }}
      />

      {legDims.map((d) => (
        <DimensionRow
          key={d.id}
          dimensionId={d.id}
          grade={answers[d.id].grade}
          notSure={answers[d.id].notSure}
        />
      ))}

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
  const base = score(answers);
  const answersByDim = Object.fromEntries(
    Object.entries(answers).map(([id, a]) => [id, a.grade])
  );
  const result: ResultWithAnswers = { ...base, answersByDim };
  const year = new Date().getFullYear();

  return (
    <Document
      title={`${utility.systemName} — Utility Health Report Card ${year}`}
      author="Ziptility"
    >
      <CoverPage
        utility={utility}
        contact={contact}
        result={result}
        year={year}
      />
      {(["T", "M", "F"] as const).map((leg) => (
        <LegSection
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

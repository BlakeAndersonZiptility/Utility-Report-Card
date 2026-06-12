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
const LINEN = "#f6eee6";

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

/** Short ladder words that fit the rail without ragged wrapping. */
const LADDER_SHORT: Record<Grade, string> = {
  F: "Survival",
  D: "Day-to-Day",
  C: "Fairly Stable",
  B: "Very Stable",
  A: "Thriving",
};

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
    paddingBottom: 6,
    borderBottom: `2pt solid ${MIDNIGHT}`,
    marginBottom: 12,
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
  heroBand: {
    backgroundColor: MIDNIGHT,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  heroKicker: {
    fontSize: 9,
    color: TOMATO,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "bold",
    marginBottom: 4,
  },
  heroName: {
    fontSize: 26,
    color: "#ffffff",
    fontWeight: "bold",
    lineHeight: 1.1,
  },
  heroMeta: { fontSize: 7.5, color: "#aebac6", marginTop: 5, lineHeight: 1.4 },
  tile: {
    backgroundColor: LINEN,
    borderRadius: 6,
    alignItems: "center",
    paddingVertical: 9,
    marginBottom: 8,
  },
  tileLabel: {
    fontSize: 7,
    color: SLATE,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 1,
  },
  tileLetter: { fontSize: 30, fontWeight: "bold", lineHeight: 1.1 },
  tileAvg: { fontSize: 7, color: DIM, marginTop: 1 },
  panel: {
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  panelTomato: { backgroundColor: "#fff3f0", borderLeft: `3pt solid ${TOMATO}` },
  panelLinen: { backgroundColor: LINEN, borderLeft: `3pt solid ${MIDNIGHT}` },
  numberBadge: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: MIDNIGHT,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
    marginTop: 1,
  },
  numberBadgeText: { fontSize: 8, color: "#ffffff", fontWeight: "bold" },
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
    marginTop: 8,
  },
  body: { fontSize: 8.5, lineHeight: 1.4, color: SLATE },
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
    paddingVertical: 8,
    borderBottom: `1pt solid ${RULE}`,
  },
  dimRail: { width: 46, alignItems: "center", paddingTop: 1 },
  dimLetter: { fontSize: 24, fontWeight: "bold", lineHeight: 1.1 },
  ladderScale: { marginTop: 3, alignItems: "center" },
  ladderStep: { fontSize: 6, lineHeight: 1.35, color: "#c9c1b4" },
  ladderStepCurrent: { fontSize: 6, lineHeight: 1.35, fontWeight: "bold" },
  legendBand: {
    position: "absolute",
    left: 44,
    right: 44,
    bottom: 36,
    backgroundColor: LINEN,
    borderRadius: 5,
    padding: 8,
  },
  signatureRow: {
    flexDirection: "row",
    gap: 24,
    marginTop: 12,
  },
  signatureCell: { flex: 1 },
  signatureLine: {
    borderBottom: `0.75pt solid ${SLATE}`,
    height: 14,
    marginBottom: 3,
  },
  signatureLabel: { fontSize: 7, color: DIM },
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

/**
 * The ladder, made visible: five rungs top-to-bottom (A down to F) with the
 * current rung highlighted — "you are here" on the climb.
 */
function LadderScale({ current }: { current: Grade }) {
  return (
    <View style={styles.ladderScale}>
      {[...GRADE_ORDER].reverse().map((g) => (
        <Text
          key={g}
          style={
            g === current
              ? [styles.ladderStepCurrent, { color: GRADE_COLORS[g] }]
              : styles.ladderStep
          }
        >
          {g === current ? `• ${g}` : g}
        </Text>
      ))}
    </View>
  );
}

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
    // Extra bottom padding reserves space for the absolutely-positioned
    // legend band so flowing content never collides or overflows the page.
    <Page size="LETTER" style={[styles.page, { paddingBottom: 84 }]}>
      <Masthead label="Living Map Series" />

      <View style={styles.heroBand}>
        <Text style={styles.heroKicker}>
          {year} Utility Health Report Card · Prepared for
        </Text>
        <Text style={styles.heroName}>{utility.systemName}</Text>
        <Text style={styles.heroMeta}>
          {utility.state}
          {utility.connections ? ` · ${utility.connections} connections` : ""}
          {utility.pwsId ? ` · PWS ID ${utility.pwsId}` : ""} · Self-assessed by{" "}
          {contact.name} ({contact.role}) · {new Date().toISOString().slice(0, 10)}
          {"\n"}23 dimensions of Technical, Managerial, and Financial capacity —
          EPA&apos;s TMF framework (SDWA §1420) — each graded F (Survival) to A
          (Thriving).
        </Text>
      </View>

      <View style={[styles.twoCol, { marginTop: 0 }]}>
        {/* Left rail: grades stacked vertically */}
        <View style={styles.rail}>
          {result.legs.map((leg) => (
            <View
              key={leg.leg}
              style={[
                styles.tile,
                { borderLeft: `3pt solid ${GRADE_COLORS[leg.letter]}` },
              ]}
            >
              <Text style={styles.tileLabel}>{rubric.legs[leg.leg]}</Text>
              <Text
                style={[styles.tileLetter, { color: GRADE_COLORS[leg.letter] }]}
              >
                {leg.letter}
              </Text>
              <Text style={styles.tileAvg}>avg {leg.average.toFixed(2)} / 4</Text>
            </View>
          ))}
          <View
            style={[
              styles.tile,
              { backgroundColor: MIDNIGHT, borderLeft: `3pt solid ${TOMATO}` },
            ]}
          >
            <Text style={[styles.tileLabel, { color: "#cdd5dd" }]}>Overall</Text>
            <Text style={[styles.tileLetter, { color: "#ffffff" }]}>
              {result.overallLetter}
            </Text>
            <Text style={[styles.tileAvg, { color: "#cdd5dd" }]}>
              avg {result.overallAverage.toFixed(2)} / 4
            </Text>
            {result.practicalGrade && (
              <Text
                style={{
                  fontSize: 7,
                  color: "#ffb4ab",
                  marginTop: 4,
                  textAlign: "center",
                  paddingHorizontal: 6,
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
          <Text style={[styles.sideHead, { marginTop: 0 }]}>
            What&apos;s working
          </Text>
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
            <View style={[styles.panel, styles.panelTomato]}>
              <Text style={[styles.sideHead, { marginTop: 0 }]}>
                Stabilize first
              </Text>
              <Text style={[styles.body, { marginBottom: 3 }]}>
                {result.flags.length === 1 ? "One dimension sits" : `${result.flags.length} dimensions sit`}{" "}
                at F on the red-line set — the rungs where risk is existential
                regardless of the composite. Each fix starts small:
              </Text>
              {result.flags.map((flag) => (
                <View
                  key={flag.dimensionId}
                  style={{ flexDirection: "row", marginBottom: 2.5 }}
                >
                  <Text style={[styles.bold, { color: TOMATO, width: 10 }]}>
                    •
                  </Text>
                  <Text style={[styles.body, { flex: 1 }]}>
                    <Text style={[styles.bold, { color: TOMATO }]}>
                      {flag.dimensionName}
                    </Text>
                    {" — first step: "}
                    {firstAction(actionPlanFor(flag.dimensionId, "F") ?? "")}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.sideHead}>
            This year&apos;s three highest-leverage moves
          </Text>
          {result.oneRungUp.map((item, i) => {
            const cell = actionPlanFor(item.dimensionId, item.current);
            return (
              <View
                key={item.dimensionId}
                style={{ flexDirection: "row", marginBottom: 4.5 }}
              >
                <View style={styles.numberBadge}>
                  <Text style={styles.numberBadgeText}>{i + 1}</Text>
                </View>
                <Text style={[styles.body, { flex: 1 }]}>
                  <Text style={styles.bold}>{item.dimensionName} </Text>
                  <Text
                    style={[styles.bold, { color: GRADE_COLORS[item.current] }]}
                  >
                    {item.current}
                  </Text>
                  <Text style={{ color: DIM }}>{" to "}</Text>
                  <Text
                    style={[styles.bold, { color: GRADE_COLORS[item.target] }]}
                  >
                    {item.target}
                  </Text>
                  {". "}
                  {cell ? firstAction(cell) : ""}
                </Text>
              </View>
            );
          })}

          <View style={[styles.panel, styles.panelLinen]}>
            <Text style={[styles.sideHead, { marginTop: 0 }]}>
              For the board / council
            </Text>
            <Text style={styles.body}>
              This is the same Technical / Managerial / Financial lens state
              regulators and SRF lenders use. Capacity is built one rung at a
              time, and it is multiplicative — a weak leg drags the others
              down, which is why the moves above are the year&apos;s best
              return on investment. The pages inside show, for every dimension,
              exactly what the next rung looks like and the no-cost help
              available to reach it. Re-assess annually: the trend line, not
              the snapshot, is the story.
            </Text>
          </View>

          <View style={styles.signatureRow}>
            <View style={styles.signatureCell}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>
                Presented to the board / council on
              </Text>
            </View>
            <View style={styles.signatureCell}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Presented by</Text>
            </View>
            <View style={styles.signatureCell}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Next re-assessment due</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.legendBand}>
        <Text style={{ fontSize: 7.5, color: SLATE, lineHeight: 1.5 }}>
          <Text style={[styles.bold, { fontSize: 7.5 }]}>
            How to read this card:{" "}
          </Text>
          {GRADE_ORDER.map((g, i) => (
            <Text key={g}>
              {i > 0 ? "   " : ""}
              <Text style={[styles.bold, { color: GRADE_COLORS[g] }]}>{g}</Text>
              {` ${rubric.gradeLadder[g]}`}
            </Text>
          ))}
          {"   ·   Grades average F=0 to A=4 within each leg.   ·   "}
          <Text style={[styles.bold, { color: TOMATO, fontSize: 7.5 }]}>
            RED-LINE
          </Text>
          {
            " marks the dimensions where an F is an existential risk on its own — two or more cap the practical grade at D."
          }
        </Text>
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
    <View
      style={[
        styles.dimRow,
        { borderLeft: `2.5pt solid ${GRADE_COLORS[grade]}`, paddingLeft: 9 },
      ]}
      wrap={false}
    >
      <View style={styles.dimRail}>
        <Text style={[styles.dimLetter, { color: GRADE_COLORS[grade] }]}>
          {grade}
        </Text>
        <Text style={[styles.railAvg, { textAlign: "center" }]}>
          {LADDER_SHORT[grade]}
        </Text>
        <LadderScale current={grade} />
        {d.redLine && (
          <Text style={[styles.redLineTag, { marginTop: 3 }]}>RED-LINE</Text>
        )}
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
              The next rung, {next} · {rubric.gradeLadder[next]}:{" "}
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

      <View
        style={{
          flexDirection: "row",
          gap: 14,
          backgroundColor: LINEN,
          borderRadius: 5,
          padding: 9,
          alignItems: "center",
        }}
      >
        <View style={[styles.dimRail, { paddingTop: 0 }]}>
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

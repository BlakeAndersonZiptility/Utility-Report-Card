import { config } from "./config";
import { GRADE_ORDER, dimensions } from "./content";
import type { Answers, Grade, Leg, LegScore, OneRungUpItem, RedLineFlag, ScoreResult } from "./types";

export function gradeValue(grade: Grade): number {
  return GRADE_ORDER.indexOf(grade);
}

/** Nearest letter; .5 rounds up (toward the better grade), per the workbook ladder. */
export function valueToLetter(value: number): Grade {
  const index = Math.min(4, Math.max(0, Math.round(value)));
  return GRADE_ORDER[index];
}

const LEGS: Leg[] = ["T", "M", "F"];

/**
 * Two-track scoring per the v2.1 Methodology sheet:
 * - Descriptive composite: F=0..A=4; per-leg average rounded to the nearest
 *   letter; Overall is the mean of the three (unrounded) leg averages.
 * - Diagnostic flag panel: any red-line dimension graded F surfaces a flag
 *   regardless of composite.
 * - Practical-grade cap: 2+ red-line F's annotate the Overall as
 *   "Practical Grade: D" when the descriptive composite is higher.
 * - One rung up: the three dimensions where moving up one letter is
 *   highest-leverage (gap to the next grade × red-line weighting).
 */
export function score(answers: Answers): ScoreResult {
  const missing = dimensions.filter((d) => !answers[d.id]);
  if (missing.length > 0) {
    throw new Error(`Missing grades for: ${missing.map((d) => d.id).join(", ")}`);
  }

  const legs: LegScore[] = LEGS.map((leg) => {
    const legDims = dimensions.filter((d) => d.leg === leg);
    const average =
      legDims.reduce((sum, d) => sum + gradeValue(answers[d.id].grade), 0) / legDims.length;
    return { leg, average, letter: valueToLetter(average) };
  });

  const overallAverage = legs.reduce((sum, l) => sum + l.average, 0) / legs.length;
  const overallLetter = valueToLetter(overallAverage);

  const flags: RedLineFlag[] = dimensions
    .filter((d) => d.redLine && answers[d.id].grade === "F")
    .map((d) => ({ dimensionId: d.id, dimensionName: d.name }));

  const practicalGrade =
    flags.length >= config.practicalGradeCapThreshold &&
    gradeValue(overallLetter) > gradeValue(config.practicalGradeCap)
      ? config.practicalGradeCap
      : null;

  const oneRungUp: OneRungUpItem[] = dimensions
    .filter((d) => answers[d.id].grade !== "A")
    .map((d) => {
      const current = answers[d.id].grade;
      const gapToTop = 4 - gradeValue(current);
      const weight = gapToTop * (d.redLine ? config.oneRungUpRedLineWeight : 1);
      return {
        dimensionId: d.id,
        dimensionName: d.name,
        current,
        target: GRADE_ORDER[gradeValue(current) + 1],
        redLine: d.redLine,
        weight,
      };
    })
    .sort((a, b) => b.weight - a.weight || a.dimensionId.localeCompare(b.dimensionId))
    .slice(0, config.oneRungUpCount);

  return { legs, overallAverage, overallLetter, flags, practicalGrade, oneRungUp };
}

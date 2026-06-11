/**
 * Calibration knobs for the Report Card. Changes here are calibration
 * decisions and must be versioned with a written change log (see the
 * Methodology sheet of the v2.1 workbook: comparability across years and
 * across utilities depends on rubric stability).
 */
export const config = {
  /**
   * Red-line dimension set — an F on any of these surfaces a diagnostic
   * flag regardless of composite. The v2.1 workbook marks 7 (including M3);
   * the white paper recommends 6 (without M3). OPEN DECISION A1 (Blake):
   * if the set changes, update content/rubric.json `redLine` flags — this
   * list is derived from the rubric at runtime and exists only for tests
   * and documentation.
   */
  expectedRedLineSet: ["T5", "T7", "T8", "M3", "M8", "F1", "F2"],

  /** 2+ red-line F's cap the practical grade at D (workbook Methodology). */
  practicalGradeCapThreshold: 2,
  practicalGradeCap: "D" as const,

  /** One-rung-up ranking: gap-to-A multiplied by this weight for red-line dimensions. */
  oneRungUpRedLineWeight: 1.5,
  oneRungUpCount: 3,
} as const;

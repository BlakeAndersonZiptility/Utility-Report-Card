import { describe, expect, it } from "vitest";
import { config } from "./config";
import { dimensions, rubric } from "./content";
import { actionPlanLibrary } from "./content";
import { score, valueToLetter } from "./scoring";
import type { Answers, Grade } from "./types";

function answersWith(base: Grade, overrides: Record<string, Grade> = {}): Answers {
  const answers: Answers = {};
  for (const d of dimensions) {
    answers[d.id] = { grade: overrides[d.id] ?? base };
  }
  return answers;
}

describe("content integrity", () => {
  it("has 23 dimensions: 9 T, 8 M, 6 F", () => {
    expect(dimensions).toHaveLength(23);
    expect(dimensions.filter((d) => d.leg === "T")).toHaveLength(9);
    expect(dimensions.filter((d) => d.leg === "M")).toHaveLength(8);
    expect(dimensions.filter((d) => d.leg === "F")).toHaveLength(6);
  });

  it("red-line set matches the v2.1 workbook markers", () => {
    const redLines = dimensions.filter((d) => d.redLine).map((d) => d.id);
    expect(redLines.sort()).toEqual([...config.expectedRedLineSet].sort());
  });

  it("every dimension has all five grade cells and a 4-cell action plan", () => {
    for (const d of dimensions) {
      for (const g of ["F", "D", "C", "B", "A"] as const) {
        expect(d.grades[g], `${d.id} grade ${g}`).toBeTruthy();
      }
      const cells = actionPlanLibrary.library[d.id];
      expect(cells, `${d.id} action plan`).toBeTruthy();
      for (const t of ["FtoD", "DtoC", "CtoB", "BtoA"] as const) {
        expect(cells[t], `${d.id} ${t}`).toBeTruthy();
      }
    }
    expect(Object.keys(actionPlanLibrary.library)).toHaveLength(23);
  });

  it("rubric is version 2.1", () => {
    expect(rubric.version).toBe("2.1");
  });
});

describe("descriptive composite", () => {
  it("scores a uniform-B utility as B across the board", () => {
    const result = score(answersWith("B"));
    expect(result.legs.map((l) => l.letter)).toEqual(["B", "B", "B"]);
    expect(result.overallLetter).toBe("B");
    expect(result.overallAverage).toBeCloseTo(3);
    expect(result.flags).toHaveLength(0);
    expect(result.practicalGrade).toBeNull();
  });

  it("rounds leg averages to the nearest letter (.5 rounds up)", () => {
    expect(valueToLetter(1.49)).toBe("D");
    expect(valueToLetter(1.5)).toBe("C");
    expect(valueToLetter(3.51)).toBe("A");
    expect(valueToLetter(0)).toBe("F");
  });

  it("computes the overall as the mean of unrounded leg averages", () => {
    // All T at A (4), all M at F (0), all F at C (2) → overall = 2 → C
    const overrides: Record<string, Grade> = {};
    for (const d of dimensions) {
      overrides[d.id] = d.leg === "T" ? "A" : d.leg === "M" ? "F" : "C";
    }
    const result = score(answersWith("C", overrides));
    expect(result.overallAverage).toBeCloseTo(2);
    expect(result.overallLetter).toBe("C");
  });

  it("throws when grades are missing", () => {
    expect(() => score({})).toThrow(/Missing grades/);
  });
});

describe("diagnostic flag panel and practical-grade cap", () => {
  it("flags a red-line F even on a strong composite (the dishonest-B case)", () => {
    // White paper §7: a utility can average to a B and still be one repair
    // away from insolvency.
    const result = score(answersWith("B", { F1: "F" }));
    expect(result.flags.map((f) => f.dimensionId)).toEqual(["F1"]);
    expect(result.overallLetter).toBe("B");
    expect(result.practicalGrade).toBeNull(); // single flag does not cap
  });

  it("does not flag an F on a non-red-line dimension", () => {
    const result = score(answersWith("B", { T1: "F" }));
    expect(result.flags).toHaveLength(0);
  });

  it("caps the practical grade at D with 2+ red-line F's", () => {
    const result = score(answersWith("B", { F1: "F", T5: "F" }));
    expect(result.flags).toHaveLength(2);
    expect(result.practicalGrade).toBe("D");
  });

  it("does not annotate a cap when the composite is already D or worse", () => {
    const result = score(answersWith("F"));
    expect(result.flags.length).toBeGreaterThanOrEqual(2);
    expect(result.overallLetter).toBe("F");
    expect(result.practicalGrade).toBeNull();
  });
});

describe("one rung up", () => {
  it("returns the three highest-leverage moves, red-line weighted", () => {
    // Everything A except: T1 (not red-line) at F, F1 (red-line) at D, M8 (red-line) at C.
    // Weights: T1 = 4×1 = 4; F1 = 3×1.5 = 4.5; M8 = 2×1.5 = 3.
    const result = score(answersWith("A", { T1: "F", F1: "D", M8: "C" }));
    expect(result.oneRungUp.map((i) => i.dimensionId)).toEqual(["F1", "T1", "M8"]);
    expect(result.oneRungUp[0].target).toBe("C");
    expect(result.oneRungUp[1].target).toBe("D");
  });

  it("excludes dimensions already at A", () => {
    const result = score(answersWith("A", { T6: "B" }));
    expect(result.oneRungUp.map((i) => i.dimensionId)).toEqual(["T6"]);
    expect(result.oneRungUp[0].target).toBe("A");
  });
});

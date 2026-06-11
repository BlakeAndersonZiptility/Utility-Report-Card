import rubricJson from "@/content/rubric.json";
import actionPlanJson from "@/content/action-plan-library.json";
import type { ActionPlanLibrary, Dimension, Grade, Rubric, Transition } from "./types";

export const rubric = rubricJson as unknown as Rubric;
export const actionPlanLibrary = actionPlanJson as unknown as ActionPlanLibrary;

export const dimensions: Dimension[] = rubric.dimensions;

export const dimensionById = new Map(dimensions.map((d) => [d.id, d]));

export const GRADE_ORDER: Grade[] = ["F", "D", "C", "B", "A"];

const TRANSITION_BY_GRADE: Partial<Record<Grade, Transition>> = {
  F: "FtoD",
  D: "DtoC",
  C: "CtoB",
  B: "BtoA",
};

/** The action-plan cell that moves a dimension one rung up from `current` (null at A). */
export function transitionFor(current: Grade): Transition | null {
  return TRANSITION_BY_GRADE[current] ?? null;
}

export function actionPlanFor(dimensionId: string, current: Grade): string | null {
  const transition = transitionFor(current);
  if (!transition) return null;
  return actionPlanLibrary.library[dimensionId]?.[transition] ?? null;
}

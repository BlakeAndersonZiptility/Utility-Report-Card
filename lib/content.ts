import rubricJson from "@/content/rubric.json";
import actionPlanJson from "@/content/action-plan-library.json";
import resourceLinksJson from "@/content/resource-links.json";
import type { ActionPlanLibrary, Dimension, Grade, Rubric, Transition } from "./types";

export const rubric = rubricJson as unknown as Rubric;
export const actionPlanLibrary = actionPlanJson as unknown as ActionPlanLibrary;

export interface ResourceLink {
  label: string;
  url: string;
}

const resourceLinks = resourceLinksJson as unknown as {
  links: Array<{ match: string; label: string; url: string }>;
};

/**
 * Curated org-level links matched against a dimension's action-cell resource
 * text. Deduplicated by label, capped to keep layouts tight.
 */
export function linksFor(dimensionId: string, current: Grade, max = 3): ResourceLink[] {
  const cell = actionPlanFor(dimensionId, current);
  if (!cell) return [];
  const found: ResourceLink[] = [];
  for (const { match, label, url } of resourceLinks.links) {
    if (cell.includes(match) && !found.some((l) => l.label === label)) {
      found.push({ label, url });
      if (found.length >= max) break;
    }
  }
  return found;
}

/** Word-boundary truncation for compact PDF layouts. */
export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > maxChars * 0.6 ? lastSpace : maxChars)}…`;
}

/** The first numbered action from an action-plan cell, without the "(1)" marker. */
export function firstAction(cell: string): string {
  const body = cell.replace(/^\(1\)\s*/, "");
  const next = body.indexOf("(2)");
  return (next > 0 ? body.slice(0, next) : body).trim();
}

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

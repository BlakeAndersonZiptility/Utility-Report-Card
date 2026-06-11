export type Grade = "F" | "D" | "C" | "B" | "A";
export type Leg = "T" | "M" | "F";

export interface Dimension {
  id: string;
  name: string;
  leg: Leg;
  redLine: boolean;
  definition: string;
  grades: Record<Grade, string>;
  sources: string;
}

export interface Rubric {
  version: string;
  title: string;
  subtitle: string;
  gradeLadder: Record<Grade, string>;
  legs: Record<Leg, string>;
  redLineNote: string;
  dimensions: Dimension[];
}

export type Transition = "FtoD" | "DtoC" | "CtoB" | "BtoA";

export interface ActionPlanLibrary {
  version: string;
  description: string;
  transitions: Transition[];
  library: Record<string, Record<Transition, string>>;
}

// Type alias (not interface) so it satisfies Prisma's InputJsonValue when
// persisted in the answers JSON column.
export type DimensionAnswer = {
  grade: Grade;
  notSure?: boolean;
};

/** Answers keyed by dimension id (T1..T9, M1..M8, F1..F6). */
export type Answers = Record<string, DimensionAnswer>;

export interface UtilityInfo {
  systemName: string;
  state: string;
  pwsId?: string;
  connections?: number;
}

export interface ContactInfo {
  email: string;
  name: string;
  role: "Operator" | "Clerk/Admin" | "Manager" | "Board" | "Other";
  consentBenchmarking: boolean;
}

export interface LegScore {
  leg: Leg;
  average: number;
  letter: Grade;
}

export interface RedLineFlag {
  dimensionId: string;
  dimensionName: string;
}

export interface OneRungUpItem {
  dimensionId: string;
  dimensionName: string;
  current: Grade;
  target: Grade;
  redLine: boolean;
  weight: number;
}

export interface ScoreResult {
  legs: LegScore[];
  overallAverage: number;
  overallLetter: Grade;
  flags: RedLineFlag[];
  /** Set when 2+ red-line F's cap the practical grade below the descriptive composite. */
  practicalGrade: Grade | null;
  oneRungUp: OneRungUpItem[];
}

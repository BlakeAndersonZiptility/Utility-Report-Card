"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GRADE_ORDER, dimensions, rubric } from "@/lib/content";
import type { Answers, ContactInfo, Grade, UtilityInfo } from "@/lib/types";
import Results from "./Results";

const STORAGE_KEY = "urc-assessment-v2.1";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS",
  "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK",
  "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
  "WI", "WY", "DC", "PR", "GU", "VI",
];

const ROLES: ContactInfo["role"][] = [
  "Operator",
  "Clerk/Admin",
  "Manager",
  "Board",
  "Other",
];

interface WizardState {
  step: number; // 0 = intake; 1..23 = dimensions; 24 = gate; 25 = results
  utility: UtilityInfo;
  answers: Answers;
  contact: ContactInfo | null;
  submitted: boolean;
  resumeToken?: string;
}

const INITIAL_STATE: WizardState = {
  step: 0,
  utility: { systemName: "", state: "", pwsId: "", connections: undefined },
  answers: {},
  contact: null,
  submitted: false,
};

const GATE_STEP = dimensions.length + 1;
const RESULTS_STEP = dimensions.length + 2;

function loadSavedState(): WizardState {
  // Only runs client-side: this component is loaded with `ssr: false`.
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...INITIAL_STATE, ...JSON.parse(raw) };
  } catch {
    // Corrupt or unavailable storage — start fresh.
  }
  return INITIAL_STATE;
}

export default function AssessmentWizard() {
  const [state, setState] = useState<WizardState>(loadSavedState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked — assessment still works in memory.
    }
  }, [state]);

  // Cross-device resume: /assessment?resume=<token> loads the saved server copy.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("resume");
    if (!token) return;
    fetch(`/api/resume/${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((saved) => {
        if (!saved) return;
        setState((s) => ({
          ...s,
          utility: saved.utility,
          answers: saved.answers,
          resumeToken: saved.token,
          step: Math.max(s.step, 1),
        }));
        window.history.replaceState(null, "", "/assessment");
      })
      .catch(() => {});
  }, []);

  const answeredCount = useMemo(
    () => dimensions.filter((d) => state.answers[d.id]).length,
    [state.answers]
  );

  const setStep = (step: number) => setState((s) => ({ ...s, step }));

  const restart = () => {
    if (
      window.confirm(
        "Start over? This clears your saved answers on this device."
      )
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      setState(INITIAL_STATE);
    }
  };

  return (
    <main className="flex-1">
      <header className="no-print border-b border-navy/15 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-semibold text-navy">
            {rubric.title}
          </Link>
          <div className="flex items-center gap-4 text-sm text-foreground/60">
            <span>
              {answeredCount}/{dimensions.length} graded
            </span>
            <button onClick={restart} className="underline hover:text-clay">
              Start over
            </button>
          </div>
        </div>
        <div className="h-1 bg-navy/10">
          <div
            className="h-1 bg-clay transition-all"
            style={{ width: `${(answeredCount / dimensions.length) * 100}%` }}
          />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10">
        {state.step === 0 && (
          <IntakeStep
            utility={state.utility}
            onSubmit={(utility) => setState((s) => ({ ...s, utility, step: 1 }))}
          />
        )}

        {state.step >= 1 && state.step <= dimensions.length && (
          <>
            <DimensionStep
              index={state.step - 1}
              answers={state.answers}
              onAnswer={(id, grade, notSure) =>
                setState((s) => ({
                  ...s,
                  answers: { ...s.answers, [id]: { grade, notSure } },
                }))
              }
              onBack={() => setStep(state.step - 1)}
              onNext={() => setStep(state.step + 1)}
            />
            <SaveForLater
              state={state}
              onSaved={(token) =>
                setState((s) => ({ ...s, resumeToken: token }))
              }
            />
          </>
        )}

        {state.step === GATE_STEP && (
          <GateStep
            contact={state.contact}
            allAnswered={answeredCount === dimensions.length}
            onBack={() => setStep(dimensions.length)}
            onJumpToFirstUnanswered={() => {
              const firstUnanswered = dimensions.findIndex(
                (d) => !state.answers[d.id]
              );
              setStep(firstUnanswered + 1);
            }}
            onSubmit={(contact) => {
              setState((s) => ({ ...s, contact, step: RESULTS_STEP }));
              // Fire-and-forget lead capture; results are never blocked on it.
              fetch("/api/lead", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contact,
                  utility: state.utility,
                  answers: state.answers,
                  resumeToken: state.resumeToken,
                }),
              }).catch(() => {});
            }}
          />
        )}

        {state.step === RESULTS_STEP && state.contact && (
          <Results
            utility={state.utility}
            contact={state.contact}
            answers={state.answers}
          />
        )}
      </div>
    </main>
  );
}

function IntakeStep({
  utility,
  onSubmit,
}: {
  utility: UtilityInfo;
  onSubmit: (utility: UtilityInfo) => void;
}) {
  const [form, setForm] = useState<UtilityInfo>(utility);
  const valid = form.systemName.trim().length > 0 && form.state.length > 0;

  return (
    <div>
      <h1 className="text-3xl font-bold text-navy">About your system</h1>
      <p className="mt-3 text-foreground/70">
        First-time completion takes 90–120 minutes if records are nearby. Your
        progress saves automatically on this device, so you can stop and come
        back. Best results come from completing it jointly: the operator, the
        clerk, and the board chair each see a different part of the system.
      </p>

      <form
        className="mt-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit(form);
        }}
      >
        <label className="block">
          <span className="font-medium">Water system name *</span>
          <input
            type="text"
            required
            value={form.systemName}
            onChange={(e) => setForm({ ...form, systemName: e.target.value })}
            className="mt-1 w-full rounded-md border border-navy/30 bg-white px-3 py-2"
            placeholder="e.g., Pine Hollow Water District"
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-3">
          <label className="block">
            <span className="font-medium">State *</span>
            <select
              required
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className="mt-1 w-full rounded-md border border-navy/30 bg-white px-3 py-2"
            >
              <option value="">Select…</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="font-medium">PWS ID</span>
            <input
              type="text"
              value={form.pwsId ?? ""}
              onChange={(e) => setForm({ ...form, pwsId: e.target.value })}
              className="mt-1 w-full rounded-md border border-navy/30 bg-white px-3 py-2"
              placeholder="Optional"
            />
          </label>

          <label className="block">
            <span className="font-medium">Connections</span>
            <input
              type="number"
              min={1}
              value={form.connections ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  connections: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
              className="mt-1 w-full rounded-md border border-navy/30 bg-white px-3 py-2"
              placeholder="Optional"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={!valid}
          className="rounded-md bg-clay px-6 py-3 font-semibold text-white shadow hover:bg-clay/90 disabled:opacity-40"
        >
          Begin grading → T1 of {dimensions.length}
        </button>
      </form>
    </div>
  );
}

function DimensionStep({
  index,
  answers,
  onAnswer,
  onBack,
  onNext,
}: {
  index: number;
  answers: Answers;
  onAnswer: (id: string, grade: Grade, notSure: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const dimension = dimensions[index];
  const answer = answers[dimension.id];
  const legName = rubric.legs[dimension.leg];
  const legDims = dimensions.filter((d) => d.leg === dimension.leg);
  const legIndex = legDims.findIndex((d) => d.id === dimension.id) + 1;

  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-widest text-clay">
        {legName} capacity · {legIndex} of {legDims.length}
        {dimension.redLine && (
          <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
            ● Red-line dimension
          </span>
        )}
      </p>
      <h2 className="mt-2 text-2xl font-bold text-navy">
        {dimension.id} — {dimension.name}
      </h2>
      <p className="mt-2 text-foreground/70">{dimension.definition}</p>

      <p className="mt-6 text-sm font-medium text-foreground/60">
        Pick the description that best matches your system today — not where it
        was, not where it should be.
      </p>

      <div className="mt-3 space-y-3">
        {GRADE_ORDER.map((grade) => {
          const selected = answer?.grade === grade;
          return (
            <button
              key={grade}
              type="button"
              onClick={() => onAnswer(dimension.id, grade, answer?.notSure ?? false)}
              className={`block w-full rounded-lg border p-4 text-left transition ${
                selected
                  ? "border-clay bg-clay/10 ring-2 ring-clay"
                  : "border-navy/20 bg-white hover:border-navy/50"
              }`}
            >
              <span className="font-bold text-navy">
                {grade} — {rubric.gradeLadder[grade]}
              </span>
              <p className="mt-1 text-sm leading-relaxed text-foreground/80">
                {dimension.grades[grade]}
              </p>
            </button>
          );
        })}
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-foreground/70">
        <input
          type="checkbox"
          checked={answer?.notSure ?? false}
          disabled={!answer}
          onChange={(e) =>
            answer && onAnswer(dimension.id, answer.grade, e.target.checked)
          }
        />
        I&apos;m not confident in this grade — flag it for follow-up with the
        rest of the team.
      </label>

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-navy/30 px-5 py-2.5 font-medium text-navy hover:bg-navy/5"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!answer}
          className="rounded-md bg-clay px-6 py-2.5 font-semibold text-white shadow hover:bg-clay/90 disabled:opacity-40"
        >
          {index === dimensions.length - 1 ? "Finish →" : "Next →"}
        </button>
      </div>
    </div>
  );
}

function SaveForLater({
  state,
  onSaved,
}: {
  state: WizardState;
  onSaved: (token: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "saved"; resumeUrl: string; emailed: boolean }
    | { kind: "unavailable" }
    | { kind: "error" }
  >({ kind: "idle" });

  const save = async () => {
    setStatus({ kind: "saving" });
    try {
      const response = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: state.resumeToken,
          utility: state.utility,
          answers: state.answers,
          email: email || undefined,
        }),
      });
      const body = await response.json();
      if (body.ok) {
        onSaved(body.token);
        setStatus({
          kind: "saved",
          resumeUrl: body.resumeUrl,
          emailed: body.emailed,
        });
      } else {
        setStatus({ kind: "unavailable" });
      }
    } catch {
      setStatus({ kind: "error" });
    }
  };

  return (
    <div className="no-print mt-10 rounded-lg border border-navy/15 bg-white/60 p-4 text-sm">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-medium text-navy underline hover:text-clay"
        >
          Need to stop? Save &amp; resume on another device →
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-foreground/70">
            Your progress already saves on this device automatically. To resume
            on another device — or hand the financial section to the clerk —
            get a resume link:
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email the link to… (optional)"
              className="w-64 rounded-md border border-navy/30 bg-white px-3 py-2"
            />
            <button
              type="button"
              onClick={save}
              disabled={status.kind === "saving"}
              className="rounded-md border border-navy/40 px-4 py-2 font-medium text-navy hover:bg-navy/5 disabled:opacity-40"
            >
              {status.kind === "saving" ? "Saving…" : "Get resume link"}
            </button>
          </div>
          {status.kind === "saved" && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3">
              <p className="font-medium text-green-800">
                Saved.{" "}
                {status.emailed
                  ? "A resume link is on its way to your inbox."
                  : "Your resume link:"}
              </p>
              {!status.emailed && (
                <p className="mt-1 break-all font-mono text-xs text-green-900">
                  {status.resumeUrl}
                </p>
              )}
            </div>
          )}
          {status.kind === "unavailable" && (
            <p className="text-foreground/60">
              Cross-device save isn&apos;t available right now — your progress
              is still saved in this browser.
            </p>
          )}
          {status.kind === "error" && (
            <p className="text-red-700">
              Couldn&apos;t save just now — your progress is still in this
              browser. Try again in a minute.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function GateStep({
  contact,
  allAnswered,
  onBack,
  onJumpToFirstUnanswered,
  onSubmit,
}: {
  contact: ContactInfo | null;
  allAnswered: boolean;
  onBack: () => void;
  onJumpToFirstUnanswered: () => void;
  onSubmit: (contact: ContactInfo) => void;
}) {
  const [form, setForm] = useState<ContactInfo>(
    contact ?? {
      email: "",
      name: "",
      role: "Operator",
      consentBenchmarking: true,
    }
  );
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const valid = emailValid && form.name.trim().length > 0;

  if (!allAnswered) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-navy">Almost there</h2>
        <p className="mt-3 text-foreground/70">
          A few dimensions are still ungraded. Every dimension needs a grade
          before the composite can be computed.
        </p>
        <button
          type="button"
          onClick={onJumpToFirstUnanswered}
          className="mt-6 rounded-md bg-clay px-6 py-3 font-semibold text-white shadow hover:bg-clay/90"
        >
          Go to the first ungraded dimension
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy">
        Your report card is ready
      </h2>
      <p className="mt-3 text-foreground/70">
        Tell us where to associate the results. You&apos;ll see your grades,
        diagnostic flags, and personalized action plan immediately on the next
        screen.
      </p>

      <form
        className="mt-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit(form);
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="font-medium">Work email *</span>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-md border border-navy/30 bg-white px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="font-medium">Your name *</span>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-md border border-navy/30 bg-white px-3 py-2"
            />
          </label>
        </div>

        <label className="block sm:max-w-xs">
          <span className="font-medium">Your role *</span>
          <select
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value as ContactInfo["role"] })
            }
            className="mt-1 w-full rounded-md border border-navy/30 bg-white px-3 py-2"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-start gap-2 text-sm text-foreground/70">
          <input
            type="checkbox"
            checked={form.consentBenchmarking}
            onChange={(e) =>
              setForm({ ...form, consentBenchmarking: e.target.checked })
            }
            className="mt-0.5"
          />
          <span>
            Include my grades, anonymized and aggregated by system size and
            state, in peer benchmarking (&ldquo;utilities your size average a C
            on Rate Adequacy&rdquo;). Your system is never identified.
          </span>
        </label>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-navy/30 px-5 py-2.5 font-medium text-navy hover:bg-navy/5"
          >
            ← Back
          </button>
          <button
            type="submit"
            disabled={!valid}
            className="rounded-md bg-clay px-6 py-3 font-semibold text-white shadow hover:bg-clay/90 disabled:opacity-40"
          >
            Show my report card →
          </button>
        </div>
      </form>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import { rubric } from "@/lib/content";

export default function Home() {
  const redLineCount = rubric.dimensions.filter((d) => d.redLine).length;
  return (
    <main className="flex-1">
      <section className="mx-auto max-w-3xl px-6 py-16">
        <Image
          src="/ziptility-logo.png"
          alt="Ziptility"
          width={160}
          height={20}
          className="mb-8"
          priority
        />
        <p className="text-sm font-semibold uppercase tracking-widest text-clay">
          Living Map Series · Free self-assessment
        </p>
        <h1 className="mt-3 text-4xl font-bold text-navy sm:text-5xl">
          {rubric.title}
        </h1>
        <p className="mt-4 text-xl text-foreground/80">{rubric.subtitle}</p>

        <div className="mt-8 space-y-4 text-base leading-relaxed">
          <p>
            Grade your utility across <strong>23 dimensions</strong> of
            Technical, Managerial, and Financial capacity — the same TMF
            framework EPA uses under SDWA §1420 — and get composite grades, a
            diagnostic flag panel for existential risks, and a personalized
            action plan for the three highest-leverage improvements you can
            make this year.
          </p>
          <p>
            A $10,000 consultant report cannot serve a 600-connection system
            that needs annually-current data. This report card is
            self-administered, takes <strong>90–120 minutes</strong> the first
            time (30–45 minutes for annual updates), and is designed to be
            completed jointly by the <strong>licensed operator</strong>, the{" "}
            <strong>board chair</strong>, and the <strong>financial clerk</strong>{" "}
            — each role sees a different part of the system.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-navy/20 bg-white p-4">
            <p className="text-2xl font-bold text-navy">23</p>
            <p className="text-sm text-foreground/70">
              dimensions across Technical (9), Managerial (8), and Financial (6)
              capacity
            </p>
          </div>
          <div className="rounded-lg border border-navy/20 bg-white p-4">
            <p className="text-2xl font-bold text-navy">F → A</p>
            <p className="text-sm text-foreground/70">
              five-grade ladder from Survival to Thriving, with full rubric text
              for every rung
            </p>
          </div>
          <div className="rounded-lg border border-navy/20 bg-white p-4">
            <p className="text-2xl font-bold text-navy">{redLineCount}</p>
            <p className="text-sm text-foreground/70">
              red-line dimensions where an F signals existential risk regardless
              of your composite
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/assessment"
            className="rounded-md bg-clay px-6 py-3 text-lg font-semibold text-white shadow hover:bg-clay/90"
          >
            Start the assessment
          </Link>
          <p className="text-sm text-foreground/60">
            Free. No account needed. Your progress saves in your browser.
          </p>
        </div>

        <div className="mt-12 border-t border-navy/15 pt-6 text-sm text-foreground/60">
          <p>
            The Report Card v{rubric.version} accompanies the white paper{" "}
            <em>
              Why Small Water Systems Fail: Capacity, Consultants, and the Case
              for a Living Map
            </em>
            . Grades convert to a descriptive composite per TMF leg; red-line
            F&apos;s surface on a diagnostic flag panel; two or more cap the
            practical grade at D.
          </p>
        </div>
      </section>
    </main>
  );
}

"use client";

import dynamic from "next/dynamic";

// Client-only: wizard state initializes from localStorage, so it must not
// render on the server.
const AssessmentWizard = dynamic(() => import("./AssessmentWizard"), {
  ssr: false,
  loading: () => (
    <main className="mx-auto max-w-3xl px-6 py-16 text-foreground/60">
      Loading…
    </main>
  ),
});

export default function WizardLoader() {
  return <AssessmentWizard />;
}

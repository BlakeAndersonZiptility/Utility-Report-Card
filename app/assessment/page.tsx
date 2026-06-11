import type { Metadata } from "next";
import WizardLoader from "./WizardLoader";

export const metadata: Metadata = {
  title: "Assessment — Utility Health Report Card",
};

export default function AssessmentPage() {
  return <WizardLoader />;
}

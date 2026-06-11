import { Resend } from "resend";

/**
 * Transactional email is optional: without RESEND_API_KEY every send becomes
 * a no-op that reports `sent: false` so callers can fall back (e.g. show the
 * resume link on screen instead of emailing it).
 */

const FROM =
  process.env.EMAIL_FROM ?? "Utility Report Card <reportcard@ziptility.com>";

function getResend(): Resend | null {
  return process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;
}

export async function sendResumeLink(
  email: string,
  resumeUrl: string,
  systemName: string
): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;
  const { error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Resume your Utility Health Report Card — ${systemName}`,
    text: [
      `Your report card for ${systemName} is saved.`,
      "",
      `Pick up where you left off: ${resumeUrl}`,
      "",
      "The assessment is best completed jointly by the operator, the clerk, and the board chair — share this link with them.",
    ].join("\n"),
  });
  if (error) {
    console.error("Resume email failed:", error);
    return false;
  }
  return true;
}

export async function sendResultsPdf(
  email: string,
  systemName: string,
  pdf: Buffer
): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;
  const { error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your Utility Health Report Card — ${systemName}`,
    text: [
      `Attached: the ${new Date().getFullYear()} Utility Health Report Card and personalized action plan for ${systemName}.`,
      "",
      "Re-assess annually — a report card that does not move year over year is not a living diagnostic.",
    ].join("\n"),
    attachments: [
      {
        filename: `utility-report-card-${new Date().getFullYear()}.pdf`,
        content: pdf,
      },
    ],
  });
  if (error) {
    console.error("Results email failed:", error);
    return false;
  }
  return true;
}

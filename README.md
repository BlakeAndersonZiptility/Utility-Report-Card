# Utility Report Card

Interactive web version of the **Utility Health Report Card v2.1** — a self-administered TMF (Technical / Managerial / Financial) diagnostic for community water systems under 10,000 connections. Built as a lead magnet and data collection tool for ziptility.com. See [MASTER_PLAN.md](./MASTER_PLAN.md) for the full product plan.

## What it does

- Full 23-dimension assessment (9 Technical, 8 Managerial, 6 Financial), each graded on the F (Survival) → A (Thriving) ladder with full rubric text
- Two-track scoring per the workbook methodology: descriptive composites per TMF leg + a diagnostic flag panel for red-line F's, with the practical-grade cap (2+ red-line F's → Practical Grade D)
- "One rung up" panel: the three highest-leverage single-grade improvements
- Personalized action plan from the 92-cell Action Plan Library, on screen and as a generated PDF (`/api/pdf`, also emailed on completion when email is configured)
- Progress auto-saves in the browser; cross-device **save & resume** via magic link (`/api/save`, `/assessment?resume=<token>`); email gate before results
- Lead capture (`/api/lead`): persists the completed assessment to Postgres (benchmarking dataset, consent-gated), upserts the HubSpot contact with `report_card_*` properties, and opens a HIGH-priority sales task when red-line flags are present

## Stack

Next.js (App Router) + TypeScript + Tailwind. Scoring engine in `lib/scoring.ts` with unit tests (`npm test`). Rubric and Action Plan Library content extracted from the v2.1 workbook into `content/*.json` — the single source of truth. Postgres via Prisma 7 (`prisma/schema.prisma`, client generated to `lib/generated/`); PDF via `@react-pdf/renderer`; transactional email via Resend.

## Develop

```bash
npm install            # also runs prisma generate
npm run dev            # http://localhost:3000
npm test               # scoring engine + content integrity tests
npm run build
npx prisma migrate dev # after schema changes (needs DATABASE_URL)
```

## Configuration

Every integration is optional — the assessment works with zero env vars (browser-local save, server-logged leads). Configure what you have:

| Env var | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres. Enables benchmarking persistence and cross-device save/resume. |
| `HUBSPOT_ACCESS_TOKEN` | Contact upsert with `report_card_*` properties + red-line sales tasks. Run `node scripts/setup-hubspot-properties.mjs` once to create the portal properties. |
| `RESEND_API_KEY` | Emails: resume links and the action-plan PDF on completion. |
| `EMAIL_FROM` | From address (default `Utility Report Card <reportcard@ziptility.com>`). |
| `APP_URL` | Public base URL used in resume links (defaults to the request origin). |

## Calibration notes

- The red-line set ships as marked in the v2.1 workbook (**7 dimensions: T5, T7, T8, M3, M8, F1, F2**). The white paper recommends 6 (without M3) — open decision A1. Change via `redLine` flags in `content/rubric.json` + `lib/config.ts`.
- Rubric text must stay stable in routine use; calibration changes are versioned (v2.1 → v2.2) with a change log.

## Roadmap (MASTER_PLAN.md phases)

- **Phase 1 — core assessment**: ✅ built
- **Phase 2 — lead machine** (DB persistence, save/resume, PDF + email, HubSpot sync + sales routing): ✅ built; needs production credentials (Neon/Supabase `DATABASE_URL`, HubSpot token + property setup script, Resend domain) and a Vercel deploy
- **Phase 3**: Webflow landing page + launch content
- **Phase 4**: peer benchmarks on results, re-assessment trend view

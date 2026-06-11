# Utility Report Card

Interactive web version of the **Utility Health Report Card v2.1** — a self-administered TMF (Technical / Managerial / Financial) diagnostic for community water systems under 10,000 connections. Built as a lead magnet and data collection tool for ziptility.com. See [MASTER_PLAN.md](./MASTER_PLAN.md) for the full product plan.

## What it does

- Full 23-dimension assessment (9 Technical, 8 Managerial, 6 Financial), each graded on the F (Survival) → A (Thriving) ladder with full rubric text
- Two-track scoring per the workbook methodology: descriptive composites per TMF leg + a diagnostic flag panel for red-line F's, with the practical-grade cap (2+ red-line F's → Practical Grade D)
- "One rung up" panel: the three highest-leverage single-grade improvements
- Personalized action plan from the 92-cell Action Plan Library
- Progress auto-saves in the browser (localStorage); email gate before results; lead capture posts to `/api/lead`

## Stack

Next.js (App Router) + TypeScript + Tailwind. Scoring engine in `lib/scoring.ts` with unit tests (`npm test`). Rubric and Action Plan Library content extracted from the v2.1 workbook into `content/*.json` — the single source of truth.

## Develop

```bash
npm install
npm run dev    # http://localhost:3000
npm test       # scoring engine + content integrity tests
npm run build
```

## Configuration

| Env var | Purpose |
| --- | --- |
| `HUBSPOT_ACCESS_TOKEN` | Enables contact upsert with `report_card_*` properties on results unlock. Without it, leads are logged server-side only. Custom properties must be created in the portal first (see MASTER_PLAN.md §3). |

## Calibration notes

- The red-line set ships as marked in the v2.1 workbook (**7 dimensions: T5, T7, T8, M3, M8, F1, F2**). The white paper recommends 6 (without M3) — open decision A1. Change via `redLine` flags in `content/rubric.json` + `lib/config.ts`.
- Rubric text must stay stable in routine use; calibration changes are versioned (v2.1 → v2.2) with a change log.

## Roadmap (MASTER_PLAN.md phases)

- **Phase 2**: Postgres persistence (benchmarking dataset), magic-link save/resume across devices, action-plan PDF generation + email delivery, sales routing
- **Phase 3**: Webflow landing page + launch content
- **Phase 4**: peer benchmarks, re-assessment trend view

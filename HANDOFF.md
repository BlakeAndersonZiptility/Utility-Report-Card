# HANDOFF — Verification & Review Phase (pre-launch)

**Status: NOT LIVE. Do not deploy, do not point real traffic, do not write to production HubSpot.**

This file is the work order for the next session(s). The goal is to **independently re-verify everything built so far** (treat prior work as untrusted until re-checked), resolve the open decisions, and work the danger-zone list below. The build sessions that produced this code also produced this checklist — that is exactly why a fresh session must re-derive results rather than re-read summaries.

Companion docs: `MASTER_PLAN.md` (product plan), `README.md` (dev setup).

---

## 1. What exists (claimed — verify, don't trust)

| Piece | Where | Claimed state |
| --- | --- | --- |
| Rubric content (23 dims, F–A cells, red-line flags) | `content/rubric.json` | Extracted from "Utility Health Report Card v2" workbook (Drive file `1tk-_bz9LiKnlyBNEd5GpK4DPDA20syFx`) |
| Action Plan Library (92 cells) | `content/action-plan-library.json` | Extracted from same workbook |
| Curated resource links | `content/resource-links.json` | Org-level URLs only; **never independently clicked** |
| Scoring engine (two-track) | `lib/scoring.ts` + `lib/scoring.test.ts` | 14 tests pass |
| Assessment wizard + results | `app/assessment/*` | localStorage save; email gate; resume via `?resume=<token>` |
| API: lead capture / save / resume / PDF | `app/api/*` | All integrations optional & failure-tolerant |
| Postgres persistence | `prisma/schema.prisma`, `lib/db.ts` | Prisma 7 + `@prisma/adapter-pg`; e2e tested against local Postgres 16 only |
| HubSpot client + property setup script | `lib/hubspot.ts`, `scripts/setup-hubspot-properties.mjs` | **Never run against any portal** |
| Email (Resend) | `lib/email.ts` | **Never sent a real email** |
| Branded PDF generator | `lib/pdf.tsx`, `lib/logo.ts` | 7-page output verified visually across 3 grade profiles |

---

## 2. Triple-check protocol (do this first, from scratch)

Run every step yourself; do not accept "it passed last time."

### 2.1 Environment & unit level
```bash
npm install            # postinstall runs prisma generate
npm run lint
npm test               # expect 14/14 — then READ the tests and judge if they test the right things
npm run build
```

### 2.2 Re-derive the methodology independently
1. Open the white paper section "Part 2 — The Living Map / Report Card Framework" (Notion: *Why Small Systems Fail* → subpage 3) and the workbook **Methodology sheet**.
2. Without looking at `lib/scoring.ts`, write down the scoring rules as specified. Then compare against the implementation. Known interpretation points that were **decided by the AI build session, not by Blake** — each needs explicit sign-off or correction:
   - **Rounding**: leg average rounds half-up (1.5 → C, 3.51 → A). The workbook's dashboard formulas were literally `[CALIBRATE — formula in Phase 2]`, i.e. **never finalized in the source artifact**. Our rule comes from the white paper prose only.
   - **One-rung-up ranking**: implemented as `(4 − gradeValue) × 1.5 if red-line`. Workbook says "largest gap to the next grade × red-line weighting"; the white paper adds a "time-to-implement" factor that is **not implemented**. Ambiguous source → confirm the intended formula.
   - **Red-line set**: workbook v2.1 marks **7** (T5, T7, T8, **M3**, M8, F1, F2); white paper recommends **6** (no M3). We shipped 7. This is open decision **A1** in the Notion "Questions for Blake" page.
   - **Practical-grade cap**: only at 2+ red-line F's, and only annotated when the composite is better than D. Single-severe-F behavior is open decision **A5**.
   - **"Not sure" answers** still count fully in the composite (flagged in output only). Methodological choice — confirm.
3. Hand-compute one full scorecard on paper from a filled grid and compare with `score()` output.

### 2.3 Content fidelity audit (highest-value check)
The rubric and action-library JSON were transcribed by an AI from a flattened CSV export of the workbook. Transcription errors here are silent and damaging.
1. Re-fetch the workbook from Drive (file id above; Drive connector needs Blake's approval in-session).
2. Diff **every cell** against `content/rubric.json` and `content/action-plan-library.json` — script it; do not eyeball. Pay attention to: en/em dashes, `>`/`<` symbols (e.g. ">40% NRW", ">70 validity"), dollar thresholds in F1, the long F2 cells, and red-line `●` markers.
3. Verify dimension count/order (9 T, 8 M, 6 F) and that the **Citations sheet** sources match `sources` fields.
4. Note: workbook Methodology sheet says the Action Plan Library has "22 dimensions" — the actual grid has 23. We treated 23 as correct; confirm with Blake.

### 2.4 End-to-end with a real database
```bash
# local postgres (container has PG16 at /usr/lib/postgresql/16/bin; run as postgres user)
mkdir -p /tmp/pgdata && chown postgres /tmp/pgdata
su postgres -c 'export PATH=/usr/lib/postgresql/16/bin:$PATH && initdb -D /tmp/pgdata -U urc --auth=trust && pg_ctl -D /tmp/pgdata -l /tmp/pg.log -o "-p 5544 -k /tmp" start'
psql -h /tmp -p 5544 -U urc -d postgres -c "CREATE DATABASE reportcard"
echo 'DATABASE_URL="postgresql://urc@localhost:5544/reportcard?host=/tmp"' > .env
npx prisma migrate dev
npm run build && npm start &
```
Then exercise: partial `/api/save` → `GET /api/resume/<token>` → full `/api/lead` with `resumeToken` (must UPDATE the same row to `completed`, not insert a second) → `/api/pdf`. Inspect the row in psql. Also test the **double-submit** of `/api/lead` (see §3.7).

### 2.5 PDF review
Generate at least three profiles (all-B; mixed with 2 red-line F's; struggling all-D/F) and confirm: cover is **exactly one page** in every profile; legend band on page 1 (an earlier bug pushed it to a blank page 2 — regression-watch this); no `…` truncation anywhere; arrows/glyphs render (Helvetica has no `→`/`⚑`/`■` — we use "to", "RED-LINE", "•"); page count ~7.

### 2.6 Link audit
`curl -sIL` every URL in `content/resource-links.json` and the `ziptility.com` footer link; confirm 200s and that landing pages are what the label claims. These were chosen from training knowledge and **never fetched**.

### 2.7 Copy audit
All "encourager" sentences (`ENCOURAGERS` in `lib/pdf.tsx`), the cover narrative blocks, and the board/council paragraph are **AI-authored voice**. Review against the Company Brain **Personas & Voice** DB and Field Guide integrity rules. Blake must approve or rewrite — this text ships to customers under the Ziptility name.

---

## 3. Danger zones & gotchas (work this list)

### 3.1 Hosting decision (open)
- **Webflow cannot host this app as-is** (server routes, Postgres, server-side PDF). Options to evaluate:
  1. **Vercel app at `reportcard.ziptility.com` + Webflow marketing page** (current plan; lowest risk).
  2. **Webflow Cloud** — verify current capabilities before assuming: whether it runs Next.js 16, and critically whether `@react-pdf/renderer` (Node APIs) runs in its runtime (likely Workers-based → probably NOT). Do not commit to this without a spike.
  3. Anything iframe-embedded in Webflow: **avoid** — localStorage/cookies inside cross-site iframes are partitioned/blocked by modern browsers; save/resume would silently break. Link out, don't embed.
- Vercel specifics to verify: PDF render memory/duration on a hobby vs pro plan; Node (not Edge) runtime pinned for `/api/pdf` and `/api/lead`; cold-start latency acceptable.
- **Prisma + serverless = connection exhaustion** risk. Use Neon's pooled connection string (or pgbouncer). Test under parallel invocations.
- Deployment must run `prisma migrate deploy`; note the datasource URL lives in `prisma.config.ts` (Prisma 7), not in `schema.prisma`.
- Version risk: Next 16 / React 19 / Prisma 7 are all current-major. Pin versions; re-run the full e2e after any upgrade.

### 3.2 Outbound email — from where and from whom (open)
- Decide the **sender identity**: current default `reportcard@ziptility.com` via Resend. Recommendation to evaluate: send transactional mail from a **subdomain** (e.g. `mail.ziptility.com`) so deliverability problems can't damage the root domain's reputation. Requires SPF + DKIM + DMARC on that subdomain.
- Decide the **provider split**: Resend for transactional (resume links, PDF delivery) vs HubSpot for marketing/nurture. Do NOT send nurture from Resend — suppression lists and unsubscribe handling live in HubSpot.
- The PDF attachment can exceed common size comfort (~60–70 KB is fine today, but if imagery grows, switch to a download link).
- No **double-opt-in** exists: anyone can type any email and trigger mail to it (resume links, results PDF). That is an abuse vector (mail-bombing a victim's address) and a deliverability risk. Mitigations to evaluate: verify-before-send, rate limits per address/IP, and only emailing the PDF after a confirmed click.
- CAN-SPAM basics on every template: physical address, unsubscribe for anything non-transactional.

### 3.3 API abuse & data poisoning (must fix before launch)
- **No rate limiting** on any route. `/api/pdf` is CPU-heavy (DoS), `/api/save` writes rows (DB fill), `/api/lead` writes to HubSpot (CRM pollution) and sends email.
- **Bots will fill the funnel with junk** — and junk completions poison the benchmarking dataset, which is the long-term asset. Add: Cloudflare Turnstile (or similar) on the gate, a honeypot field, server-side validation (zod) on all payloads, and length caps on free-text fields (system name flows into PDFs, emails, and HubSpot).
- `/api/save` accepts an arbitrary `answers` blob (no validation) — junk rows possible even without malice.
- **Resume tokens are bearer credentials** generated with Prisma `cuid()` — fine for casual use but not designed as a secret. Switch to crypto-random (e.g., 128-bit base64url) before launch; anyone with the link can read AND overwrite the assessment.
- Idempotency: posting `/api/lead` twice without `resumeToken` inserts two completed rows (skews benchmarks). Dedupe by (email, systemName, day) or require the resume token.

### 3.4 HubSpot safety (their CRM was just painstakingly cleaned)
- Per the CRM rulebook in Company Brain: gated, reversible writes only. **Run `scripts/setup-hubspot-properties.mjs` and the contact upsert against a sandbox/test portal first**, and review with the rulebook open.
- Upsert is by email; verify it cannot clobber fields owned by other processes (it only writes `report_card_*`, `firstname`, `lastname` — confirm `firstname/lastname` overwrite on existing contacts is acceptable, or make name write-once).
- Red-line tasks are created **unassigned** (no `hubspot_owner_id`). Decide the owner/queue or they will rot unseen.
- Lifecycle/`hs_lead_status` are deliberately NOT set by the app (workflows should do promotion per the playbook) — confirm and build the workflow.
- Company object association (PWS → company) from the plan is **not implemented**; contact properties carry utility info as a stopgap.

### 3.5 Privacy, consent, legal
- Benchmarking consent checkbox is **pre-checked** — questionable practice; review (uncheck by default or move to explicit opt-in language reviewed by counsel).
- No privacy policy link, no data-retention statement, no delete-my-data path. Needed before collecting real emails.
- Define anonymization concretely: minimum cohort size (e.g., n ≥ 10 per state/size bucket) before any benchmark is displayed anywhere.
- The PDF and DB include the assessor's name — small-town context means grades can be sensitive; treat results URLs/PDFs as confidential by default.

### 3.6 Methodology integrity (beyond §2.2)
- `[VERIFY]` debt: the white paper flags ~50 citations needing primary-source confirmation (16 critical). The app's content mostly avoids citing numbers, but the **Citations `sources` strings** ride along in `content/rubric.json` — they are not displayed today; keep it that way until verified.
- Rubric stability: the workbook mandates versioned calibration changes (v2.1 → v2.2 + changelog). The app hardcodes `2.1` in content and DB rows. Any A1/A5 decision that changes scoring = version bump + changelog, and consider how stored v2.1 assessments are compared against v2.2 ones.
- localStorage key is `urc-assessment-v2.1`; a rubric version bump strands in-progress browser saves (acceptable, but document the migration choice).
- **PDF year bug (real, found in review)**: the PDF prints `new Date().getFullYear()` at render time, not the assessment's completion year. A re-download next January mislabels the report. Pass `completedAt` through and print that year.

### 3.7 Gaps vs MASTER_PLAN (don't let them surprise anyone)
- SDWIS PWS-ID lookup/prefill: **not implemented** (plain text field).
- Analytics/funnel events (PostHog/GA/HubSpot tracking): **not implemented**.
- Magic-link emails require both `DATABASE_URL` and `RESEND_API_KEY`; without them the save panel quietly degrades to local-only (by design — verify the messaging is honest).
- Accessibility pass not done: keyboard flow, focus states, screen-reader labels on the grade cards, and AA contrast for the new coral/teal on white at small sizes.
- Mobile layout only superficially checked.
- Printed PDFs show link labels but not URLs (clickable digitally only) — decide if spelled-out URLs are needed for the print/board use case.

---

## 4. Open decisions needing Blake (carry into every review)

| # | Decision | Current behavior | Source |
| --- | --- | --- | --- |
| A1 | Red-line set: 6, 7 (current), or 8 | 7 incl. M3 (`content/rubric.json`) | Notion "Questions for Blake" |
| A5 | Single-severe-F cap rule | No cap until 2 flags | Notion "Questions for Blake" |
| — | Leg-average rounding rule | Half-up to nearest letter | AI interpretation (§2.2) |
| — | One-rung-up formula | gap-to-A × 1.5 red-line | AI interpretation (§2.2) |
| — | Consent checkbox default | Pre-checked | §3.5 |
| — | Sender identity & domain | `reportcard@ziptility.com` via Resend | §3.2 |
| — | Hosting (Vercel vs Webflow Cloud spike) | Vercel assumed | §3.1 |
| — | Encourager/cover copy voice | AI draft | §2.7 |

---

## 5. Follow-up step: lock in the design (do AFTER verification passes)

When the checks above are green and decisions are made, freeze the design as a spec so it stops drifting:

1. Create `DESIGN.md` capturing, as decided tokens (not suggestions):
   - **Palette**: midnight `#0c1f30`, tomato `#ff442f`, linen `#f6eee6`, paper `#fcf8f3`, surface border `#eadfd2`, ink `#2f3d4a`, dim `#55616c`; **grade scale** F `#d92d20`, D `#e8654f`, C `#0c7589` (teal), B `#1f9d66`, A `#0c7a43` — rationale: no amber/yellow band, C reads calm.
   - **Layout DNA**: warm paper background + white surface cards; grade rail left / narrative right; one-page board cover (hero band, full-height tile rail, space-between narrative, signature row, anchored legend); leg sections start on fresh pages; ladder scale ("you are here") on every dimension; double-slash brand motif at hero + leg titles.
   - **Type scale** (current Helvetica sizes) and the **pending typeface decision**: identify ziptility.com's real font(s) from its CSS, secure license or pick an open match, embed via `Font.register` in `lib/pdf.tsx`, re-verify the one-page cover afterwards (metrics will shift!).
   - **Voice rules**: asset-based tone, encourager rotation, "stabilize first" framing, no-scorching principle — with the approved final wording.
2. Get Blake's explicit sign-off on `DESIGN.md`, then mark it versioned (`v1.0`) — subsequent changes require a changelog entry like the rubric.
3. Port the locked tokens to the web app (`app/globals.css`, `Results.tsx`) so screen and PDF stay identical, and add a snapshot test for `GRADE_COLORS` parity between `lib/pdf.tsx` and `Results.tsx`.

---

## 6. Session log (for provenance)

- Branch: `claude/utility-report-card-plan-ugvsr0` — commits `85dcf87` (plan) → `78df2e9` (Phase 1) → `d3eb64f` (Phase 2) → `9023414`…`0604e85` (PDF design iterations).
- Local-only artifacts: test Postgres at `/tmp/pgdata` (ephemeral container — gone next session), sample PDFs in `/tmp`.
- Nothing has been deployed; no external service has been written to (HubSpot/Resend never configured; Drive read-only).

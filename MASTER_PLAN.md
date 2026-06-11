# Master Plan — Utility Report Card Web Tool

A lead magnet and data collection tool for ziptility.com, turning the **Utility Health Report Card v2** into an interactive web assessment.

## Context

Ziptility/Mogollon has a finished intellectual asset with no interactive delivery vehicle. The **Utility Health Report Card v2** — a 23-dimension, TMF-organized, F–A graded self-diagnostic for water systems under 10,000 connections — exists as an xlsx workbook (Drive: "Utility Health Report Card v2"), backed by the ~24,000-word white paper *Why Small Water Systems Fail* (Notion: "Why Small Systems Fail" page tree, draft complete) and a full launch-content package (Phase 10 derivative content: press release, LinkedIn posts, newsletter pitches, webinar abstract — all waiting on a URL). The HubSpot CRM was just rebuilt on a governed data model (Identified-floor funnel, `lead_status` New/Working/Qualified, lifecycle Identified→MQL promotion playbooks, `size_tier`/`utility_class`/`account_role` properties). The website is Webflow; this repo is the home for the tool.

**Goal:** an interactive web assessment that (1) generates qualified leads into the revamped HubSpot funnel and (2) builds a proprietary, anonymized small-utility capacity dataset (peer benchmarking → content/PR flywheel → the "Living Map" re-assessment loop).

### Related knowledge bases (Notion — consult during build)

- **Company Brain** — the company-wide knowledge + instruction layer. System (Global Instructions, Taxonomy & Tiers, Hygiene Rulebook), Business (Role Reference Docs incl. CRM Rules & Definitions / Sales Playbook / Marketing Playbook, Jobs-to-be-Done), People. The Report Card asset is cataloged in Jobs-to-be-Done. Its access-tier system (Private/Internal/Stakeholder/Public) governs what the tool may surface publicly.
- **Field Guide — Water/Wastewater Resource Hub** — Ziptility's public operator-reach content program. The Report Card tool is a flagship asset within this program, not a standalone island:
  - **Resource Library** (~2,532 curated resources, Internal tier) — the mine that should resolve the Action Plan Library's resource pointers into specific vetted resources (state RWA, EFCN, RCAP/RCAC, AWWA, EPA links) instead of generic citations.
  - **Field Guide Pages** DB — published topic pages; results pages and action plans should cross-link to relevant Field Guide pillars (and Field Guide pages should CTA back to the Report Card).
  - **Personas & Voice** DB — four audience personas (Operator, Clerk/Admin, Manager, Board) with per-persona voice modulation; these map 1:1 to the tool's role field and should govern assessment/results copy.
  - **Integrity rules apply**: no fabrication, verify every number/citation against primary sources before public, nothing publishes as DRAFT, vendors (incl. Ziptility) are examples not endorsements.
- **SEO & AI-Search Best Practices (2026)** (Company Brain ▸ Business) — governs the landing page and any public results/benchmark content.

**Decisions made (2026-06-11):**
- v1 ships the **full 23-dimension assessment** (not a quick-score version) — requires save-and-resume.
- **Email gate before results**: questions are open to take; email + utility info required before grades are revealed.
- **Custom Next.js app in this repo**, deployed to a subdomain (e.g. `reportcard.ziptility.com`), linked/embedded from Webflow.
- **Own results database + HubSpot sync** (anonymized peer-benchmarking dataset with consent language).

## 1. Product specification

### Assessment flow

1. **Landing screen**: what it is, ~60–90 min estimate, "best completed by operator + clerk + board chair", start free / no account.
2. **Intake**: utility name, state, PWS ID (optional, with SDWIS lookup to prefill connections/population — reuse patterns from the existing HubSpot enrichment toolkit's SDWIS fetch+fuzzy-match), connection count → derives `size_tier`.
3. **23 dimensions** in three sections (Technical T1–T9, Managerial M1–M8, Financial F1–F6). Each dimension presents the five rubric cells (F=Survival, D=Existing Day-to-Day, C=Fairly Stable, B=Very Stable, A=Thriving) as selectable cards with full rubric text; "not sure" allowed but flagged.
4. **Save & resume** at any point via emailed magic link (email captured at save — this is also a lead-capture moment).
5. **Completion gate**: email + name + role required to unlock results.
6. **Results page** — two-track scoring:
   - **Descriptive composite**: F=0…A=4, per-leg average rounded to letter, Overall = mean of three legs.
   - **Diagnostic flag panel**: red-line dimensions (default set of 6: T5 O&M, T7 Compliance, T8 Emergency Prep, F1 Reserves, F2 Rate Adequacy, M8 Workforce — pending open decision A1); any F surfaces a flag.
   - **Practical-grade cap**: 2+ red-line F's → "Practical Grade: D (capped by diagnostic flags)".
   - **One-rung-up panel**: top-3 highest-leverage single-grade improvements (gap × red-line weight × time-to-implement).
   - Peer benchmark placeholders (size tier + state) that activate once the dataset has n ≥ threshold.
7. **Personalized Action Plan PDF** (5–10 pages) emailed + downloadable: pulls matching cells from the 92-block Action Plan Library (23 dimensions × F→D/D→C/C→B/B→A transitions) with resource pointers (state RWA, EFCN, RCAP/RCAC, AWWA M-series, EPA, GFOA) — resolved against the Resource Library where vetted entries exist, and cross-linked to published Field Guide pages.
8. **Re-assessment loop** ("Living Map" mechanic): saved utilities can re-take quarterly/annually; results page shows trend over time. This is the retention/nurture hook and the bridge to Ziptility product conversations.

### Content source

Rubric cell text, dimension definitions, red-line set, and the 92-cell Action Plan Library are extracted from the Report Card v2 workbook into versioned structured content files (JSON/TS) — single source of truth for the app and the PDF.

## 2. Architecture

- **App**: Next.js (App Router) + TypeScript + Tailwind; mobile-friendly but optimized for desktop (board-meeting/laptop context).
- **DB**: Postgres (Neon or Supabase) via Prisma. Tables: `utilities` (pws_id, state, size_tier, connections), `contacts` (email, name, role, consent flags), `assessments` (status, started/completed, rubric version), `dimension_grades` (assessment × dimension × grade + not-sure flag), plus a computed scoring snapshot stored on completion (composites, flags, practical grade) for benchmarking queries.
- **Auth-light**: no passwords; magic-link tokens for save/resume and retrieving past results.
- **PDF**: server-rendered (e.g. `@react-pdf/renderer`) from the same scoring + action-library content.
- **Email**: transactional provider (Resend/Postmark) for magic links + action-plan delivery.
- **Hosting**: Vercel; subdomain `reportcard.ziptility.com`; Webflow site gets a landing/promo page + nav CTA pointing at it.
- **Analytics**: HubSpot tracking code + product analytics (PostHog or GA4) with funnel events (start, section complete, save, gate, results, PDF).

## 3. HubSpot integration (data collection)

On results unlock, server-side API write (service-key pattern per CRM rulebook):

- Upsert **contact** (email, name, role→`account_role` mapping) and **company** (utility, PWS ID, state, `size_tier`, `utility_class`), associate them.
- New custom properties: `report_card_overall`, `report_card_technical` / `_managerial` / `_financial`, `report_card_practical_grade`, `report_card_redline_flags` (multi-select), `report_card_completed_date`, `report_card_url` (results link).
- Funnel placement per the revamped rulebook: lifecycle → Lead/MQL via the engagement-promotion playbook (a completed 90-minute assessment is a strong MQL signal); `lead_status = New`.
- **Sales routing rule**: completion with ≥1 red-line flag or grade ≤ D on F1/F2 triggers an internal notification/task — these are the highest-intent conversations ("your reserves dimension is flagged; here's what the next rung looks like").
- **Nurture**: enroll completions in a sequence built from the existing Phase 10 derivative content (white paper chapters, one-rung-up tips per their weakest leg).

## 4. Build phases

### Phase 0 — Content & decisions (blocker for everything)
- Export rubric + Action Plan Library from the v2 xlsx to JSON.
- Map Action Plan resource pointers to Resource Library entries / Field Guide pages where they exist; apply Field Guide integrity rules (verify citations against primary sources, nothing public as DRAFT, no internal-tier content surfaced).
- Pull tool copy/tone from the Personas & Voice DB (Operator / Clerk / Manager / Board) so per-role framing matches the Field Guide program.
- Confirm with Blake: red-line set (open question A1: 6 vs 4 vs 8), single-severe-F cap rule (A5), consent/anonymization copy, branding (Ziptility-branded vs product-neutral "Living Map Series" framing — the white paper is deliberately product-neutral).

### Phase 1 — Core assessment MVP
- Next.js app, rubric UI, scoring engine (with unit tests against the workbook's documented examples — T6/M8/F5 walkthroughs in white paper Part 2), intake + SDWIS prefill, save/resume magic links, email gate, results page.

### Phase 2 — Lead machine
- HubSpot upsert + properties, action-plan PDF generation + email delivery, sales routing, analytics funnel.

### Phase 3 — Launch
- Webflow landing page + CTAs (per the SEO & AI-Search Best Practices doc), swap `[URL — pending]` into the already-drafted launch package (press release A1, LinkedIn A4/A6, newsletter pitches A7, webinar A8), white paper cross-linking, and reciprocal CTAs from relevant Field Guide pages.

### Phase 4 — Data flywheel
- Peer benchmarks on results page once n is sufficient, re-assessment reminders + trend view, quarterly "State of Small Systems" content from anonymized aggregates, optional state-RWA/circuit-rider facilitation mode.

## 5. Verification

- **Scoring engine unit tests**: leg averaging/rounding, flag panel, 2+ flag cap, one-rung-up ranking — validated against workbook examples.
- **E2E**: complete a full assessment locally (Playwright), confirm gate, results, PDF render, magic-link resume.
- **HubSpot**: test against a sandbox/test contact first; verify property writes and association per CRM rulebook before production keys.

## 6. Known gaps / notes

- The Report Card v2 xlsx lives in Google Drive; Phase 0 content extraction needs the xlsx dropped into the repo (or Drive access granted to the build session).
- "Ops Resources" is a local folder on Blake's machine (referenced from the AWWA-vs-Wisconsin Notion page); relevant material was sourced from the Notion mirrors instead.
- Email-before-results gate is the chosen design; if completion-rate data after launch shows heavy drop-off at the gate, revisit (results-free / PDF-gated variant is the fallback).

# SculptAI v2 functional specification review

Review date: 18 September 2026. Source: Sculpt_AI_Codex_Product_Spec_MVP.docx. This document records the original testing-round scope. On 21 September 2026, the user requested AI Coach setup; the Q&A route was connected locally, while scan analysis and AI meal/workout plans remain future work. See [AI-SETUP.md](../AI-SETUP.md) for current status.

## Implementation decisions before changes

- Keep the existing React 19 / TypeScript / Vinext / Cloudflare D1 app and midnight glass UI. This is not presently a conventional Vercel Next.js deployment; replacing the hosting/database stack is separate work.
- Extend the existing per-member JSON state additively. Normalize missing collections on read and write; preserve existing workouts, plans, and measurements. No destructive SQL migration, no new credentials or environment variables.
- Add pure deterministic adaptation logic in `lib/adaptation.ts`, server-owned actions in `lib/actions.ts`, and UI in `app/adaptive-training.tsx`. Proposed changes carry the original plan and profile fingerprint; stale proposals cannot overwrite newer decisions.
- Receipts are immutable proposals with an append-only decision history. Accept/reject/undo go through the same authenticated, revision-checked service used for workouts. Undo creates a new plan version instead of deleting history.
- Add four-week schedule metadata and frozen inputs to plans, readiness and pain events, explicit consent/screening, weekly reviews, and portable CSV alongside the complete JSON export.
- Disable the Coach endpoint and show a deferred placeholder. No API key setup, provider traffic, or external AI service changes.
- Preserve the existing sign-in for local testing. Email authentication, hosted identity validation, admin authoring, and operational release controls remain explicit gaps rather than simulated integrations.

## Market evidence and product direction

Fitbod already adapts to goals, equipment, time and recovery, and offers workout history and demonstrations: [Fitbod official FAQ](https://fitbod.me/faqs/). Hevy supports routines, workout logging and progress tracking: [Hevy official feature guide](https://help.hevyapp.com/hc/en-us/articles/33106320824727-Everything-You-Need-to-Know-About-the-Hevy-App-2025-Features-Guide). MacroFactor describes adherence-neutral adjustments rather than punitive responses to imperfect adherence: [MacroFactor’s adherence-neutral approach](https://macrofactor.com/adherence-neutral/). Reviewed 18 September 2026.

These features are established expectations. The proposed differentiation is a visible decision trail: small check-ins, explicit evidence sufficiency, previewed adjustments, and reversible choices. This is a product hypothesis, not a claim that no competitor offers explanations or control. User testing should assess whether the receipts improve trust and completion.

## Feature comparison after this testing round

“Implemented” describes local behavior, not public-launch acceptance. AI Q&A remains explicitly deferred.

| Spec | Before this round | Added or improved now | Remaining gap |
| --- | --- | --- | --- |
| FR 01 Account and consent | Sites sign-in and member isolation | Versioned testing terms/privacy/wellness acceptance with timestamps and history | Email magic link/password; production legal notices; optional consent categories/revocation; hosted multi-account verification |
| FR 02 Profile and goals | Adult age, units, goals, experience, days, time, equipment, diet/exclusions, optional measurements | Frozen profile inputs in new plans | Target pace, structured limitation categories and finer equipment preferences |
| FR 03 Safety screen | Adult validation and nutrition eligibility; free-text guide boundaries | Structured clear/guidance/urgent screen; server gates planning/training; urgent flags cannot be cleared through normal screening | Qualified screening/content review; professional clearance workflow; complete safety evaluation before release |
| FR 04 Plan generation | One repeatable week with version history | Four-week suggested dates; frozen inputs/template version; duration estimates with warm-up/rest; volume and movement-pattern validation | Preferred weekday selection; actual attendance/recovery spacing enforcement; richer professionally reviewed templates |
| FR 05 Readiness | Missing | Four core answers: energy, soreness, minutes, pain; optional sleep, soreness area and equipment; saved before each session | Multiple body-area scores; time-zone-aware daily grouping; readiness trends |
| FR 06 Workout execution | Sets, cues, timer, alternatives, partial finish | Explicit warm-up; structured stop-movement/stop-session controls; frozen prescription per new session | Approved exercise-specific demo videos and guided warm-up sequences; substitutions during a running session |
| FR 07 Workout logs | Reps, load, RPE, completion, notes, timestamps | Prescribed-versus-actual preservation and immutable pain reports; skipped remaining sets after pain | Explicit RIR field and technique concern flag; dedicated substitution event history |
| FR 08 Adaptation | Manual shortening and substitutions | Deterministic rules, equipment/time/recovery changes, two-exposure rep progression, pain/effort/insufficient-data holds; preview and confirmation | Smallest-load increments, missed-session calendar reflow, nutrition trend rules; professionally reviewed thresholds |
| FR 09 Trust receipts | Missing | Immutable proposals with before/after prescriptions, rule/version, inputs, confidence, checks and source references where relevant; append-only accept/reject/undo events | Feedback ratings; filtering/pagination; separate append-only database entities if the document model outgrows testing |
| FR 10 Nutrition | Formula-based estimates, preserved inputs, dietary matching and portioned food examples | Weekly meal-framework reflection; no automatic calorie adjustment from readiness | Protein/fiber ranges, explicit pace, intake coverage, conservative weekly energy-range adjustments and their receipts |
| FR 11 Weekly review | Charts and basic consistency counts | Rolling seven-day completion/partial counts, readiness coverage, pain reports, optional weight change, barriers, meal-framework days, saved reflections and receipt access | Calendar-aligned weeks; multiweek recovery trends; confirmed next-week rescheduling |
| FR 12 Evidence Q&A | Built-in guide and dormant provider adapter | Coach tab clearly paused; endpoint returns disabled and imports no provider code | Entire grounded Q&A integration deferred by the user |
| FR 13 Data control | JSON export and confirmed active-record clearing | Complete JSON export includes new collections; CSV contains every record as structured JSON per row | Legal retention policy, hosted backup deletion/restoration rules, provider account deletion |
| FR 14 Admin | No administration UI | Versioned rules in code; no simulated admin interface | Authorized editor, source registry, audited rule/template changes and feature flags |

## What makes this version worth testing

1. A readiness answer does not silently overwrite a plan. The proposed change is visible before acceptance.
2. “Holding steady” is a valid outcome with a reason when evidence is missing or effort is high. Two comparable completed exposures are required for rep progression.
3. Each choice retains its context. Rejection leaves the plan intact. Undo restores a prescription through a new version; completed workouts retain their original prescription. Undo is unavailable while a workout is active or after a later plan change.
4. Pain is a structured event, not a fatigue score. Reporting it stops the relevant movement; urgent symptoms pause the whole session and further training.
5. Five fictional personas make edge cases reproducible without sending demo changes to the member API. Demo state is local to the browser tab and selecting another persona resets that fictional history.

Readiness adjustments currently change the selected session's future prescription. They are not automatically reset the next day. After testing a lighter session, use Undo on the latest receipt when no workout is active, or review/regenerate your plan. Dates are suggestions; the app does not yet reschedule a missed workout or enforce actual recovery spacing.

## Architecture and data decisions

- **Stack:** Retain Vinext, React and D1 for this iteration. The source uses `next/*` imports through Vinext compatibility; that does not make the existing Cloudflare bindings or Sites identity gateway deployable unchanged to Vercel. Choose the final deployment/authentication combination before a hosted release.
- **AI boundary:** `app/api/coach/route.ts` always returns a disabled response. The older provider module is retained for later work and is not imported by this route. Existing provider unit tests use mocks; no live provider requests ran.
- **Adaptation:** `lib/adaptation.ts` is a pure input-to-diff evaluator. The server checks consent, safety, the current plan and a snapshot of profile/readiness/workouts before acceptance. User actions cannot submit arbitrary plan content. The existing member revision and idempotency protections still wrap every change.
- **Sensitive data:** New arrays are added to the existing per-member JSON record. Missing arrays in legacy records normalize to empty lists. No tables or existing migrations are changed, and no user records are rewritten by this task. Receipts and decision events are never edited through application actions; authorized full-data deletion removes them with the rest of the record. This is application-level immutability, not tamper-proof storage against a database administrator.
- **Storage limit:** The existing 1.5 MB member-document limit remains. Receipts include snapshots, so long histories will need normalized database tables and pagination. Export is still available at the limit.
- **Environment:** No new application environment variables, secrets, paid services, or external accounts are required. No production deployment or GitHub push was performed in this round.

## Suggested next priorities after your testing

1. Fix problems you find in onboarding, readiness, workout logging and explanations before expanding features.
2. Choose the hosted stack; implement email authentication, secure deployment identity, backups/restore and documented retention; verify two separate accounts.
3. Add missed-session rescheduling, richer equipment options and approved exercise demonstrations. Keep warm-up and recovery spacing explicit.
4. Add nutrition ranges and sufficient-data rules only after agreeing how users will log intake. A weekly self-report alone is not enough to infer energy needs.
5. Add administration, approved evidence management, accessibility/device coverage and expert review before inviting real beta users.
6. Integrate AI Coach only after your testing approval, through the evidence and safety boundary described in the spec.

## Verification completed

- 41 automated tests passed, including five personas, deterministic output, pain priority, combined readiness constraints, missing-data holds, stale proposal rejection, accept/reject/undo, historical prescription preservation, data normalization, export/deletion and member isolation.
- Eight Chrome browser scenarios passed: unauthorized/forged identity rejection and disabled Coach; four-week/readiness rendering; accept/reject/undo; progression and workout save/pain/refresh recovery; weekly review and both export formats; 360 px and 320 px layouts; fresh onboarding with safety consent and keyboard submissions; no demo account writes and no page runtime errors.
- Oxlint (including configured React/accessibility rules), TypeScript checks and the production build passed. Desktop and phone screenshots were inspected. Build warnings remain for existing large chunks and a future Vite JSON import requirement.
- Browser evidence is in the ignored `outputs/spec-review/browser-results.json` and adjacent screenshots. The scenarios use installed Chrome and fictional data. Safari, Firefox, Edge, offline recovery, assistive-technology conformance and real hosted identities remain unverified.
- Existing provider tests are mocked regressions only; they did not make AI requests. The current Coach endpoint is disabled.

## Engineering notes

A saved workout is a historical record of what was prescribed and what you did. A plan version describes what comes next. Keeping these separate lets Undo restore future training without rewriting completed workouts. The new acceptance tests verify that distinction.

This is a local testing milestone. It is not completion of every acceptance criterion in the MVP specification and is not a public production release.

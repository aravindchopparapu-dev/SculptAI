# SculptAI Version 2 checkpoint · 2026-09-09

The user selected V2. V1 must remain preserved and separately deployed.

## Published baseline

The first functional V2 beta was privately deployed successfully at 12:54 UTC on September 9. Commit: 992fc49307990496b1180bf1416f82c75028b3c3. The live page and optimized model returned HTTP 200; unauthenticated /api/state returned 401. Live D1 binding DB contains members and coach_limits. Bypass access is not a signed-in member identity, so this is not proof of signed-in production writes.

The current update adds sourced meal portions, strength time series, readable mobile chart scales and additional safety checks. Its final deployment is recorded in the root VERSION-COMPARISON.md after release. Never label an unverified deployment complete.

## Implemented

- Sites ChatGPT sign-in/sign-out, adult onboarding, D1 persistence, validation and server-owned records.
- Plan preview/confirmation, historical versions, compatible substitutions and shorter versions.
- Workouts with incremental reps/load/RPE saves, skip/partial completion, notes, previous lifts and rest timer.
- Dated measurement edit/delete, optional body composition, weight trends, workout history, same-repetition strength trends and best lifts. Accessible chart data tables; 7/30-day consistency benchmark at the current schedule.
- Nutrition eligibility, deterministic targets, explicit adoption, preserved inputs and history. Four portioned meal examples with raw/cooked basis and source references. USDA SR Legacy values are estimated food totals; only daily target macros use the 4/4/9 reconciliation rule.
- Built-in guide labelled honestly. Configurable server-side OpenAI adapter, 20 requests/member/hour, timeout and fallback. No API key/model configured. User requested secure setup instructions; AI-SETUP.md is prepared.
- Human asset reduced from 15,479,764 to 1,087,500 bytes (93%). Geometry and rig preserved. Immediate WebP artwork, deferred 3D loading, 30fps cap, hidden/offscreen pause, lower mobile rendering cost and reduced-motion support.

## Verification

- 25 Node tests passed: ownership, idempotency, concurrency, validation, nutrition arithmetic, historical data, strength comparisons, dietary matching, food scaling, model structure and mocked AI behavior. Twelve high-risk prompt examples never reach the provider in tests.
- Lint/type checking and production build passed for the current update. Final release status goes in the root release log.
- Original full 12-step local browser journey passed: sign-in, profile, plan confirmation, set autosave, refresh recovery, completion, measurement, target adoption, coach, responsive tabs and sign-out.
- Six original regression checks passed for mobile 3D separation, reduced motion, CSRF, stale writes, Escape and keyboard navigation.
- Eight new browser checks passed for strength selection/baseline, accessible chart values, scaled portions and nutrients, USDA links and 320px layouts. No page errors. Desktop/phone screenshots inspected; chart label sizing and keyboard skip-link behavior corrected and verified.
- Production dependency audit reported zero advisories on 2026-09-09. Development tooling advisories remain; this is not an exhaustive security audit.

## Remaining external acceptance and release boundaries

1. Connect a real API project securely, select an available model, deploy its environment revision, and evaluate actual provider responses, safety, missing-data handling and latency. Mocks are not live acceptance. The OpenAI Developers plugin is not callable here; see AI-SETUP.md.
2. User sign-in and saved-record acceptance on the hosted website. Local browser tests use synthetic local identity; do not write fixtures into the owner's real hosted account. Two separate hosted identities are required before widening access.
3. Public launch needs operational backup/restore, full security/accessibility review and broader device/network testing. Current member export is available; there is no automatic backup/restore workflow. No native app work yet.

Do not claim the full specification or live AI is complete. This is a private testing beta.

## Resume rules

Read the latest conversation and root VERSION-COMPARISON.md first. Heartbeat build-fitness-app-website is authorized for resumptions. Avoid duplicate releases or fixture runs on unchanged source. Never buy credits, redeem resets, modify V1, or overwrite real user records. Notify only for a meaningful milestone or required action. Pause/delete the follow-up when its reason is complete.

Use bundled Node 24 at C:/Users/aravi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe; system Node 19 is incompatible. Core commands: npm test, npm run lint, npm run build. Local browser scripts require localhost:3001 and refuse unexpected profiles. scripts/test-viewer.cjs shows actual test screenshots at localhost:3002 while running. App browser automation fails to initialize due to missing kernel assets; separate Playwright/Edge works. WebMCP remains unsupported/unverified in this browser.

Data uses a bounded 1.5 MB document per member, prepared D1 queries, revision compare-and-swap and hashed idempotency payloads. Applied migrations must not be edited.

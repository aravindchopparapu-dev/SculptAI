# SculptAI Version 2 development checkpoint

Selected by the user for continued development. Version 1 must be preserved.

## Current milestone (2026-09-09)

- V2 account access through Sites ChatGPT sign-in/sign-out, onboarding, D1 persistence, server validation and ownership checks implemented.
- Training plan preview/confirmation, versioning, compatible substitutions and shorter versions implemented.
- Active workouts, per-set save, skip/partial completion, notes, previous lifts and rest timer implemented.
- Measurement edit/delete, optional body composition, weight trend, workout history, same-repetition best lifts, nutrition targets and history implemented.
- Offline/built-in coaching is honestly labelled. A configurable server-side OpenAI adapter with rate limiting and fallback is implemented and mocked tests pass. Live AI is NOT connected; no API credentials exist in the hosted environment. Never claim this integration is complete.
- Human model repacked from 15,479,764 to 1,087,500 bytes. Geometry/rig unchanged. Background and fallback converted to 98,556 and 77,406 byte WebP. UI paints first; model code loads afterward; rendering skips hidden/offscreen scenes and is capped at 30 fps. Lower DPR and mobile bloom disabled.
- Migration `drizzle/0000_glossy_ironclad.sql` generated; applied to LOCAL DB only. Hosted migration will be applied by Sites packaging/deployment.
- 18 Node tests passed, including adapter failure/privacy tests. TypeScript and lint passed. The 12-step browser journey and 6 targeted regression checks passed on the updated packages. Desktop and 320px phone screenshots were inspected; the phone overlap was fixed. Reduced-motion, keyboard controls, sign-out, cross-origin denial and stale-revision handling passed. Final production build passed. Private deployment is the current next step.
- Browser automation tools in the app fail to initialize with missing kernel assets. Local Playwright/Edge headless runner works. Live screenshot viewer is http://localhost:3002 while scripts/test-viewer.cjs is running. App preview http://localhost:3001.
- Existing hourly heartbeat `build-fitness-app-website` updated to continue this thread after usage resets. No credit purchase or reset redemption authorized/performed. Pause it when development/testing is actually complete.

## Remaining before declaring the full spec complete

1. First functional beta browser testing is complete. Actual 3D rendering was confirmed; the local asset transfer was about 150 ms (not a hosted-network or universal device performance guarantee). WebMCP is unsupported in the available test browser and remains unverified.
2. Lint/build passed; privately deploy to existing V2 project. Preserve V1 commit and deployment. No new Site project.
3. Activate the prepared live AI adapter through authorized OPENAI_API_KEY secret provisioning and OPENAI_MODEL selection. Real provider acceptance is unverified; mock tests cover failure/privacy/response handling. This is an external setup dependency.
4. Further spec coverage: quantified ingredient/portion meal templates, strength time-series and more thorough coaching evaluations. Current plate ideas intentionally have no fabricated calorie totals.
5. Production operations and multi-user hosted identity acceptance require further work before public release. This is a private testing beta.

## Runtime and verification

Use bundled Node 24: `C:/Users/aravi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`. System Node 19 is incompatible. Scripts: `node --experimental-strip-types --test lib/member.test.ts lib/studio.test.ts`, TypeScript noEmit, oxlint, npm run build. Browser runner uses bundled Playwright and installed Edge. It only mutates the local Seedy account after verifying it is empty or contains its own `SculptAI QA` fixture. Never run that runner against production or delete real user records.

Data uses one bounded document per user for the private MVP, with raw D1 prepared statements, revision-based compare-and-swap, and hashed idempotency payloads. Before widening access, consider normalized history tables and operational backups; current member export provides a portable copy. No payment or third-party AI request costs are incurred by the built-in guide.

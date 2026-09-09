# SculptAI Studio / 02

Version 2 is the selected product direction. Version 1 remains a separate, preserved website.

## Private testing beta

ChatGPT sign-in identifies the member. The server validates every write and reads only that member's D1 document. Profile, plan versions, measurements, workouts, and adopted nutrition targets survive browser refreshes. A revision check prevents one tab silently overwriting another; repeated network requests use an idempotency identifier.

The interface keeps the approved midnight glass styling and real rigged 3D athlete. The model is 1,087,500 bytes, down from 15,479,764 bytes. Artwork totals about 176 KB. Original source assets are preserved in assets/source and excluded from the served public assets. Animation is deferred until the interface paints, capped at 30 fps, and skips hidden/offscreen rendering. Reduced motion and data saver are respected. Device GPU capability still affects performance; no universal zero-lag guarantee is made.

## Member journeys

- Sign in / sign out, adult onboarding, editable preferences, unit conversion, data export, confirmed removal of all app data.
- Review and adopt deterministic training plans, retain versions, substitute compatible exercises, prepare shorter sessions.
- Start/resume a workout, save reps/load/effort, skip sets, run a rest timer, finish complete or partial, review prior lifts and history.
- Add/edit/delete dated check-ins, view weight trends, same-repetition strength time series, accessible values, schedule benchmarks and best lifts.
- Review and adopt nutrition estimates with eligibility checks, preserved inputs, method and source links. Four portioned meal examples use an eight-food USDA SR Legacy reference subset, explicit raw/cooked weights, diet/exclusion matching and scaled estimated totals. They are examples, not a daily food log or therapeutic menu.
- Use the built-in guide with real saved context. A server-side OpenAI Responses adapter is prepared, bounded to 20 requests per member/hour, with a 15-second timeout and safe fallback. No live provider is configured or verified yet. Neither the guide nor provider can mutate member data.

## Run and validate

Use Node 22.13+ (this workspace uses bundled Node 24), npm ci, then npm run dev -- --port 3001. Use npm test, npm run lint, and npm run build. Types are checked by the configured lint pipeline; TypeScript noEmit is also available.

Generate schema migrations with npm run db:generate. Local initialization uses Wrangler d1 execute DB --local --persist-to .wrangler/state --file drizzle/0000_glossy_ironclad.sql with the development D1 binding configuration. Never execute local fixture scripts against production. Sites applies packaged Drizzle migrations on deployment; previously applied migrations are immutable.

scripts/browser-journey.cjs runs the local UI journey with a clearly named SculptAI QA fixture and refuses to overwrite other local profiles. scripts/browser-regression.cjs covers phone separation, keyboard controls, stale writes and cross-origin requests. scripts/test-viewer.cjs serves actual test screenshots at localhost:3002. scripts/browser-insights.cjs covers strength selection, accessible tables, meal scaling, source links and phone layouts. Test outputs are ignored and never published.

## AI setup and privacy

See [AI-SETUP.md](AI-SETUP.md) for the secure connection steps requested by the user. No key, billing setup or real provider test has been performed.

Provision OPENAI_API_KEY as a secret and OPENAI_MODEL as a model ID through an authorized Sites environment-variable workflow. These are optional and must never be exposed in browser code, source, messages or Git. An empty configuration uses only the built-in guide. Live integration acceptance requires a real configured account and explicit live testing; mocked adapter tests are not evidence of a live connection.

AI context excludes names, emails, age, sex, raw measurement history and free-text notes. It includes goal/equipment, current plan, recent completed sets and eligible adopted nutrition targets. Provider response storage is disabled, which does not imply absence of provider operational retention. The app stores no AI conversation history.

## Architecture and limits

app/member-studio.tsx coordinates the visible journey; separate form/workout/insight/fuel components keep the interface maintainable. lib/fitness.ts and lib/actions.ts hold deterministic rules. lib/repository.ts uses raw D1 prepared statements and compare-and-swap. app/athlete-scene.tsx owns the isolated GPU renderer and resource cleanup.

The private MVP uses one bounded member document (1.5 MB history cap). Export provides a portable backup; automated backup/restore and normalized history tables need evaluation before a wider launch. Personal records are not shared between V1 and V2. Multi-account isolation is tested through the repository; hosted multi-user acceptance needs separate identities before sharing beyond the owner.

A small read-only WebMCP summary tool is feature-detected. The available test browser does not support WebMCP, so that contract is unverified; it is not necessary to the normal member journey.

Framework security fixes upgraded React/React DOM/RSC to 19.2.8, Vinext to beta.9, Vite to 8.2.2 and the RSC plugin to 0.5.34. Undici is pinned to 7.29.1. The production dependency audit reports zero advisories on 2026-09-09; development tooling still reports advisories and is not part of the deployed Worker. This is not a full security audit or public production readiness claim.

## Assets

Quaternius Superhero Male from Universal Base Characters, CC0 1.0. Creator: https://quaternius.com/packs/universalbasecharacters.html. Official download: https://quaternius.itch.io/universal-base-characters. License retained in public/LICENSE-athlete.txt. Original generated gym and athlete artwork is preserved alongside optimized WebP copies. The athlete animation is an illustrative movement study, not validated biomechanics or form assessment.

## Release

Keep the existing V2 Sites identity in .openai/hosting.json. Build, commit, push, package and privately deploy through Sites. Retain the previous version for rollback. Never repoint this checkout to V1. Deployment and acceptance results are tracked in DEVELOPMENT.md and the root VERSION-COMPARISON.md.

## Reference data

lib/food-data.ts is generated by scripts/import-food-data.py from the official USDA FoodData Central SR Legacy April 2018 CSV archive. It retains exact FDC identifiers, per-100g values, publication date, archive URL and SHA256. Food totals are estimated from these source values; they are not forced to match target macro energy calculations. The large source archive remains in ignored local outputs; only the eight needed records ship.

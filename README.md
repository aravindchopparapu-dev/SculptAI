# SculptAI

SculptAI Version 2 is the active product. The former Version 1 app is retired.

## Current features

- Member sign-in, required profile/body metrics, target weight and profile photo.
- AI Coach grounded in the signed-in member's saved profile, current measurements and goals.
- Readiness checks before personalized workout generation, muscle-group selection plus Cardio and HIIT, saved workouts, deletion and regeneration. Workout logging is outside the current UI scope.
- Fuel targets based on profile and check-ins, target history and an on-demand explanation of the calculations.
- Meal plans using saved breakfast, lunch and dinner foods, optional snacks, editable choices and explained food suggestions. Familiar serving units are used where appropriate.
- Insights with the profile starting weight as the baseline, persistent tab navigation and a 3D studio.

## Run locally

Use Node 22.13 or later. In the VS Code terminal, run:

```sh
pnpm install --frozen-lockfile
pnpm dev --port 3001
```

Open http://localhost:3001/. The parent folder also contains Start SculptAI.command.

## Validate

```sh
pnpm test
pnpm exec tsc --noEmit
pnpm run lint
pnpm run build
```

See docs/TESTING-GUIDE.md for browser checks. Some older scripts test retired flows; do not seed test fixtures into real member accounts.

## AI and member data

Store OPENAI_API_KEY only in ignored local environment files or hosted server secrets. OPENAI_MODEL optionally overrides the configured default. See AI-SETUP.md. Never commit API keys, local databases or account exports.

Local development and Sites have separate D1 databases. Deploying code preserves hosted records; it does not upload local profiles. The server validates member writes and uses revision checks to prevent stale overwrites. The current bounded member document is intended for private testing; broader release needs operational backup/restore and multi-user acceptance.

## Publishing

Use the existing V2 project in .openai/hosting.json and preserve its access settings. Build and verify the source, then publish through the Sites workflow. GitHub source is maintained at https://github.com/aravindchopparapu-dev/SculptAI. GitHub and Sites use separate source histories; a GitHub push alone does not update Sites.

Applied database migrations are immutable. The retired V1 app is not a dependency of this project.

## Admin Control Centre

Open `/admin` after signing in as the configured owner. The Admin page and every Admin API request check the trusted authenticated user on the server against `SCULPTAI_ADMIN_USER_ID` or `SCULPTAI_ADMIN_EMAIL` in the server environment. Without a configured owner, access is denied. Do not add those identifiers to client code or use a browser-only check as authorization.

The centre offers a private overview, feature switches, a member notice, and additional guidance for Coach answers, workout plans and meal plans. Save a draft, test it with fictional profiles, then publish it. The live endpoints read only the published version. The core safety and output rules remain in source code. Older published control versions can be loaded into a new draft for review. Preview calls use the server's existing AI key and may consume API credit; no real member data is sent by the preview.

`GET /api/v1/app-config` exposes only the published version, feature availability and member notice for website and future native clients. Admin writes and previews use `/api/admin/v1/*` and require the owner's authenticated session, same-origin requests and server authorization. Future iOS member authentication must be integrated separately before it can call member APIs; this configuration endpoint does not grant member or admin access.

The additive `0001_flaky_sleeper.sql` migration stores controls and release history without changing member rows. Run this migration in an existing local D1 database before opening `/admin`; Sites applies packaged migrations during deployment. The centre does not expose API keys, member health details or OpenAI billing totals.

## Assets

Quaternius Superhero Male from Universal Base Characters, CC0 1.0. Creator: https://quaternius.com/packs/universalbasecharacters.html. Official download: https://quaternius.itch.io/universal-base-characters. License retained in public/LICENSE-athlete.txt. Original generated gym and athlete artwork is preserved alongside optimized WebP copies. The athlete animation is an illustrative movement study, not validated biomechanics or form assessment.


## Reference data

lib/food-data.ts retains the USDA FoodData Central SR Legacy records used by the reference meal calculations. AI meal estimates and suggested serving sizes are estimates; branded product labels can differ. Asset attribution and source references remain in the repository.

# Current checkpoint — 2026-09-22

Version 2 is the only active SculptAI product. The user's request to remove V1 supersedes earlier preservation instructions.

Current functionality is summarized in README.md. docs/SPEC-IMPLEMENTATION.md is a historical specification comparison; docs/TESTING-GUIDE.md describes testing. Do not interpret older QA fixture scripts as authorization to replace member records.

## Release and data boundaries

- Keep the V2 Sites identity in .openai/hosting.json and its existing private audience.
- GitHub and Sites source are published separately. Record completed deployments only after the native deployment status succeeds.
- Configure AI credentials as server secrets. Never include environment files, local D1 state or exports in source or deployment archives.
- Local and hosted databases are separate. Source deployment does not copy local member data.
- Preserve member records and applied migrations. Do not add fixtures to the owner's account.
- Workout logging is not part of the current user-facing scope.

## Validation

Run pnpm test, pnpm exec tsc --noEmit, pnpm run lint and the production build. Use isolated browser contexts and intercepted writes for local smoke tests. Provider mocks do not establish live AI acceptance, and local identity tests do not establish hosted sign-in acceptance.

## Remaining acceptance

The owner should sign in to the published V2 and test saved profile, workout and meal generation with their own data. Broader sharing needs multi-user isolation acceptance, backup/restore and a current security review. The current release remains private.

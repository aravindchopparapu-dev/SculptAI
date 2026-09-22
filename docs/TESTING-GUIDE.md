# SculptAI v2 testing guide

Open http://localhost:3001/?demo=1 for fictional demo data. Open http://localhost:3001/ for the existing local app. The Mac launcher remains `Start SculptAI.command` in the parent project folder.

The running preview is local to this Mac. The local Sites sign-in is a synthetic development identity, not verified hosted ChatGPT or email authentication. Your GitHub repository and any existing deployed website have not been updated by these local changes.

## Suggested test order

1. Select **Returning beginner**, then **My training**. Save energy, soreness, time and pain answers. Choose **Review session suggestion**. With little workout history, expect **Holding steady**.
2. Select **Low energy day**. Review the preloaded check-in suggestion. Confirm that the proposal leaves your plan unchanged until **Accept change**. Test **Undo this change** and **Reject suggestion**; inspect the inputs and decision history.
3. Select **Experienced lifter**. The fictional history has two comparable completed sessions. Review a modest rep increase and confirm only one movement changes.
4. Start a workout, enter reps/load/RPE, complete a set and refresh. Return to **My training** and verify the saved set. Finish early and look for a partial workout in **Insights**.
5. In a fictional workout, open **Report pain and stop this movement**. Verify the movement stops while completed sets stay in history. Urgent symptom testing pauses all training for that fictional profile; select a different demo persona to reset fictional data.
6. Open **Weekly review**, record a barrier and meal-framework days, then save. Missing weight or intake data must remain unknown, not become invented trends or calorie changes.
7. Open **Account & data** and download JSON and CSV. The CSV has a record type, ID and JSON data column, so nested plans and receipts are preserved rather than flattened incompletely.
8. Open **Coach** in demo mode. It should explain that fictional data is not sent to the AI service. In a signed-in account with a profile, ask a normal question; answers show whether they came from Connected AI Coach or the Built-in Guide.
9. Try the phone layout. Check that fields are easy to reach and that suggestions, differences and status labels are understandable.

Selecting a different demo persona replaces only the fictional data in that tab. Demo data is saved in session storage, survives refresh, and may be cleared by closing the tab. It never syncs to the member account.

For a fresh onboarding test, use **Account & data → Delete my data** while the fictional demo banner is visible. Set up a new fictional profile. **My training** should say the AI plan is coming later and show no workout cards or logs. **Add body measurements** opens Insights; manual measurements can be saved there. InBody scan upload, body composition estimates, and AI generated meal and workout plans are not available yet. The other demo personas still contain clearly labeled fictional plans for testing the earlier training features.

## Feedback to capture

Record the page, the action, what you expected and what happened. Useful product questions: Did the check-in feel quick? Could you explain why the plan changed? Was the difference easy to compare? Did “holding steady” feel trustworthy? Could you find undo, history and export?

## Verification commands

From `sculptai-v2`, with Node 22.13 or newer on PATH:

```sh
node --experimental-strip-types --test lib/*.test.ts
node node_modules/oxlint/bin/oxlint
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vinext/dist/cli.js build
```

The automated Chrome walkthrough is `scripts/browser-spec.cjs`. It requires Playwright available through Node resolution or `NODE_PATH` and the local preview at port 3001. It defaults to installed Google Chrome on macOS; set `SCULPTAI_CHROME` for a different executable. It uses fictional demo storage and never writes fixture data into the member account. Output and screenshots go to the ignored `outputs/spec-review` directory.

Older browser scripts predate this spec round and still refer to the former coach behavior and Windows runtime paths. Use `browser-spec.cjs` for this round.

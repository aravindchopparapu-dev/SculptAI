# SculptAI session planning evidence

Reviewed 2026-09-24. These notes inform the shared website/iPhone workout generator; they are not a clinical prescription.

## Findings used

- [ACSM 2026 resistance training position stand summary](https://acsm.org/resistance-training-guidelines-update-2026/) synthesizes 137 reviews. Match programming to goals and ability, build gradually, and prioritize adherence. Its roughly 10 sets per muscle recommendation for hypertrophy is **weekly**, not a requirement to perform 10 sets in every session. Available time alone does not determine useful training volume.
- [IUSCA 2021 position stand](https://journal.iusca.org/index.php/Journal/article/download/81/140/5323) supports complementary movement angles and multi-/single-joint work. It suggests approximately 10 sets per muscle per session as a practical volume limit, while acknowledging uncertainty and individual differences. It recommends generally longer rest for multi-joint work and shorter rest for isolation. The athletic population focus limits generalization to beginners.
- [Singer et al. 2024 rest-interval meta-analysis](https://pubmed.ncbi.nlm.nih.gov/39205815/) found substantial uncertainty and a small possible benefit for rests over 60 seconds, without appreciable additional hypertrophy differences above 90 seconds. Rest should preserve performance; it should not be artificially expanded or removed to hit an exercise count.
- [Nunes et al. 2022 exercise-variation systematic review](https://pubmed.ncbi.nlm.nih.gov/35438660/) examines variation in resistance exercise selection. SculptAI uses purposeful movement coverage rather than assuming that more distinct names are always better.

## Product interpretation and limits

`lib/workout-prescription.ts` derives a conservative session contract from today's minutes, energy, sleep, soreness, equipment, selected groups and profile experience. The 30/45/60-minute recommendations, 70% duration review threshold, exercise-count targets, and set limits are transparent product heuristics, not research-established medical cutoffs. Readiness scores are subjective. Coach must explain a recommendation without declaring the requested duration inherently unsafe.

Low readiness lowers both recommended time and volume. A beginner or narrowly focused session can finish earlier. Well-recovered longer requests should include useful complementary work, adequate sets and rest. Underfilled sessions require a specific explanation; unconstrained, undersized plans are corrected once before returning an error. Time estimates include a conservative warm-up/rest/transition allowance and are approximate.

The generator does not infer loads from weight/body fat, invent missing measurements, treat saved plans as completed workouts, or assume unknown weekly volume. Pain continues to block generation. Admin custom guidance remains editable, while the current session contract and fixed rules are appended at execution and visible in Admin. Exact legacy defaults upgrade to the new defaults without overwriting custom text.

## Verification

Automated cases cover duration and equipment limits, complementary coverage, 90-minute versus short requests, readiness reductions, beginner limits, per-group/total volume, bounded correction, stale Admin guidance, and account-independent fictional inputs. Live model checks use fictional profiles and never save workouts to a real member account.

# SculptAI Studio / 02

A separate visual prototype for comparing with SculptAI Version 1. Version 1's source, deployment, data and site identity remain unchanged.

## Experience

- Detailed textured human character with a 65-joint rig and roughly 14,000 triangles across body, eyes and eyebrows.
- Three animated movement studies: dumbbell curls, goblet squats and shoulder presses. Procedural poses preserve the original skeletal bind transforms; leg and arm inverse kinematics position joints for the squat and press.
- Original generated futuristic studio and athlete artwork, used in the page and as a fallback when 3D is unavailable.
- Real-time Three.js rendering: physical materials, custom compression-clothing shader, environment reflections, directional shadow, cyan/purple rim lights, restrained bloom, luminous platform and atmospheric points.
- SwiftUI-inspired web interface using translucent materials, segmented controls, sheets, dialogs, activity rings and immersive layout. This is a React/TypeScript website; it is not native SwiftUI.
- Interactive temporary nine-set sample workout, switchable sample insight periods, meal examples and an explicitly disconnected coach preview.

## Scope

This release is for choosing a design direction. All fitness data is illustrative and labeled. Session state lasts only while this page is open; nothing is saved as real fitness history. No health measurements, authentication records or live AI calls are collected by this prototype. The private Sites access gateway controls who can view the concept. Backend product completion and browser/device testing follow the user's choice of version.

The movement is a visual study, not a validated exercise technique demonstration. Sample loads are not individual prescriptions. The illustrative readiness score is not a medical or physiological assessment.

## Run and check

Use Node 22.13 or newer, `npm ci`, then `npm run dev -- --port 3001`.

- `node --test lib/studio.test.ts`
- `node node_modules/typescript/bin/tsc --noEmit`
- `npm run lint`
- `npm run build`

Meaningful checks cover nine-set completion, exercise transitions, idempotent finish, and real skinned-human asset integrity. A non-browser HTTP request verifies the main route renders. Full visual/device/browser testing is deferred until the user chooses a design, as requested. A production build does not validate animation biomechanics or guarantee browser frame rate.

## Assets and attribution

Human character: Quaternius **Superhero Male**, Universal Base Characters, CC0 1.0. [Creator](https://quaternius.com/packs/universalbasecharacters.html), [official download](https://quaternius.itch.io/universal-base-characters). License is retained at `public/LICENSE-athlete.txt`. GLB contains all textures; original broken texture references were resolved while packaging. Clothing is an application shader over the original mesh. The original character has a stylized muscular build, not a scan of a real person.

`public/studio-art.png` and `public/athlete-art.png` are original AI-generated artwork. They are visual assets, not representations of actual user data. The fallback portrait is separate from the interactive human mesh.

## Architecture and limits

`app/future-studio.tsx` composes the screens and temporary demo session. `lib/studio.ts` owns the small deterministic demo flow. `app/athlete-scene.tsx` owns the isolated GPU renderer, rig animation and resource cleanup. It is lazy-loaded so the main interface need not wait for the 3D code. Pixel ratio is bounded on smaller screens, motion respects reduced-motion preference, and a generated image remains usable if WebGL fails. High graphical quality increases initial download and GPU cost; the embedded model is approximately 15 MB.

The inherited Sites starter includes dependencies not required by this visual prototype; they were retained rather than rewritten. Its npm audit reported 14 advisories (6 moderate, 8 high) in the dependency graph. Dependency remediation and a complete security review remain part of production hardening before collecting real data. The prototype has no application database or model secrets.

Lint excludes untouched vendored starter primitives and its mobile hook. React Compiler diagnostics are disabled because React Compiler is not enabled; native image tags and gateway-safe/native navigation are deliberate. Application correctness, type checks and remaining accessibility lint are enabled.

## Preservation and deployment

Version 1: https://sculptai-fitness-workspace.aravindchopparapu-ch.chatgpt.site

Version 2 has its own `.openai/hosting.json` identity and its own Git repository. Build, package, save and privately deploy through Sites. Do not point this checkout at Version 1 or migrate Version 1's records into this concept. A user's later choice should determine which codebase receives the full product work.

# SculptAI for iPhone

Native SwiftUI companion for the existing SculptAI account and backend. The Xcode project supports iOS 18+, with native Liquid Glass buttons and system navigation on iOS 26+. It contains no OpenAI API key. Edit the Swift sources in VS Code; use Xcode for device signing and Simulator builds.

## Open and run

1. Install Xcode and an iOS Simulator runtime. If prompted, review Xcode’s license with `sudo xcodebuild -license`. This Mac is already configured.
2. Open `ios/SculptAI.xcodeproj` in Xcode.
3. Choose the **SculptAI** scheme and an installed iPhone Simulator; press Run.
4. For a physical iPhone, select your Apple development team under Signing & Capabilities, connect the phone, and select it as the destination.
5. In the app, choose **Create account** or **Sign in to existing account**. The secure system sign-in sheet uses the same ChatGPT account system as the website. Choose **Continue to SculptAI app** after authentication. The app returns automatically, loads existing records, and opens native profile setup for a new member. A manual connection code remains available as a fallback.

Pairing page: https://sculptai-v2-future-studio.aravindchopparapu-ch.chatgpt.site/connect
Website: https://sculptai-v2-future-studio.aravindchopparapu-ch.chatgpt.site/

Command-line build after Xcode setup:

```sh
xcodebuild -project ios/SculptAI.xcodeproj -scheme SculptAI \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ios/DerivedData CODE_SIGNING_ALLOWED=NO build
```

To run tests, replace the generic destination with an installed Simulator, for example a simulator ID returned by `xcrun simctl list devices available`, and use `test` instead of `build`.

## Native experience

- Studio: your saved starting/current/target weights, today’s training entry, check-ins, and Fuel target.
- Training: readiness before muscle selection; up to four groups including Cardio and HIIT; AI generation, review, save, collapse, delete, and regeneration. No workout logs.
- Fuel: current maintenance and goal calories, macros, timeline, AI explanations, editable meal foods, meal generation, practical portions, and explained additions.
- Insights: profile starting weight as point zero, followed by dated check-ins.
- Coach: native chat and built-in prompts that call the shared AI service.
- Account: create account / sign in using the system browser, automatic profile setup for new members, manual pairing fallback, profile editing, refresh, and device disconnect.

The app starts without fictional member records. Connecting loads the existing account. It does not generate plans on signup. Cached records are read-only while the service is unreachable; writes and AI generation require a connection. New account data and full onboarding are validated by the same server as the website.

## Security and storage

A 10-minute pairing uses a random device secret, a human-readable code, and explicit approval in an authenticated web session. Only a SHA-256 hash of the device secret is stored. The app sign-in flow keeps the device secret on the phone, validates a unique callback state, and accepts only its fixed callback destination. It does not collect account passwords. The device exchanges approval once for a 30-day member session. Only the session hash is stored on the server; the token is held in iOS Keychain with `WhenUnlockedThisDeviceOnly` protection. Native sessions cannot access Admin or approve other devices. Disconnect attempts server revocation and always clears the Keychain token and local cached records.

The local snapshot uses iOS complete file protection and is excluded from backup. No key or token is stored in source, application assets, UserDefaults, or logs. The app reads published feature switches and the same AI Coach instructions used on the website. API keys remain on the server.

The backend’s additive `0002_cool_mastermind.sql` migration creates `mobile_pairings` and `mobile_sessions`. Existing member and admin rows are preserved. A privately gated Site cannot be called by URLSession; its public entry point must be enabled while member endpoints continue to require authentication.

## Design and verification

Native tabs and navigation, semantic typography and colors, accessible control labels, opaque content cards, and restrained glass actions. System glass/material controls adapt to accessibility settings. The app supports both system appearances; its Studio artwork is bundled to avoid a network image flash. Exercise guide photos come from the existing licensed project library; unsupported movements display written cues without invented animation.

Backend unit and browser integration checks cover pending/approved pairing, anonymous denial, replay denial, expiry, revocation, member reads, and Admin denial. The project also includes native model tests and a navigation UI test.

Development build verified with Xcode 27 and the iOS 27 iPhone 18 Pro Simulator. The app and test targets compile; native tests exercise model validation, baseline/current-weight handling, backend decoding, all five tabs, account presentation, Studio control bounds, and live pairing initiation/pending approval. Simulator inspection caught and corrected Studio artwork widening the page and a truncated account heading. All five native tests passed on 2026-09-22, including strict callback destination/state validation. All 75 backend tests also passed. Browser checks verified app continuation, token exchange, and revocation. Studio was visually checked in dark mode and light mode with accessibility-medium text. The live pairing check requires network access and creates an unapproved, expiring code without modifying member records. The preview uses `serve-sim` because this Xcode installation does not include the standalone Simulator application. This remains a development build, not an App Store release. Before distribution, complete real-device account pairing and AI flow checks, large-text and VoiceOver testing, signing, privacy disclosure review, screenshots, and TestFlight validation.

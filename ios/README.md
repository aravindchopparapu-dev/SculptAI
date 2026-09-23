# SculptAI for iPhone

Native SwiftUI companion for the existing SculptAI account and backend. The Xcode project supports iOS 18+, with native Liquid Glass buttons and system navigation on iOS 26+. It contains no OpenAI API key. Edit the Swift sources in VS Code; use Xcode for device signing and Simulator builds.

## Open and run

1. Review and accept Xcode’s license on this Mac: `sudo xcodebuild -license`.
2. Open `ios/SculptAI.xcodeproj` in Xcode.
3. Choose the **SculptAI** scheme and an installed iPhone Simulator; press Run.
4. For a physical iPhone, select your Apple development team under Signing & Capabilities, connect the phone, and select it as the destination.
5. In the app, open Account → Get my connection code. Open the pairing page, sign into your SculptAI website account, enter the displayed code, and approve it. Return to the app and choose “I approved this iPhone”.

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
- Account: secure pairing, profile editing, refresh, and device disconnect.

The app starts without fictional member records. Connecting loads the existing account. It does not generate plans on signup. Cached records are read-only while the service is unreachable; writes and AI generation require a connection. New account data and full onboarding are validated by the same server as the website.

## Security and storage

A 10-minute pairing uses a random device secret, a human-readable code, and explicit approval in an authenticated web session. Only a SHA-256 hash of the device secret is stored. The device exchanges approval once for a 30-day member session. Only the session hash is stored on the server; the token is held in iOS Keychain with `WhenUnlockedThisDeviceOnly` protection. Native sessions cannot access Admin or approve other devices. Disconnect attempts server revocation and always clears the Keychain token and local cached records.

The local snapshot uses iOS complete file protection and is excluded from backup. No key or token is stored in source, application assets, UserDefaults, or logs. The app reads published feature switches and the same AI Coach instructions used on the website. API keys remain on the server.

The backend’s additive `0002_cool_mastermind.sql` migration creates `mobile_pairings` and `mobile_sessions`. Existing member and admin rows are preserved. A privately gated Site cannot be called by URLSession; its public entry point must be enabled while member endpoints continue to require authentication.

## Design and verification

Native tabs and navigation, semantic typography and colors, accessible control labels, opaque content cards, and restrained glass actions. System glass/material controls adapt to accessibility settings. The app supports both system appearances; its Studio artwork is bundled to avoid a network image flash. Exercise guide photos come from the existing licensed project library; unsupported movements display written cues without invented animation.

Backend unit and browser integration checks cover pending/approved pairing, anonymous denial, replay denial, expiry, revocation, member reads, and Admin denial. The project also includes native model tests and a navigation UI test.

Initial implementation status: Xcode compilation and Simulator checks are pending license acceptance on this Mac. Do not treat this as an App Store release. Before distribution, complete real-device account pairing and AI flow checks, large-text and VoiceOver testing, signing, privacy disclosure review, screenshots, and TestFlight validation.

import XCTest
@testable import SculptAI
final class SculptAITests: XCTestCase {
    func testAccountTokenCanBeSavedAndReadOnDevice() throws {
        let testService = "com.sculptai.ios.keychain-tests"
        defer { Keychain.clear(service: testService) }
        let marker = UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased()
        try Keychain.save(marker, service: testService)
        XCTAssertEqual(Keychain.read(service: testService), marker)
    }
    @MainActor func testSignInCallbackRequiresMatchingStateAndFixedDestination() {
        let state = UUID().uuidString
        XCTAssertTrue(NativeAccountSignIn.validCallback(URL(string: "sculptai://auth-complete?state=\(state)"), state: state))
        for address in ["sculptai://auth-complete?state=wrong", "https://auth-complete?state=\(state)", "sculptai://evil?state=\(state)", "sculptai://auth-complete?state=\(state)&state=other"] {
            XCTAssertFalse(NativeAccountSignIn.validCallback(URL(string: address), state: state))
        }
        XCTAssertFalse(NativeAccountSignIn.validCallback(nil, state: state))
    }

    func testMissingBodyMetricsCannotSave() {
        var profile = MemberProfile(); profile.name = "Test"; profile.height = 175
        XCTAssertNotNil(profile.validationMessage)
        profile.weight = 80; profile.targetWeight = 75
        XCTAssertNil(profile.validationMessage)
        profile.targetWeight = 40
        XCTAssertNotNil(profile.validationMessage)
    }
    func testCurrentWeightUsesCheckInButStartingWeightIsPreserved() {
        var state = MemberState(); var profile = MemberProfile(); profile.weight = 80; state.profile = profile
        state.metrics = [BodyMetric(id: "1", date: "2026-09-20", weight: 79, source: "Manual", notes: ""), BodyMetric(id: "2", date: "2026-09-18", weight: 79.5, source: "Manual", notes: "")]
        XCTAssertEqual(state.currentWeight, 79)
        XCTAssertEqual(state.profile?.weight, 80)
    }
    func testRequiredBackendEnvelopeDecodes() throws {
        let data = Data(#"{"revision":0,"state":{"profile":null,"plans":[],"metrics":[],"targets":[],"sessions":[]}}"#.utf8)
        let value = try JSONDecoder().decode(MemberSnapshot.self, from: data)
        XCTAssertEqual(value.revision, 0)
        XCTAssertNil(value.state.profile)
        XCTAssertTrue(value.state.plans.isEmpty)
    }
    func testExistingProfileCanSaveWithoutRepeatingConsent() {
        XCTAssertTrue(canSaveProfile(requiresSafetySetup: false, consent: false, busy: false, profileChangedElsewhere: false))
        XCTAssertFalse(canSaveProfile(requiresSafetySetup: true, consent: false, busy: false, profileChangedElsewhere: false))
        XCTAssertTrue(canSaveProfile(requiresSafetySetup: true, consent: true, busy: false, profileChangedElsewhere: false))
        XCTAssertFalse(canSaveProfile(requiresSafetySetup: false, consent: false, busy: false, profileChangedElsewhere: true))
    }
    func testSafetySetupIsOnlyNeededUntilTheSavedConsentAndCheckExist() throws {
        let noSafety = try JSONDecoder().decode(MemberSnapshot.self, from: Data(#"{"revision":1,"state":{"profile":null,"plans":[],"metrics":[],"targets":[],"consents":[],"safetyScreens":[]}}"#.utf8))
        XCTAssertTrue(noSafety.state.needsSafetySetup)
        let completed = try JSONDecoder().decode(MemberSnapshot.self, from: Data(#"{"revision":2,"state":{"profile":null,"plans":[],"metrics":[],"targets":[],"consents":[{"version":"testing-2026-09-18"}],"safetyScreens":[{"status":"clear"}]}}"#.utf8))
        XCTAssertFalse(completed.state.needsSafetySetup)
    }
}

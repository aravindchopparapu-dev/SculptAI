import Foundation
import Observation

@MainActor @Observable final class SculptStore {
    var state = MemberState()
    var revision = 0
    var connected = false
    var busy = false
    var error: String?
    var lastSynced: Date?
    var messages: [ChatMessage] = []
    var configuration: AppConfiguration?
    let service = AccountService()
    private let cacheURL: URL
    private var pendingChange: (data: Data, operationID: String, revision: Int)?
    init() {
        var cacheName = "member-cache.json"
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--ui-testing") { Keychain.clear(); cacheName = "ui-test-cache.json" }
        #endif
        cacheURL = URL.applicationSupportDirectory.appending(path: "SculptAI/" + cacheName)
        connected = service.token != nil
        if connected, let data = try? Data(contentsOf: cacheURL), let snapshot = try? JSONDecoder().decode(MemberSnapshot.self, from: data) {
            state = snapshot.state; revision = snapshot.revision
        }
    }
    func perform(_ task: () async throws -> Void) async -> Bool {
        guard !busy else { return false }
        busy = true; error = nil
        defer { busy = false }
        do { try await task(); return true }
        catch { self.error = error.localizedDescription; return false }
    }
    func refresh() async throws {
        guard connected else { return }
        let snapshot: MemberSnapshot = try await service.request("api/state")
        accept(snapshot)
        configuration = try? await service.request("api/v1/app-config")
    }
    func accept(_ snapshot: MemberSnapshot) {
        state = snapshot.state; revision = snapshot.revision; lastSynced = Date()
        do {
            try FileManager.default.createDirectory(at: cacheURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            let data = try JSONEncoder().encode(snapshot)
            try data.write(to: cacheURL, options: [.atomic, .completeFileProtection])
            var cache = cacheURL
            var values = URLResourceValues(); values.isExcludedFromBackup = true
            try cache.setResourceValues(values)
        } catch { self.error = "Your account was updated, but the offline copy could not be saved." }
    }
    func change(_ action: [String: Any]) async throws {
        guard connected else { throw ServiceError(message: "Connect your account before saving changes.") }
        let data = try JSONSerialization.data(withJSONObject: action, options: [.sortedKeys])
        if pendingChange?.data != data { pendingChange = (data, UUID().uuidString, revision) }
        guard let pendingChange else { return }
        do {
            let snapshot: MemberSnapshot = try await service.request("api/state", body: ["revision": pendingChange.revision, "operationId": pendingChange.operationID, "action": action])
            self.pendingChange = nil
            accept(snapshot)
        } catch {
            if (error as? ServiceError)?.status == 409 {
                self.pendingChange = nil
                try? await refresh()
            }
            throw error
        }
    }
    func finishPairing(_ token: String) async throws {
        try Keychain.save(token); connected = true
        try await refresh()
    }
    func disconnect() async {
        struct Revoke: Decodable { let revoked: Bool }
        let _: Revoke? = try? await service.request("api/mobile/pair", body: ["action": "revoke"])
        Keychain.clear(); connected = false; state = MemberState(); revision = 0; messages = []; lastSynced = nil; pendingChange = nil
        try? FileManager.default.removeItem(at: cacheURL)
    }
    func ask(_ question: String, explainFuel: Bool = false) async throws {
        let answer: CoachAnswer = try await service.request("api/coach", body: explainFuel ? ["intent": "fuel-explanation"] : ["message": question])
        messages.append(ChatMessage(text: question, isCoach: false))
        messages.append(ChatMessage(text: answer.answer, isCoach: true))
    }
}

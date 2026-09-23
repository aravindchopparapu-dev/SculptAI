import Foundation
import Security

struct ServiceError: LocalizedError {
    let message: String
    var status: Int? = nil
    var errorDescription: String? { message }
}
@MainActor final class AccountService {
    static let origin = URL(string: "https://sculptai-v2-future-studio.aravindchopparapu-ch.chatgpt.site")!
    var token: String? { Keychain.read() }
    func request<T: Decodable>(_ path: String, body: [String: Any]? = nil) async throws -> T {
        var request = URLRequest(url: Self.origin.appendingPathComponent(path))
        request.timeoutInterval = 65
        request.httpMethod = body == nil ? "GET" : "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(Self.origin.absoluteString, forHTTPHeaderField: "Origin")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body { request.httpBody = try JSONSerialization.data(withJSONObject: body) }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw ServiceError(message: "SculptAI could not be reached.") }
        guard (200..<300).contains(response.statusCode) else {
            let error = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            throw ServiceError(message: error?["error"] as? String ?? (response.statusCode == 401 ? "Connect your account to continue. If the website is private, mobile access must be enabled." : "SculptAI is temporarily unavailable. Your saved data is safe."), status: response.statusCode)
        }
        do { return try JSONDecoder().decode(T.self, from: data) }
        catch { throw ServiceError(message: "The server returned an unexpected response. Please try again.") }
    }
}
enum Keychain {
    static var service: String {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--ui-testing") { return "com.sculptai.ios.uitests" }
        #endif
        return "com.sculptai.ios.account"
    }
    static func read() -> String? {
        var value: CFTypeRef?
        let result = SecItemCopyMatching([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "session", kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne] as CFDictionary, &value)
        guard result == errSecSuccess, let data = value as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
    static func save(_ token: String) throws {
        clear()
        let result = SecItemAdd([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "session", kSecValueData as String: Data(token.utf8), kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly] as CFDictionary, nil)
        guard result == errSecSuccess else { throw ServiceError(message: "Unable to secure this session on your iPhone.") }
    }
    static func clear() { SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service] as CFDictionary) }
}

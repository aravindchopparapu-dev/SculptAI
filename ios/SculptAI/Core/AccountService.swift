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

// The system browser handles credentials; only an opaque completion state returns here.
import AuthenticationServices
import UIKit

@MainActor final class NativeAccountSignIn: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var session: ASWebAuthenticationSession?
    func signIn(service: AccountService) async throws -> String {
        let pair: PairingCode = try await service.request("api/mobile/pair", body: ["action": "begin"])
        let state = UUID().uuidString
        var url = URLComponents(url: AccountService.origin.appending(path: "connect"), resolvingAgainstBaseURL: false)!
        url.queryItems = [URLQueryItem(name: "app", value: "1"), URLQueryItem(name: "code", value: pair.code), URLQueryItem(name: "state", value: state)]
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            let auth = ASWebAuthenticationSession(url: url.url!, callbackURLScheme: "sculptai") { callback, error in
                Task { @MainActor in
                    self.session = nil
                    if let error { continuation.resume(throwing: error); return }
                    guard Self.validCallback(callback, state: state) else {
                        continuation.resume(throwing: ServiceError(message: "Sign-in could not be verified. Please try again.")); return
                    }
                    continuation.resume()
                }
            }
            auth.presentationContextProvider = self
            session = auth
            guard auth.start() else {
                session = nil
                continuation.resume(throwing: ServiceError(message: "Unable to open sign-in. Please try again.")); return
            }
        }
        let result: PairingResult = try await service.request("api/mobile/pair", body: ["action": "poll", "deviceSecret": pair.deviceSecret])
        guard let token = result.accessToken else { throw ServiceError(message: "Sign-in is not approved yet. Please try again.") }
        return token
    }
    static func validCallback(_ url: URL?, state: String) -> Bool {
        guard let url, url.scheme == "sculptai", url.host == "auth-complete", url.path.isEmpty,
              let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems,
              query.count == 1, query.first?.name == "state", query.first?.value == state else { return false }
        return true
    }
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }?.windows.first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }
}

import SwiftUI
import AuthenticationServices

struct AccountView: View {
    @Environment(SculptStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var nativeSignIn = NativeAccountSignIn()
    @State private var authenticating = false
    @State private var setupProfile = false
    @State private var showManualConnection = false
    @State private var pairing: PairingCode?
    @State private var pairingMessage = ""
    @State private var signingOut = false
    @State private var polling = false
    var body: some View {
        Form {
            if let error = store.error {
                Section {
                    Label(error, systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                        .accessibilityAddTraits(.updatesFrequently)
                }
            }
            if store.connected {
                Section {
                    Label(store.state.profile?.name ?? "Your SculptAI account", systemImage: "person.crop.circle.fill").font(.headline).stableScrollEdges()
                    if let date = store.lastSynced { Text("Synced \(date.formatted(date: .abbreviated, time: .shortened))").font(.caption).foregroundStyle(.secondary) }
                    NavigationLink(store.state.profile == nil ? "Set up profile" : "Edit profile") { ProfileView(profile: store.state.profile ?? MemberProfile()) }
                    Button("Refresh account") { Task { _ = await store.perform { try await store.refresh() } } }
                } header: { Text("Account") } footer: { Text("Your website and iPhone share the same saved profile, plans, and Coach instructions.") }
                Section { Button("Disconnect this iPhone", role: .destructive) { signingOut = true } }
            } else {
                Section {
                    VStack(alignment: .leading, spacing: 16) {
                        Image(systemName: "iphone.gen3.radiowaves.left.and.right").font(.largeTitle).foregroundStyle(.tint)
                        Text("One account.\nEvery screen.").font(.largeTitle.weight(.semibold)).fixedSize(horizontal: false, vertical: true)
                        Text("Create your SculptAI account or sign in to continue. Your profile, plans, and AI Coach stay with you on the app and website.").foregroundStyle(.secondary)
                    }.padding(.vertical, 16).stableScrollEdges()
                    PrimaryAction(title: authenticating ? "Opening sign-in…" : "Create account", icon: "person.badge.plus", disabled: authenticating || store.busy) { Task { await openSignIn() } }
                    Button("Sign in to existing account") { Task { await openSignIn() } }.disabled(authenticating || store.busy)
                    Text("Continue securely with ChatGPT, just like on the website. New members set up their profile next.").font(.caption).foregroundStyle(.secondary)
                    DisclosureGroup("Connect using a code instead", isExpanded: $showManualConnection) {
                    if let pairing {
                        Text(pairing.code.prefix(5) + "–" + pairing.code.suffix(5)).font(.title.monospaced().weight(.semibold)).textSelection(.enabled).accessibilityLabel("Pairing code \(pairing.code)")
                        Text("Code expires in 10 minutes.").font(.caption).foregroundStyle(.secondary)
                        Link("Open SculptAI to approve", destination: AccountService.origin.appending(path: "connect"))
                        Button(polling ? "Checking…" : "I approved this iPhone") { Task { await checkPairing(pairing) } }.disabled(polling)
                        if !pairingMessage.isEmpty { Text(pairingMessage).font(.subheadline).foregroundStyle(.secondary) }
                    }
                    Button(pairing == nil ? "Get my connection code" : "Get a new code") {
                        Task { _ = await store.perform { pairing = try await store.service.request("api/mobile/pair", body: ["action": "begin"]); pairingMessage = "" } }
                    }.disabled(store.busy || authenticating)
                    }
                }
            }
            Section("About SculptAI") {
                Text("Personal training. Thoughtful nutrition. Your progress.")
                Link("Open SculptAI website", destination: AccountService.origin)
                Text("AI guidance is an estimate. Review plans before using them.").font(.caption).foregroundStyle(.secondary)
            }
        }.navigationDestination(isPresented: $setupProfile) { ProfileView(profile: store.state.profile ?? MemberProfile()) }
        .navigationTitle("Your account").navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } } }
            .confirmationDialog("Disconnect this iPhone?", isPresented: $signingOut, titleVisibility: .visible) { Button("Disconnect and clear this phone", role: .destructive) { Task { await store.disconnect() } } } message: { Text("Your website account and saved records are retained. This phone’s session and offline copy will be removed.") }
    }
    private func openSignIn() async {
        guard !authenticating else { return }
        authenticating = true; store.error = nil
        defer { authenticating = false }
        do {
            let token = try await nativeSignIn.signIn(service: store.service)
            try await store.finishPairing(token)
            setupProfile = store.state.profile == nil
        } catch let error as ASWebAuthenticationSessionError where error.code == .canceledLogin {
            // Cancellation leaves the member signed out without an error alert.
        } catch { store.error = error.localizedDescription }
    }
    private func checkPairing(_ pairing: PairingCode) async {
        polling = true; defer { polling = false }
        _ = await store.perform {
            let result: PairingResult = try await store.service.request("api/mobile/pair", body: ["action": "poll", "deviceSecret": pairing.deviceSecret])
            if let token = result.accessToken { try await store.finishPairing(token) }
            else { pairingMessage = "Waiting for approval. Enter this code on the SculptAI website first." }
        }
    }
}
struct ProfileView: View {
    @Environment(SculptStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State var profile: MemberProfile
    @State private var age = ""
    @State private var height = ""
    @State private var weight = ""
    @State private var target = ""
    @State private var consent = false
    @State private var safety = "clear"
    @State private var validation: String?
    var body: some View {
        Form {
            Section("Your starting point") {
                TextField("Preferred name", text: $profile.name).textContentType(.givenName).stableScrollEdges()
                TextField("Age (18+)", text: $age).keyboardType(.numberPad)
                Picker("Sex for energy estimate", selection: $profile.sex) { Text("Not specified").tag(""); Text("Female").tag("Female"); Text("Male").tag("Male") }
                NumberEntry(title: "Height", unit: "cm", text: $height)
                NumberEntry(title: "Starting weight", unit: "kg", text: $weight)
                NumberEntry(title: "Target weight", unit: "kg", text: $target)
                Text("All measurements above are required. Check-ins record later weights without changing this starting point.").font(.caption).foregroundStyle(.secondary)
            }
            Section("Training, your way") {
                Picker("Goal", selection: $profile.goal) { ForEach(["Muscle gain", "Fat loss", "Strength", "General fitness", "Maintenance / recomp"], id: \.self) { Text($0) } }
                Picker("Experience", selection: $profile.experience) { Text("Beginner").tag("Beginner"); Text("Intermediate").tag("Intermediate") }
                Picker("Days per week", selection: $profile.days) { ForEach(2...6, id: \.self) { Text("\($0) days").tag($0) } }
                Picker("Minutes per session", selection: $profile.minutes) { ForEach([20,30,45,60,75,90], id: \.self) { Text("\($0) min").tag($0) } }
                Picker("Equipment", selection: $profile.equipment) { ForEach(["Bodyweight","Dumbbells","Gym"], id: \.self) { Text($0) } }
                TextField("Movements to avoid", text: $profile.avoid, axis: .vertical)
            }
            Section("Fuel preferences") {
                Picker("Activity", selection: $profile.activity) { Text("Mostly seated").tag(1.2); Text("Lightly active").tag(1.375); Text("Moderately active").tag(1.55); Text("Very active").tag(1.725) }
                Picker("Diet", selection: $profile.diet) { ForEach(["Omnivore","Vegetarian","Vegan"], id: \.self) { Text($0) } }
                TextField("Foods to exclude", text: $profile.exclusions, axis: .vertical)
            }
            Section("Before you train") {
                Picker("Activity check", selection: $safety) { Text("Ready for activity").tag("clear"); Text("I need professional guidance").tag("guidance"); Text("I have urgent symptoms").tag("emergency") }
                Toggle("I am 18+ and understand SculptAI provides general fitness guidance, not medical care.", isOn: $consent)
            }
            if let validation { Section { Text(validation).foregroundStyle(.red) } }
            Section { Button("Save profile") { Task { await save() } }.disabled(store.busy || !consent) }
        }.navigationTitle("Your profile").navigationBarTitleDisplayMode(.inline)
            .onAppear { age = String(profile.age); height = profile.height > 0 ? profile.height.formatted() : ""; weight = profile.weight > 0 ? profile.weight.formatted() : ""; target = profile.targetWeight?.formatted() ?? "" }
            .scrollDismissesKeyboard(.interactively)
    }
    private func save() async {
        profile.age = Int(age) ?? 0; profile.height = decimal(height) ?? 0; profile.weight = decimal(weight) ?? 0; profile.targetWeight = decimal(target)
        if let error = profile.validationMessage { validation = error; return }
        let saved = await store.perform {
            try await store.change(["type": "profile", "profile": try profile.dictionary()])
            try await store.change(["type": "safety", "accepted": consent, "status": safety])
        }
        if saved { dismiss() }
    }
}
struct NumberEntry: View {
    let title: String
    let unit: String
    @Binding var text: String
    var body: some View { HStack { Text(title); Spacer(); TextField("Required", text: $text).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(minWidth: 70).accessibilityLabel("\(title), \(unit)"); Text(unit).foregroundStyle(.secondary) }.accessibilityElement(children: .contain) }
}
func decimal(_ value: String) -> Double? { Double(value.replacingOccurrences(of: ",", with: ".")) }
struct CheckInView: View {
    @Environment(SculptStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var date = Date()
    @State private var weight = ""
    @State private var waist = ""
    @State private var bodyFat = ""
    @State private var notes = ""
    var body: some View {
        Form {
            Section("A new point on your journey") {
                DatePicker("Date", selection: $date, in: ...Date(), displayedComponents: .date).stableScrollEdges()
                NumberEntry(title: "Current weight", unit: "kg", text: $weight)
                HStack { Text("Waist (optional)"); TextField("cm", text: $waist).keyboardType(.decimalPad).multilineTextAlignment(.trailing) }
                HStack { Text("Body fat (optional)"); TextField("%", text: $bodyFat).keyboardType(.decimalPad).multilineTextAlignment(.trailing) }
                TextField("Notes (optional)", text: $notes, axis: .vertical)
            }
            Section { Text("Use similar measurement conditions for clearer trends. New check-ins can update your Fuel estimates.").font(.subheadline).foregroundStyle(.secondary) }
            Section { Button("Save check-in") { Task { await save() } }.disabled(store.busy || decimal(weight) == nil) }
        }.navigationTitle("Check in").navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }.scrollDismissesKeyboard(.interactively)
    }
    private func save() async {
        guard let kg = decimal(weight), (30...350).contains(kg) else { store.error = "Enter a weight between 30 and 350 kg."; return }
        let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.timeZone = .current; formatter.dateFormat = "yyyy-MM-dd"
        var metric: [String: Any] = ["date": formatter.string(from: date), "weight": kg, "source": "Manual", "notes": notes]
        if !waist.isEmpty { guard let value = decimal(waist) else { store.error = "Enter a valid waist measurement."; return }; metric["waist"] = value }
        if !bodyFat.isEmpty { guard let value = decimal(bodyFat) else { store.error = "Enter a valid body-fat estimate."; return }; metric["bodyFat"] = value }
        if await store.perform({ try await store.change(["type": "metric", "metric": metric]) }) { dismiss() }
    }
}

import SwiftUI

struct CoachView: View {
    @Environment(SculptStore.self) private var store
    @State private var question = ""
    @FocusState private var focused: Bool
    var body: some View {
        ScrollViewReader { scroll in
            PageScroll {
                VStack(alignment: .leading, spacing: 12) {
                    Image(systemName: "sparkles").font(.largeTitle).foregroundStyle(.tint)
                    Eyebrow(text: "A little clarity goes a long way")
                    Text("Let’s work it out.").font(.largeTitle.weight(.semibold))
                    Text("AI Coach uses your saved profile, body metrics, and goals. Suggestions are estimates for you to review.").font(.subheadline).foregroundStyle(.secondary)
                }.padding(.bottom, 8)
                if store.messages.isEmpty {
                    ForEach(["Explain my Fuel targets", "How should I train with low energy?", "What has changed since my starting weight?"], id: \.self) { prompt in
                        Button { Task { await send(prompt, explain: prompt == "Explain my Fuel targets") } } label: { Surface { HStack { Text(prompt).font(.subheadline); Spacer(); Image(systemName: "arrow.up.right").font(.caption) } } }.buttonStyle(.plain).disabled(!store.connected || store.state.profile == nil || store.busy)
                    }
                    if !store.connected || store.state.profile == nil { Label("Connect your account and complete your profile to ask AI Coach.", systemImage: "person.crop.circle").font(.subheadline).foregroundStyle(.secondary) }
                }
                ForEach(store.messages) { message in
                    Surface { VStack(alignment: .leading, spacing: 10) { Label(message.isCoach ? "AI Coach" : "You", systemImage: message.isCoach ? "sparkles" : "person").font(.caption.weight(.semibold)).foregroundStyle(.secondary); Text(.init(message.text)).font(.body).textSelection(.enabled) } }.id(message.id)
                }
            }.sculptScreen("AI Coach")
                .safeAreaInset(edge: .bottom) {
                    HStack(alignment: .bottom, spacing: 12) {
                        TextField("Ask your Coach", text: $question, axis: .vertical).lineLimit(1...5).padding(14).background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 22)).focused($focused).submitLabel(.send)
                        Button { let text = question; Task { await send(text) } } label: { Image(systemName: "arrow.up").font(.headline).frame(width: 48, height: 48) }.buttonStyle(.borderedProminent).buttonBorderShape(.circle).accessibilityLabel("Send question").disabled(store.busy || !store.connected || store.state.profile == nil || question.trimmingCharacters(in: .whitespacesAndNewlines).count < 2)
                    }.padding(14).background(.regularMaterial)
                }
                .onChange(of: store.messages.count) { if let last = store.messages.last { scroll.scrollTo(last.id, anchor: .bottom) } }
        }
    }
    private func send(_ text: String, explain: Bool = false) async {
        let text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (2...1000).contains(text.count) else { store.error = "Enter a question of 2–1000 characters."; return }
        focused = false
        if await store.perform({ try await store.ask(text, explainFuel: explain) }) { question = "" }
    }
}

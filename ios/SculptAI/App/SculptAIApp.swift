import SwiftUI

@main struct SculptAIApp: App {
    @State private var store = SculptStore()
    var body: some Scene {
        WindowGroup { RootView().environment(store).tint(SculptStyle.blue) }
    }
}
struct RootView: View {
    @Environment(SculptStore.self) private var store
    @Environment(\.scenePhase) private var scenePhase
    @State private var tab = 0
    @State private var account = false
    var body: some View {
        @Bindable var store = store
        TabView(selection: $tab) {
            NavigationStack { StudioView(tab: $tab).toolbar { accountButton } }.tabItem { Label("Studio", systemImage: "square.stack.3d.up") }.tag(0)
            NavigationStack { TrainingView().toolbar { accountButton } }.tabItem { Label("Training", systemImage: "dumbbell") }.tag(1)
            NavigationStack { FuelView().toolbar { accountButton } }.tabItem { Label("Fuel", systemImage: "leaf") }.tag(2)
            NavigationStack { InsightsView().toolbar { accountButton } }.tabItem { Label("Insights", systemImage: "chart.xyaxis.line") }.tag(3)
            NavigationStack { CoachView().toolbar { accountButton } }.tabItem { Label("Coach", systemImage: "sparkles") }.tag(4)
        }
        .sheet(isPresented: $account) { NavigationStack { AccountView() }.environment(store) }
        .alert("SculptAI", isPresented: Binding(get: { store.error != nil }, set: { if !$0 { store.error = nil } })) { Button("OK") { store.error = nil } } message: { Text(store.error ?? "") }
        .overlay(alignment: .top) { if store.busy { ProgressView("Working…").padding(12).background(.regularMaterial, in: Capsule()).padding(.top, 8).accessibilityAddTraits(.updatesFrequently) } }
        .task { if store.connected { _ = await store.perform { try await store.refresh() } } }
        .task(id: scenePhase) {
            guard scenePhase == .active else { return }
            await store.refreshQuietly()
            while !Task.isCancelled {
                do { try await Task.sleep(for: .seconds(30)) } catch { break }
                await store.refreshQuietly()
            }
        }
    }
    @ToolbarContentBuilder private var accountButton: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) { Button("Account", systemImage: "person.crop.circle") { account = true }.accessibilityIdentifier("account") }
    }
}

import SwiftUI

struct StudioView: View {
    @Environment(SculptStore.self) private var store
    @Binding var tab: Int
    @State private var checkIn = false
    @State private var account = false
    @ScaledMetric(relativeTo: .largeTitle) private var heroHeight = 330.0
    var body: some View {
        VStack(spacing: 0) {
            StudioStatusBar(connected: store.connected)
            PageScroll {
                ZStack(alignment: .bottomLeading) {
                    Color.clear.overlay { Image("Studio").resizable().scaledToFill().accessibilityHidden(true) }.clipped()
                    LinearGradient(colors: [.clear, .black.opacity(0.88)], startPoint: .top, endPoint: .bottom)
                    VStack(alignment: .leading, spacing: 14) {
                        Text("BUILT AROUND YOU").font(.caption.weight(.semibold)).tracking(2.4).foregroundStyle(SculptStyle.mint)
                        Text(store.state.profile == nil ? "Your next chapter\nstarts here." : "Make today\nyour own.")
                            .font(.largeTitle.weight(.semibold)).tracking(-1.2).fixedSize(horizontal: false, vertical: true).accessibilityIdentifier("studio.headline")
                        Text(store.state.profile.map { "\($0.name.components(separatedBy: " ").first ?? $0.name), let’s move with purpose." } ?? "A personal space for training, food, and the progress that matters.")
                            .font(.subheadline).foregroundStyle(.white.opacity(0.85))
                    }.padding(24).foregroundStyle(.white)
                }.frame(height: heroHeight).clipShape(RoundedRectangle(cornerRadius: 30)).accessibilityElement(children: .combine).accessibilityIdentifier("studio.hero")
                if let notice = store.configuration?.memberNotice, !notice.isEmpty { Surface { Label(notice, systemImage: "info.circle").font(.subheadline) } }
                if let profile = store.state.profile {
                    HStack(spacing: 14) {
                        MetricTile(title: "Current", value: store.state.currentWeight?.formatted(.number.precision(.fractionLength(1))) ?? "—", unit: "kg", symbol: "figure.stand")
                        MetricTile(title: "Goal", value: profile.targetWeight?.formatted(.number.precision(.fractionLength(1))) ?? "—", unit: "kg", symbol: "scope")
                    }
                    Surface {
                        VStack(alignment: .leading, spacing: 18) {
                            Eyebrow(text: "Today, on your terms")
                            Text("How are you arriving?").font(.title2.weight(.semibold))
                            Text("Your energy and recovery shape your next workout.").font(.subheadline).foregroundStyle(.secondary)
                            PrimaryAction(title: "Build today’s workout", icon: "dumbbell") { tab = 1 }
                        }
                    }
                    Button { checkIn = true } label: {
                        Surface { HStack(spacing: 16) { Image(systemName: "plus.circle.fill").font(.title).foregroundStyle(.tint); VStack(alignment: .leading, spacing: 4) { Text("A moment to check in").font(.headline); Text("Record weight and body measurements").font(.caption).foregroundStyle(.secondary) }; Spacer(); Image(systemName: "chevron.right") } }
                    }.buttonStyle(.plain)
                    if let target = store.state.targets.last {
                        Surface { VStack(alignment: .leading, spacing: 12) { Eyebrow(text: "Your daily Fuel"); HStack(alignment: .firstTextBaseline) { Text(Int(target.calories.rounded()).formatted()).font(.largeTitle.weight(.semibold)); Text("kcal target").foregroundStyle(.secondary); Spacer(); Image(systemName: "leaf").foregroundStyle(SculptStyle.mint) }; Text("Based on your saved goal and latest measurements.").font(.caption).foregroundStyle(.secondary); Button("Open Fuel") { tab = 2 } } }
                    }
                } else {
                    PrimaryAction(title: store.connected ? "Set up your profile" : "Create account or sign in", icon: "arrow.up.right") { account = true }
                    EmptyCard(title: "A plan that starts with you", detail: "Set your starting point, choose the muscle groups you want to train, and let AI Coach build your session. No automatic or random workouts.", symbol: "figure.strengthtraining.traditional")
                }
            }
        }.sculptScreen("Studio")
            .sheet(isPresented: $checkIn) { NavigationStack { CheckInView() } }
            .sheet(isPresented: $account) { NavigationStack { AccountView() } }
    }
}
private struct StudioStatusBar: View {
    let connected: Bool
    var body: some View {
        HStack {
            Eyebrow(text: Date.now.formatted(.dateTime.weekday(.wide).month(.abbreviated).day()))
                .accessibilityIdentifier("studio.date")
            Spacer()
            Label(connected ? "Your account" : "Welcome", systemImage: connected ? "checkmark.icloud" : "sparkle")
                .font(.caption).foregroundStyle(.secondary)
                .accessibilityIdentifier("studio.accountStatus")
        }
        .padding(.horizontal, 20).padding(.vertical, 12)
        .frame(maxWidth: 720).frame(maxWidth: .infinity)
        .background(Color(uiColor: .systemGroupedBackground))
    }
}

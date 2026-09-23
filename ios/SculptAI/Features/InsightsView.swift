import SwiftUI
import Charts

struct InsightsView: View {
    @Environment(SculptStore.self) private var store
    @State private var checkIn = false
    private var points: [WeightPoint] {
        guard let profile = store.state.profile else { return [] }
        return [WeightPoint(index: 0, label: "Starting point", weight: profile.weight)] + store.state.metrics.sorted { $0.date < $1.date }.enumerated().map { index, metric in WeightPoint(index: index + 1, label: metric.date, weight: metric.weight) }
    }
    var body: some View {
        PageScroll {
            VStack(alignment: .leading, spacing: 8) { Eyebrow(text: "Progress, in perspective"); Text("See your story.").font(.largeTitle.weight(.semibold)); Text("Small changes become a clearer picture over time.").foregroundStyle(.secondary) }
            if let profile = store.state.profile, let current = store.state.currentWeight {
                Surface {
                    VStack(alignment: .leading, spacing: 20) {
                        HStack(alignment: .firstTextBaseline) { VStack(alignment: .leading, spacing: 4) { Text("\(current.formatted(.number.precision(.fractionLength(1)))) kg").font(.largeTitle.weight(.semibold)); Text(store.state.metrics.isEmpty ? "Profile starting weight" : "Latest check-in").font(.caption).foregroundStyle(.secondary) }; Spacer(); Text(String(format: "%+.1f kg", current - profile.weight)).font(.subheadline.weight(.medium)).padding(10).background(SculptStyle.blue.opacity(0.15), in: Capsule()) }
                        Chart(points) { point in
                            LineMark(x: .value("Check-in", point.index), y: .value("Weight, kg", point.weight)).foregroundStyle(SculptStyle.blue).lineStyle(StrokeStyle(lineWidth: 3)).interpolationMethod(.linear)
                            PointMark(x: .value("Check-in", point.index), y: .value("Weight, kg", point.weight)).foregroundStyle(SculptStyle.blue).symbolSize(45)
                        }.chartYScale(domain: ((points.map(\.weight).min() ?? current) - 2)...((points.map(\.weight).max() ?? current) + 2))
                            .chartXAxis { AxisMarks(values: .automatic(desiredCount: 4)) { AxisValueLabel(); AxisGridLine() } }.frame(height: 220)
                            .accessibilityLabel("Weight trend").accessibilityValue(points.map { "\($0.label), \($0.weight.formatted()) kilograms" }.joined(separator: ". "))
                        Text("Point 0 is your profile starting weight. Each check-in adds a new point.").font(.caption).foregroundStyle(.secondary)
                    }
                }
                HStack(spacing: 14) { MetricTile(title: "Starting", value: profile.weight.formatted(.number.precision(.fractionLength(1))), unit: "kg", symbol: "flag"); MetricTile(title: "Target", value: profile.targetWeight?.formatted(.number.precision(.fractionLength(1))) ?? "—", unit: "kg", symbol: "scope") }
                PrimaryAction(title: "Add a check-in", icon: "plus") { checkIn = true }
                Surface {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Your timeline").font(.title2.weight(.semibold))
                        ForEach(store.state.metrics.sorted { $0.date > $1.date }) { metric in
                            HStack { VStack(alignment: .leading, spacing: 4) { Text(metric.date).font(.subheadline); if let waist = metric.waist { Text("Waist \(waist.formatted()) cm").font(.caption).foregroundStyle(.secondary) } }; Spacer(); Text("\(metric.weight.formatted()) kg").font(.headline).monospacedDigit() }; Divider()
                        }
                        HStack { Label("Starting point", systemImage: "flag"); Spacer(); Text("\(profile.weight.formatted()) kg").fontWeight(.semibold) }.font(.subheadline)
                    }
                }
            } else { EmptyCard(title: "Every journey has a starting point", detail: "Complete your profile to establish your baseline. Later check-ins appear alongside it, so progress always starts with your own data.", symbol: "chart.xyaxis.line") }
        }.sculptScreen("Insights").sheet(isPresented: $checkIn) { NavigationStack { CheckInView() } }
    }
}
struct WeightPoint: Identifiable { var id: Int { index }; let index: Int; let label: String; let weight: Double }

import SwiftUI

enum SculptStyle {
    static let mint = Color(red: 0.61, green: 0.91, blue: 0.80)
    static let blue = Color("AccentColor")
    static let coral = Color(red: 0.99, green: 0.66, blue: 0.52)
    static let ink = Color(red: 0.035, green: 0.065, blue: 0.095)
}
struct SculptBackground: View {
    @Environment(\.colorScheme) private var appearance
    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color(uiColor: .systemGroupedBackground)
            RadialGradient(colors: [SculptStyle.blue.opacity(appearance == .dark ? 0.13 : 0.08), .clear], center: .topTrailing, startRadius: 0, endRadius: 460)
        }.ignoresSafeArea()
    }
}
struct Surface<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        content.padding(20).frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 26))
    }
}
struct Eyebrow: View {
    let text: String
    var body: some View { Text(text.uppercased()).font(.caption.weight(.semibold)).tracking(2).foregroundStyle(.secondary) }
}
struct MetricTile: View {
    let title: String
    let value: String
    let unit: String
    let symbol: String
    var body: some View {
        Surface {
            VStack(alignment: .leading, spacing: 12) {
                Image(systemName: symbol).foregroundStyle(.tint).font(.title3)
                Text(value).font(.largeTitle.weight(.semibold)).monospacedDigit().minimumScaleFactor(0.7)
                Text("\(title) · \(unit)").font(.caption).foregroundStyle(.secondary)
            }
        }.accessibilityElement(children: .combine)
    }
}
struct PrimaryAction: View {
    let title: String
    var icon = "arrow.right"
    var disabled = false
    let action: () -> Void
    var body: some View {
        Group {
            if #available(iOS 26, *) {
                Button(action: action) { label }.buttonStyle(.glassProminent)
            } else {
                Button(action: action) { label }.buttonStyle(.borderedProminent)
            }
        }.tint(SculptStyle.mint).foregroundStyle(SculptStyle.ink).disabled(disabled)
    }
    private var label: some View { Label(title, systemImage: icon).font(.headline).frame(maxWidth: .infinity).padding(.vertical, 10) }
}
struct EmptyCard: View {
    let title: String
    let detail: String
    let symbol: String
    var body: some View {
        Surface { VStack(alignment: .leading, spacing: 14) {
            Image(systemName: symbol).font(.largeTitle).foregroundStyle(.tint)
            Text(title).font(.title2.weight(.semibold))
            Text(detail).font(.subheadline).foregroundStyle(.secondary)
        }.padding(.vertical, 12) }
    }
}
struct PageScroll<Content: View>: View {
    @ViewBuilder let content: Content
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 20) { content }.padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 36).frame(maxWidth: 720).frame(maxWidth: .infinity).background(StableScrollEdges()) }
            .background { SculptBackground() }
    }
}
// SwiftUI has no no-bounce setting for long scroll views; configure the nearest hosting scroll view.
private struct StableScrollEdges: UIViewRepresentable {
    func makeUIView(context: Context) -> StableScrollMarker {
        let marker = StableScrollMarker()
        marker.isUserInteractionEnabled = false
        return marker
    }
    func updateUIView(_ view: StableScrollMarker, context: Context) { view.configure() }
}
private final class StableScrollMarker: UIView {
    override func didMoveToWindow() { super.didMoveToWindow(); configure() }
    override func layoutSubviews() { super.layoutSubviews(); configure() }
    func configure() {
        var ancestor = superview
        while let view = ancestor {
            if let scrollView = view as? UIScrollView {
                scrollView.bounces = false
                scrollView.alwaysBounceVertical = false
                return
            }
            ancestor = view.superview
        }
    }
}
extension View {
    func stableScrollEdges() -> some View { background(StableScrollEdges()) }
}
extension View {
    func sculptScreen(_ title: String) -> some View { navigationTitle(title).navigationBarTitleDisplayMode(.inline).toolbarBackground(.automatic, for: .navigationBar) }
}

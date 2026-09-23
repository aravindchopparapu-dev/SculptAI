import SwiftUI

struct FuelView: View {
    @Environment(SculptStore.self) private var store
    @State private var editing = false
    @State private var explanation: String?
    @State private var expanded = true
    @State private var generatingMealPlan = false
    var body: some View {
        PageScroll(lazy: true) {
            VStack(alignment: .leading, spacing: 8) { Eyebrow(text: "Fuel your next chapter"); Text("Eat with intention.").font(.largeTitle.weight(.semibold)); Text("Your foods, shaped around your goals.").foregroundStyle(.secondary) }
            if let target = store.state.targets.last {
                Surface {
                    VStack(alignment: .leading, spacing: 20) {
                        Eyebrow(text: "Daily calorie target")
                        HStack(alignment: .firstTextBaseline) { Text(Int(target.calories.rounded()).formatted()).font(.system(.largeTitle, design: .rounded).weight(.semibold)); Text("kcal / day").foregroundStyle(.secondary) }
                        Text("Estimated maintenance: \(Int(target.maintenance.rounded()).formatted()) kcal").font(.subheadline).foregroundStyle(.secondary)
                        HStack(spacing: 12) { macro("Protein", value: target.protein, color: SculptStyle.mint); macro("Carbs", value: target.carbs, color: SculptStyle.blue); macro("Fat", value: target.fat, color: SculptStyle.coral) }
                        Text("These are targets, not food you have eaten. Check-ins help SculptAI reassess your needs.").font(.caption).foregroundStyle(.secondary)
                    }
                }
                if let timeline = target.timeline {
                    Surface { VStack(alignment: .leading, spacing: 10) { Label("Estimated journey", systemImage: "calendar").font(.headline); Text("\(timeline.minWeeks)–\(timeline.maxWeeks) weeks").font(.title2.weight(.semibold)); Text(timeline.explanation).font(.subheadline).foregroundStyle(.secondary) } }
                }
                Surface {
                    if let explanation {
                        DisclosureGroup("Understand your Fuel goals", isExpanded: $expanded) { Text(.init(explanation)).font(.subheadline).padding(.top, 12) }
                    } else {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Understand your Fuel goals").font(.headline)
                            Text("Get the Coach’s explanation of your calorie and macro calculations.").font(.subheadline).foregroundStyle(.secondary)
                            Button("Explain my targets", systemImage: "sparkles") { Task { _ = await store.perform { let answer: CoachAnswer = try await store.service.request("api/coach", body: ["intent": "fuel-explanation"]); explanation = answer.answer; expanded = true } } }.disabled(store.busy || store.configuration?.features.coach == false)
                        }
                    }
                }
                HStack { Text("Your food choices").font(.title2.weight(.semibold)); Spacer(); Button(store.state.mealFoods == nil ? "Add foods" : "Edit", systemImage: "square.and.pencil") { editing = true } }
                if let foods = store.state.mealFoods {
                    Surface { VStack(alignment: .leading, spacing: 16) { ForEach(mealSlots, id: \.0) { key, label in if let items = foods[key], !items.isEmpty { VStack(alignment: .leading, spacing: 5) { Text(label).font(.headline); Text(items.joined(separator: ", ")).font(.subheadline).foregroundStyle(.secondary) } } }; Label("Food choices saved", systemImage: "checkmark.circle").font(.caption).foregroundStyle(.secondary) } }
                    PrimaryAction(title: generatingMealPlan ? "Building your meal plan…" : (store.state.mealPlan == nil ? "Generate my meal plan" : "Regenerate my meal plan"), icon: "sparkles", disabled: generatingMealPlan || store.busy || store.configuration?.features.meals == false) { Task { await generatePlan(foods: foods, targetId: target.id) } }
                    if generatingMealPlan {
                        ProgressView("AI Coach is checking portions and nutrition…")
                            .font(.subheadline)
                            .padding(.vertical, 8)
                            .accessibilityAddTraits(.updatesFrequently)
                    }
                } else { EmptyCard(title: "Food you actually enjoy", detail: "Add foods for breakfast, lunch, and dinner. Snacks are optional. AI Coach will suggest practical portions and explain helpful additions.", symbol: "fork.knife") }
                if let plan = store.state.mealPlan {
                    if !store.state.mealPlanIsCurrent { Label("Your foods or targets changed. Regenerate to update the saved plan below.", systemImage: "arrow.triangle.2.circlepath").font(.subheadline).foregroundStyle(.secondary) }
                    Text("Your meal plan").font(.title2.weight(.semibold))
                    ForEach(plan.meals) { meal in
                        Surface { DisclosureGroup {
                            VStack(alignment: .leading, spacing: 18) { ForEach(meal.items) { item in
                                VStack(alignment: .leading, spacing: 6) { Text("\(item.portion) · \(item.food)").font(.headline); Text(item.basis).font(.caption).foregroundStyle(.secondary); if let reason = item.reason { Label("Coach suggestion", systemImage: "sparkles").font(.caption).foregroundStyle(.tint); Text(reason).font(.subheadline).foregroundStyle(.secondary) } }
                            } }.padding(.top, 18)
                        } label: { VStack(alignment: .leading, spacing: 4) { Text(mealSlots.first { $0.0 == meal.slot }?.1 ?? meal.slot).font(.headline); Text("≈\(Int(meal.totals.calories.rounded())) kcal").font(.caption).foregroundStyle(.secondary) } } }
                    }
                    Text(plan.notes).font(.caption).foregroundStyle(.secondary)
                }
            } else { EmptyCard(title: "Start with your body metrics", detail: "Connect your account and complete your profile, including starting and target weight. Your saved Fuel targets will appear here.", symbol: "leaf.circle") }
        }.sculptScreen("Fuel")
            .sheet(isPresented: $editing) { NavigationStack { FoodChoicesView(foods: store.state.mealFoods ?? [:]) } }
    }
    private func macro(_ title: String, value: Double, color: Color) -> some View { VStack(alignment: .leading, spacing: 8) { Capsule().fill(color).frame(height: 4); Text("\(Int(value.rounded())) g").font(.headline).monospacedDigit(); Text(title).font(.caption).foregroundStyle(.secondary) }.frame(maxWidth: .infinity, alignment: .leading) }
    private func generatePlan(foods: [String: [String]], targetId: String) async {
        guard !generatingMealPlan else { return }
        generatingMealPlan = true
        defer { generatingMealPlan = false }
        _ = await store.perform {
            let snapshot: MemberSnapshot = try await store.service.request("api/meals/generate", body: ["foods": foods, "targetId": targetId, "operationId": UUID().uuidString])
            store.accept(snapshot)
        }
    }
}
struct FoodChoicesView: View {
    @Environment(SculptStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    var foods: [String: [String]]
    @State private var entries: [String: String] = [:]
    @State private var error: String?
    var body: some View {
        Form {
            Section { Text("Enter each food on its own line. Include preparation and brand when useful.").font(.subheadline).foregroundStyle(.secondary).stableScrollEdges() }
            ForEach(Array(mealSlots.enumerated()), id: \.offset) { index, slot in
                Section(slot.1 + (index < 3 ? " · Required" : " · Optional")) {
                    TextField("Foods you enjoy", text: Binding(get: { entries[slot.0] ?? "" }, set: { entries[slot.0] = $0 }), axis: .vertical).lineLimit(3...8).textInputAutocapitalization(.sentences)
                }
            }
            if let error { Text(error).foregroundStyle(.red) }
            Section { Button("Save food choices") { Task { await save() } }.disabled(store.busy) }
        }.navigationTitle("Your food choices").navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .onAppear { entries = foods.mapValues { $0.joined(separator: "\n") } }.scrollDismissesKeyboard(.interactively)
    }
    private func save() async {
        let values = Dictionary(uniqueKeysWithValues: mealSlots.map { slot in (slot.0, (entries[slot.0] ?? "").components(separatedBy: .newlines).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }) })
        if mealSlots.prefix(3).contains(where: { values[$0.0]?.isEmpty != false }) { error = "Add at least one food for breakfast, lunch, and dinner."; return }
        if await store.perform({ try await store.change(["type": "mealFoods", "foods": values]) }) { dismiss() }
    }
}

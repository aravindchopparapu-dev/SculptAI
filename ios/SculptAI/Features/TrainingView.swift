import SwiftUI

struct TrainingView: View {
    @Environment(SculptStore.self) private var store
    @State private var selected: Set<String> = []
    @State private var energy = 3
    @State private var sleep = 3
    @State private var soreness = 0
    @State private var minutes = 60
    @State private var equipment = "Gym"
    @State private var pain = false
    @State private var ready = false
    @State private var replacing: String?
    @State private var deleting: WorkoutPlan?
    var body: some View {
        ScrollViewReader { scroll in
            PageScroll {
                VStack(alignment: .leading, spacing: 8) { Eyebrow(text: "Today, on your terms"); Text("Find your focus.").font(.largeTitle.weight(.semibold)); Text("Your readiness. Your muscle groups. A session built around both.").font(.subheadline).foregroundStyle(.secondary) }.id("start")
                if store.state.profile == nil {
                    EmptyCard(title: "Start with your profile", detail: "Connect your account and save your body metrics and goals in Account. AI Coach uses those records to build your workout.", symbol: "person.crop.circle.badge.plus")
                } else {
                    Surface {
                        VStack(alignment: .leading, spacing: 18) {
                            HStack { Text("01").font(.title2.monospaced().weight(.light)).foregroundStyle(.secondary); Text("How are you arriving?").font(.headline) }
                            readinessPicker("Energy", value: $energy, values: 1...5)
                            readinessPicker("Sleep quality", value: $sleep, values: 1...5)
                            readinessPicker("Soreness", value: $soreness, values: 0...10)
                            Text("Energy and sleep: 1 low → 5 high. Soreness: 0 none → 10 high.").font(.caption).foregroundStyle(.secondary)
                            Picker("Time available", selection: $minutes) { ForEach([20,30,45,60,75,90], id: \.self) { Text("\($0) min").tag($0) } }
                            Picker("Equipment today", selection: $equipment) { ForEach(["Bodyweight","Dumbbells","Gym"], id: \.self) { Text($0) } }
                            Toggle("I have pain during movement", isOn: $pain)
                            if pain { Label("Pause training and get appropriate guidance before continuing.", systemImage: "hand.raised").font(.subheadline).foregroundStyle(.orange) }
                            Button(ready ? "Readiness saved ✓" : "Save today’s readiness") { Task { ready = await store.perform { try await store.change(["type": "readiness", "beforePlan": true, "readiness": ["dayIndex": 0, "energy": energy, "sleep": sleep, "soreness": soreness, "minutes": minutes, "equipment": equipment, "pain": pain]]) } } }.disabled(store.busy || pain || ready).buttonStyle(.bordered)
                        }
                    }
                    if ready {
                        VStack(alignment: .leading, spacing: 14) {
                            HStack { Text("02").font(.title2.monospaced().weight(.light)).foregroundStyle(.secondary); Text("Choose your training").font(.headline); Spacer(); Text("\(selected.count)/4").font(.caption).foregroundStyle(.secondary) }
                            LazyVGrid(columns: [GridItem(.adaptive(minimum: 138), spacing: 12)], spacing: 12) {
                                ForEach(trainingGroups, id: \.self) { group in
                                    Button { if selected.contains(group) { selected.remove(group) } else if selected.count < 4 { selected.insert(group) } } label: {
                                        HStack { Image(systemName: selected.contains(group) ? "checkmark.circle.fill" : (group == "Cardio" ? "figure.run" : group == "HIIT" ? "bolt.heart" : "dumbbell")); Text(group).font(.subheadline.weight(.medium)); Spacer(minLength: 0) }.padding(16).frame(minHeight: 54)
                                            .background(selected.contains(group) ? SculptStyle.blue.opacity(0.18) : Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18))
                                            .overlay { RoundedRectangle(cornerRadius: 18).stroke(selected.contains(group) ? SculptStyle.blue : .clear, lineWidth: 1.5) }
                                    }.buttonStyle(.plain).accessibilityAddTraits(selected.contains(group) ? .isSelected : [])
                                }
                            }
                            PrimaryAction(title: replacing == nil ? "Generate my workout" : "Generate a new variation", icon: "sparkles", disabled: store.busy || selected.isEmpty || store.configuration?.features.workouts == false) { Task { await generate() } }
                        }
                    }
                    if let draft = store.state.draftWorkout {
                        Surface {
                            VStack(alignment: .leading, spacing: 18) {
                                Eyebrow(text: "AI Coach · Review your workout")
                                Text(draft.day.name).font(.title2.weight(.semibold))
                                Text(draft.rationale).font(.subheadline).foregroundStyle(.secondary)
                                ExerciseList(exercises: draft.day.exercises)
                                PrimaryAction(title: "Save workout", icon: "bookmark", disabled: store.busy) {
                                    Task { if await store.perform({ try await store.change(["type": "acceptCustomWorkout", "draftId": draft.id, "confirmed": true]) }) { selected = []; replacing = nil; ready = false } }
                                }
                            }
                        }
                    }
                    Text("Your saved workouts").font(.title2.weight(.semibold)).padding(.top, 8)
                    if store.state.plans.isEmpty { EmptyCard(title: "Your collection starts here", detail: "Review an AI workout and save it to keep it here. Saving a plan does not log a workout.", symbol: "bookmark") }
                    ForEach(store.state.plans.reversed()) { plan in
                        Surface {
                            DisclosureGroup {
                                VStack(alignment: .leading, spacing: 18) {
                                    ForEach(Array(plan.days.enumerated()), id: \.offset) { _, day in ExerciseList(exercises: day.exercises) }
                                    HStack {
                                        Button("Regenerate", systemImage: "arrow.trianglehead.2.clockwise.rotate.90") { selected = Set(plan.selectedMuscles ?? []); replacing = plan.id; ready = false; scroll.scrollTo("start", anchor: .top) }
                                        Spacer()
                                        Button("Delete", systemImage: "trash", role: .destructive) { deleting = plan }
                                    }.font(.subheadline).padding(.top, 8)
                                }.padding(.top, 20)
                            } label: { VStack(alignment: .leading, spacing: 6) { Text(plan.title).font(.headline); Label("\(plan.days.flatMap(\.exercises).count) exercises · Saved", systemImage: "bookmark.fill").font(.caption).foregroundStyle(.secondary) } }
                        }
                    }
                }
            }.sculptScreen("Training")
        }.onAppear { minutes = store.state.profile?.minutes ?? 60; equipment = store.state.profile?.equipment ?? "Gym" }
            .onChange(of: energy) { ready = false }.onChange(of: sleep) { ready = false }.onChange(of: soreness) { ready = false }.onChange(of: minutes) { ready = false }.onChange(of: equipment) { ready = false }.onChange(of: pain) { ready = false }
            .confirmationDialog("Delete this saved workout?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
                Button("Delete workout", role: .destructive) { if let plan = deleting { Task { _ = await store.perform { try await store.change(["type": "deleteWorkout", "planId": plan.id, "confirmed": true]) }; deleting = nil } } }
            }
    }
    private func readinessPicker(_ title: String, value: Binding<Int>, values: ClosedRange<Int>) -> some View { Picker(title, selection: value) { ForEach(values, id: \.self) { Text(String($0)).tag($0) } } }
    private func generate() async {
        _ = await store.perform {
            let groups = trainingGroups.filter { selected.contains($0) }
            var request: [String: Any] = ["selectedMuscles": groups]
            if let replacing { request["regeneratePlanId"] = replacing }
            let result: GeneratedWorkout = try await store.service.request("api/training/generate", body: request)
            var action: [String: Any] = ["type": "proposeCustomWorkout", "selectedMuscles": groups, "day": try result.day.dictionary(), "readinessId": result.readinessId, "rationale": result.rationale]
            if let replacing { action["replacesPlanId"] = replacing }
            try await store.change(action)
        }
    }
}
struct ExerciseList: View {
    let exercises: [WorkoutExercise]
    var body: some View { VStack(spacing: 20) {
        ForEach(Array(exercises.enumerated()), id: \.element.id) { index, exercise in
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 12) {
                    Text(String(format: "%02d", index + 1)).font(.title3.monospaced()).foregroundStyle(.secondary)
                    VStack(alignment: .leading, spacing: 5) { Text(exercise.name).font(.headline); Text("\(exercise.sets) \(exercise.pattern == "hiit" ? "rounds" : "sets") · \(exercise.reps)\(exercise.pattern == "cardio" || exercise.pattern == "hiit" ? "" : " reps") · \(exercise.rest)s rest").font(.caption).foregroundStyle(.secondary) }
                }
                ExerciseGuide(name: exercise.name)
                Text(exercise.cue).font(.subheadline).foregroundStyle(.secondary)
            }
            if index < exercises.count - 1 { Divider() }
        }
    } }
}
struct ExerciseGuide: View {
    let name: String
    private var paths: [String] {
        guard let url = Bundle.main.url(forResource: "exercise-media", withExtension: "json"), let data = try? Data(contentsOf: url), let media = try? JSONSerialization.jsonObject(with: data) as? [String: [String: Any]] else { return [] }
        return media[name]?["images"] as? [String] ?? []
    }
    var body: some View {
        if !paths.isEmpty {
            TabView { ForEach(Array(paths.enumerated()), id: \.offset) { index, path in
                if let url = Bundle.main.url(forResource: URL(fileURLWithPath: path).lastPathComponent, withExtension: nil, subdirectory: "exercise-guides"), let image = UIImage(contentsOfFile: url.path) {
                    Image(uiImage: image).resizable().scaledToFit().padding(8).background(.white).accessibilityLabel("\(name), position \(index + 1)")
                }
            } }.tabViewStyle(.page).frame(height: 210).clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }
}

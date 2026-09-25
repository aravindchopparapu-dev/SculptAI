import Foundation

struct MemberProfile: Codable, Equatable {
    var name = ""
    var age = 30
    var sex = ""
    var height = 0.0
    var weight = 0.0
    var targetWeight: Double? = nil
    var goal = "Muscle gain"
    var days = 4
    var minutes = 60
    var equipment = "Gym"
    var experience = "Beginner"
    var activity = 1.55
    var units = "Metric"
    var diet = "Omnivore"
    var exclusions = ""
    var avoid = ""
    var eligible = true
    var validationMessage: String? {
        if name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return "Enter your preferred name." }
        if !(18...100).contains(age) { return "Enter an age between 18 and 100." }
        if !(100...250).contains(height) { return "Enter your height in centimeters, between 100 and 250." }
        if !(30...350).contains(weight) { return "Enter your starting weight in kilograms, between 30 and 350." }
        guard let targetWeight, (30...350).contains(targetWeight) else { return "Enter your target weight in kilograms." }
        if targetWeight / pow(height / 100, 2) < 18.5 { return "Choose a target weight within SculptAI’s supported range." }
        return nil
    }
}
struct BodyMetric: Codable, Identifiable {
    var id: String
    var date: String
    var weight: Double
    var waist: Double?
    var bodyFat: Double?
    var source: String
    var notes: String
}
struct WorkoutExercise: Codable, Identifiable {
    var id: String { name }
    let name: String
    let pattern: String
    let equipment: String
    let cue: String
    let sets: Int
    let reps: String
    let rest: Int
}
struct WorkoutDay: Codable { let name: String; let exercises: [WorkoutExercise] }
struct WorkoutPlan: Codable, Identifiable {
    let id: String
    let version: Int
    let created: String
    let selectedMuscles: [String]?
    let days: [WorkoutDay]
    var title: String { selectedMuscles?.joined(separator: " + ") ?? days.first?.name ?? "Workout" }
}
struct WorkoutDraft: Codable {
    let id: String
    let day: WorkoutDay
    let rationale: String
    let selectedMuscles: [String]
}
struct GeneratedWorkout: Codable { let day: WorkoutDay; let rationale: String; let readinessId: String }
struct FuelTimeline: Codable { let minWeeks: Int; let maxWeeks: Int; let explanation: String }
struct FuelTarget: Codable, Identifiable {
    let id: String
    let maintenance: Double
    let calories: Double
    let protein: Double
    let fat: Double
    let carbs: Double
    let method: String
    let analysis: String?
    let timeline: FuelTimeline?
}
struct FoodMacros: Codable { let calories: Double; let protein: Double; let carbs: Double; let fat: Double }
struct MealItem: Codable, Identifiable {
    var id: String { foodId }
    let foodId: String
    let food: String
    let grams: Double
    let basis: String
    let portionLabel: String?
    let reason: String?
    var portion: String {
        if let portionLabel, !portionLabel.isEmpty { return portionLabel }
        let foodName = food.lowercased()
        let unit: (Double, String)? = foodName.contains("egg white") ? (30, "egg whites") :
            foodName == "banana" ? (120, "bananas") : foodName == "apple" ? (180, "apples") : nil
        if let unit {
            let count = (grams / unit.0 * 2).rounded() / 2
            if count >= 0.5 && abs(count * unit.0 - grams) / grams <= 0.15 { return "≈\(count.formatted()) \(unit.1)" }
        }
        return "\(Int(grams.rounded())) g"
    }
}
struct PlannedMeal: Codable, Identifiable { var id: String { slot }; let slot: String; let items: [MealItem]; let totals: FoodMacros }
struct MealPlan: Codable { let id: String; let contextKey: String; let notes: String; let meals: [PlannedMeal]; let totals: FoodMacros }
struct SafetyConsent: Codable { let version: String }
struct SafetyScreen: Codable { let status: String }
struct MemberState: Codable {
    var profile: MemberProfile?
    var profilePhoto: String?
    var plans: [WorkoutPlan] = []
    var metrics: [BodyMetric] = []
    var targets: [FuelTarget] = []
    var mealFoods: [String: [String]]?
    var mealPlan: MealPlan?
    var draftWorkout: WorkoutDraft?
    var consents: [SafetyConsent]?
    var safetyScreens: [SafetyScreen]?
    var needsSafetySetup: Bool {
        !(consents ?? []).contains { $0.version == "testing-2026-09-18" } || (safetyScreens ?? []).isEmpty
    }
    var currentWeight: Double? { metrics.sorted { $0.date < $1.date }.last?.weight ?? profile?.weight }
    var mealPlanIsCurrent: Bool {
        guard let key = mealPlan?.contextKey, let data = key.data(using: .utf8),
              let context = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let foods = context["foods"] as? [String: [String]], let savedFoods = mealFoods else { return false }
        return foods == savedFoods && context["targetId"] as? String == targets.last?.id && context["diet"] as? String == profile?.diet && context["exclusions"] as? String == profile?.exclusions
    }
}
struct MemberSnapshot: Codable { let revision: Int; let state: MemberState }
struct PairingCode: Decodable { let deviceSecret: String; let code: String; let expiresAt: Double }
struct PairingResult: Decodable { let status: String; let accessToken: String? }
struct CoachAnswer: Decodable { let answer: String; let mode: String }
struct ChatMessage: Identifiable { let id = UUID(); let text: String; let isCoach: Bool }
struct AppConfiguration: Decodable {
    struct Features: Decodable { let coach: Bool; let workouts: Bool; let meals: Bool }
    let features: Features
    let memberNotice: String
}
let trainingGroups = ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Forearms", "Legs", "Glutes", "Calves", "Abs", "Cardio", "HIIT"]
let mealSlots = [("breakfast", "Breakfast"), ("lunch", "Lunch"), ("dinner", "Dinner"), ("morningSnack", "Morning snack"), ("eveningSnack", "Evening snack"), ("lateSnack", "Late-night snack")]
extension Encodable {
    func dictionary() throws -> [String: Any] { try JSONSerialization.jsonObject(with: JSONEncoder().encode(self)) as? [String: Any] ?? [:] }
}

import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Modèles de données pour le Widget
struct WidgetTaskItem: Identifiable, Codable {
    var id: String
    var title: String
    var category: String?
    var isCompleted: Bool
    var startTime: String?
    var isCurrentActive: Bool
    var projectColor: String?
    var projectName: String?
}

// Extension pour parser les codes hexadécimaux (#RRGGBB)
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 212, 246, 61)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

struct MyTrackWidgetEntry: TimelineEntry {
    let date: Date
    let activeTask: WidgetTaskItem?
    let todayTasks: [WidgetTaskItem]
    let totalCount: Int
    let completedCount: Int
}

// MARK: - Timeline Provider
struct MyTrackTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> MyTrackWidgetEntry {
        MyTrackWidgetEntry(
            date: Date(),
            activeTask: WidgetTaskItem(id: "1", title: "Séance de sport", category: "Fitness", isCompleted: false, startTime: "09:00", isCurrentActive: true, projectColor: "#38BDF8", projectName: "Santé"),
            todayTasks: [
                WidgetTaskItem(id: "1", title: "Séance de sport", category: "Fitness", isCompleted: false, startTime: "09:00", isCurrentActive: true, projectColor: "#38BDF8", projectName: "Santé"),
                WidgetTaskItem(id: "2", title: "Répondre aux emails", category: "Travail", isCompleted: true, startTime: "11:00", isCurrentActive: false, projectColor: "#F97316", projectName: "Pro"),
                WidgetTaskItem(id: "3", title: "Lecture & Veille", category: "Apprentissage", isCompleted: false, startTime: "18:00", isCurrentActive: false)
            ],
            totalCount: 3,
            completedCount: 1
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (MyTrackWidgetEntry) -> Void) {
        completion(fetchCurrentData())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MyTrackWidgetEntry>) -> Void) {
        let entry = fetchCurrentData()
        // Rafraîchissement régulier toutes les 15 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func fetchCurrentData() -> MyTrackWidgetEntry {
        // Lecture des données partagées via App Groups / UserDefaults
        let defaults = UserDefaults(suiteName: "group.com.mytrack.app")
        
        var activeTask: WidgetTaskItem? = nil
        var tasks: [WidgetTaskItem] = []
        
        if let data = defaults?.data(forKey: "widget_today_tasks"),
           let decoded = try? JSONDecoder().decode([WidgetTaskItem].self, from: data) {
            tasks = decoded
            activeTask = tasks.first(where: { $0.isCurrentActive })
        }
        
        let completed = tasks.filter { $0.isCompleted }.count
        
        return MyTrackWidgetEntry(
            date: Date(),
            activeTask: activeTask,
            todayTasks: tasks,
            totalCount: tasks.count,
            completedCount: completed
        )
    }
}

// MARK: - App Intent pour cocher une tâche interactivement (iOS 17+ / macOS 14+)
@available(iOS 17.0, macOS 14.0, *)
struct ToggleTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Cocher une tâche"
    
    @Parameter(title: "Task ID")
    var taskId: String

    init() {}
    init(taskId: String) {
        self.taskId = taskId
    }

    func perform() async throws -> some IntentResult {
        let defaults = UserDefaults(suiteName: "group.com.mytrack.app")
        if let data = defaults?.data(forKey: "widget_today_tasks"),
           var decoded = try? JSONDecoder().decode([WidgetTaskItem].self, from: data) {
            if let index = decoded.firstIndex(where: { $0.id == taskId }) {
                decoded[index].isCompleted.toggle()
                if let encoded = try? JSONEncoder().encode(decoded) {
                    defaults?.set(encoded, forKey: "widget_today_tasks")
                }
            }
        }
        return .result()
    }
}

// MARK: - Vue Principale du Widget iOS & Mac
struct MyTrackWidgetEntryView: View {
    var entry: MyTrackWidgetEntry
    @Environment(\.widgetFamily) var family

    let brandNeon = Color(red: 0.83, green: 0.96, blue: 0.24) // #D4F63D
    let darkBg = Color(red: 0.08, green: 0.09, blue: 0.11)

    var body: some View {
        ZStack {
            darkBg.ignoresSafeArea()

            if let active = entry.activeTask {
                // MODE A : Tâche en cours avec Timer actif
                ActiveTaskView(task: active, brandNeon: brandNeon)
            } else {
                // MODE B : Liste des tâches du jour avec bouton "+ Nouvelle tâche"
                TodayTasksListView(entry: entry, brandNeon: brandNeon, family: family)
            }
        }
    }
}

// MARK: - Vue Mode A : Tâche Active en cours
struct ActiveTaskView: View {
    let task: WidgetTaskItem
    let brandNeon: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header
            HStack {
                HStack(spacing: 5) {
                    Circle()
                        .fill(task.projectColor != nil ? Color(hex: task.projectColor!) : brandNeon)
                        .frame(width: 8, height: 8)
                    Text("EN COURS")
                        .font(.system(size: 10, weight: .black, design: .monospaced))
                        .foregroundColor(task.projectColor != nil ? Color(hex: task.projectColor!) : brandNeon)
                }
                Spacer()
                if let pName = task.projectName, let pColor = task.projectColor {
                    Text(pName)
                        .font(.system(size: 10, weight: .bold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color(hex: pColor).opacity(0.2))
                        .foregroundColor(Color(hex: pColor))
                        .cornerRadius(6)
                } else if let cat = task.category {
                    Text(cat)
                        .font(.system(size: 10, weight: .bold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.white.opacity(0.1))
                        .foregroundColor(.gray)
                        .cornerRadius(6)
                }
            }

            // Titre de la tâche
            Text(task.title)
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(.white)
                .lineLimit(2)

            Spacer()

            // Chronomètre en direct & Action
            HStack {
                Text(Date(), style: .timer)
                    .font(.system(size: 22, weight: .heavy, design: .monospaced))
                    .foregroundColor(task.projectColor != nil ? Color(hex: task.projectColor!) : brandNeon)

                Spacer()

                Link(destination: URL(string: "mytrack://complete-task?id=\(task.id)")!) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title2)
                        .foregroundColor(task.projectColor != nil ? Color(hex: task.projectColor!) : brandNeon)
                }
            }
        }
        .padding(14)
    }
}

// MARK: - Vue Mode B : Liste des tâches du jour & Input "+ Nouvelle tâche"
struct TodayTasksListView: View {
    let entry: MyTrackWidgetEntry
    let brandNeon: Color
    let family: WidgetFamily

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // En-tête : "Aujourd'hui" + Progression
            HStack {
                Text("Mes Tâches")
                    .font(.system(size: 13, weight: .black))
                    .foregroundColor(.white)

                Spacer()

                Text("\(entry.completedCount)/\(entry.totalCount)")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundColor(brandNeon)
            }

            // Liste des 3 à 5 premières tâches
            let maxItems = family == .systemSmall ? 2 : (family == .systemMedium ? 3 : 5)
            VStack(alignment: .leading, spacing: 6) {
                if entry.todayTasks.isEmpty {
                    Text("Toutes les tâches sont terminées 🎉")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.gray)
                        .padding(.vertical, 6)
                } else {
                    ForEach(entry.todayTasks.prefix(maxItems)) { item in
                        let itemAccent = item.projectColor != nil ? Color(hex: item.projectColor!) : brandNeon

                        HStack(spacing: 8) {
                            if #available(iOS 17.0, macOS 14.0, *) {
                                Button(intent: ToggleTaskIntent(taskId: item.id)) {
                                    Image(systemName: item.isCompleted ? "checkmark.circle.fill" : "circle")
                                        .foregroundColor(item.isCompleted ? itemAccent : .gray)
                                        .font(.system(size: 14))
                                }
                                .buttonStyle(.plain)
                            } else {
                                Image(systemName: item.isCompleted ? "checkmark.circle.fill" : "circle")
                                    .foregroundColor(item.isCompleted ? itemAccent : .gray)
                                    .font(.system(size: 14))
                            }

                            if let pColor = item.projectColor {
                                Circle()
                                    .fill(Color(hex: pColor))
                                    .frame(width: 5, height: 5)
                            }

                            Text(item.title)
                                .font(.system(size: 12, weight: .medium))
                                .strikethrough(item.isCompleted)
                                .foregroundColor(item.isCompleted ? .gray : .white)
                                .lineLimit(1)

                            Spacer()

                            if let time = item.startTime {
                                Text(time)
                                    .font(.system(size: 10, weight: .semibold, design: .monospaced))
                                    .foregroundColor(.gray)
                            }
                        }
                    }
                }
            }

            Spacer()

            // Bouton Deep Link : "+ Déclarer une tâche"
            Link(destination: URL(string: "mytrack://new-task")!) {
                HStack {
                    Image(systemName: "plus.circle.fill")
                        .foregroundColor(.black)
                    Text("Nouvelle tâche")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.black)
                    Spacer()
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(brandNeon)
                .cornerRadius(10)
            }
        }
        .padding(12)
    }
}

// MARK: - Déclaration du Widget
struct MyTrackHomeWidget: Widget {
    let kind: String = "MyTrackHomeWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: MyTrackTimelineProvider()) { entry in
            MyTrackWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("myTrack Tâches & Timer")
        .description("Affiche la tâche en cours avec son timer ou votre liste du jour avec ajout rapide.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

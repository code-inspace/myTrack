//
//  MyTrackWidget.swift
//  MyTrackWidget
//
//  Created by Axel on 03/09/2026.
//

import WidgetKit
import SwiftUI
import AppIntents

// MARK: - 1. Modèles de données
public struct ActiveTaskWidgetModel: Codable, Identifiable {
    public var id: String { taskId }
    public let taskId: String
    public let taskTitle: String
    public let category: String?
    public let subtitle: String?
    public let startedAtTimestamp: Double
    public let totalFormattedDuration: String?

    public var safeStartedAt: Date {
        let ts = startedAtTimestamp > 10000000000 ? startedAtTimestamp / 1000.0 : startedAtTimestamp
        let d = Date(timeIntervalSince1970: ts)
        if d > Date() {
            return Date()
        }
        return d
    }

    public init(
        taskId: String,
        taskTitle: String,
        category: String? = nil,
        subtitle: String? = nil,
        startedAtTimestamp: Double = Date().timeIntervalSince1970,
        totalFormattedDuration: String? = nil
    ) {
        self.taskId = taskId
        self.taskTitle = taskTitle
        self.category = category
        self.subtitle = subtitle
        self.startedAtTimestamp = startedAtTimestamp
        self.totalFormattedDuration = totalFormattedDuration
    }
}

public struct TaskItemWidgetModel: Codable, Identifiable {
    public let id: String
    public let title: String
    public let category: String
    public let subtitle: String?
    public let targetFormattedDuration: String?
    public let isHabit: Bool?
    public let color: String?
    public let isCompleted: Bool?

    public init(
        id: String,
        title: String,
        category: String = "myTrack",
        subtitle: String? = nil,
        targetFormattedDuration: String? = nil,
        isHabit: Bool? = false,
        color: String? = "#D4F63D",
        isCompleted: Bool? = false
    ) {
        self.id = id
        self.title = title
        self.category = category
        self.subtitle = subtitle
        self.targetFormattedDuration = targetFormattedDuration
        self.isHabit = isHabit
        self.color = color
        self.isCompleted = isCompleted
    }
}

public struct ActiveTaskApiResponse: Codable {
    public let active: Bool
    public let task: ActiveTaskWidgetModel?
}

public struct TasksListApiResponse: Codable {
    public let tasks: [TaskItemWidgetModel]
}

public struct ActiveTaskEntry: TimelineEntry {
    public let date: Date
    public let activeTasks: [ActiveTaskWidgetModel]
    public let tasks: [TaskItemWidgetModel]
    public let selectedTaskId: String?
    public let currentPage: Int

    public var activeTask: ActiveTaskWidgetModel? {
        activeTasks.first
    }

    public init(
        date: Date,
        activeTasks: [ActiveTaskWidgetModel] = [],
        tasks: [TaskItemWidgetModel] = [],
        selectedTaskId: String? = nil,
        currentPage: Int = 0
    ) {
        self.date = date
        self.activeTasks = activeTasks
        self.tasks = tasks
        self.selectedTaskId = selectedTaskId
        self.currentPage = currentPage
    }
}

// MARK: - 2. Provider de données
struct Provider: TimelineProvider {
    private func fetchLocalActiveTasks(tasks: [TaskItemWidgetModel]) -> [ActiveTaskWidgetModel] {
        var activeList: [ActiveTaskWidgetModel] = []

        let suite = UserDefaults(suiteName: "group.com.mytrack.app") ?? UserDefaults.standard

        // 1. Lire la liste des tâches actives (supporte jusqu'à 2 tâches)
        if let rawListJson = suite.string(forKey: "mytrack_active_tasks"),
           let data = rawListJson.data(using: .utf8),
           let list = try? JSONDecoder().decode([ActiveTaskWidgetModel].self, from: data),
           !list.isEmpty {
            activeList = list
        } else if let tempUrlData = try? Data(contentsOf: URL(fileURLWithPath: "/tmp/mytrack_active_tasks.json")),
                  let list = try? JSONDecoder().decode([ActiveTaskWidgetModel].self, from: tempUrlData),
                  !list.isEmpty {
            activeList = list
        }

        // 2. Fallback sur la tâche active unique si liste vide
        if activeList.isEmpty {
            if let rawJson = suite.string(forKey: "mytrack_active_task"),
               let data = rawJson.data(using: .utf8),
               let single = try? JSONDecoder().decode(ActiveTaskWidgetModel.self, from: data) {
                activeList = [single]
            } else if let tempUrlData = try? Data(contentsOf: URL(fileURLWithPath: "/tmp/mytrack_active_task.json")),
                      let single = try? JSONDecoder().decode(ActiveTaskWidgetModel.self, from: tempUrlData) {
                activeList = [single]
            }
        }

        // 3. Filtrer les tâches terminées ou démarrées depuis > 24h
        let nowTs = Date().timeIntervalSince1970
        let filtered = activeList.filter { activeTask in
            if let matching = tasks.first(where: { $0.id == activeTask.taskId }), matching.isCompleted == true {
                return false
            }
            if nowTs - activeTask.startedAtTimestamp > 86400 {
                return false
            }
            return true
        }

        return Array(filtered.prefix(2))
    }

    private func fetchLocalTasksList() -> [TaskItemWidgetModel] {
        if let rawJson = UserDefaults(suiteName: "group.com.mytrack.app")?.string(forKey: "mytrack_tasks_list")
            ?? UserDefaults.standard.string(forKey: "mytrack_tasks_list"),
           let data = rawJson.data(using: .utf8),
           let list = try? JSONDecoder().decode([TaskItemWidgetModel].self, from: data),
           !list.isEmpty {
            return list
        }

        let tempUrl = URL(fileURLWithPath: "/tmp/mytrack_tasks_list.json")
        if let data = try? Data(contentsOf: tempUrl),
           let list = try? JSONDecoder().decode([TaskItemWidgetModel].self, from: data),
           !list.isEmpty {
            return list
        }

        return []
    }

    private func getSelectedTaskId() -> String? {
        return UserDefaults(suiteName: "group.com.mytrack.app")?.string(forKey: "mytrack_selected_widget_task_id")
            ?? UserDefaults.standard.string(forKey: "mytrack_selected_widget_task_id")
    }

    private func getCurrentPage() -> Int {
        return UserDefaults(suiteName: "group.com.mytrack.app")?.integer(forKey: "mytrack_widget_task_page")
            ?? UserDefaults.standard.integer(forKey: "mytrack_widget_task_page")
    }

    func placeholder(in context: Context) -> ActiveTaskEntry {
        ActiveTaskEntry(
            date: Date(),
            activeTasks: [],
            tasks: [],
            selectedTaskId: nil,
            currentPage: 0
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (ActiveTaskEntry) -> Void) {
        let selectedId = getSelectedTaskId()
        let page = getCurrentPage()
        let localTasks = fetchLocalTasksList()
        let localActives = fetchLocalActiveTasks(tasks: localTasks)

        let entry = ActiveTaskEntry(
            date: Date(),
            activeTasks: localActives,
            tasks: localTasks,
            selectedTaskId: selectedId,
            currentPage: page
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ActiveTaskEntry>) -> Void) {
        let selectedId = getSelectedTaskId()
        let page = getCurrentPage()
        let localTasks = fetchLocalTasksList()
        let localActives = fetchLocalActiveTasks(tasks: localTasks)

        let entry = ActiveTaskEntry(
            date: Date(),
            activeTasks: localActives,
            tasks: localTasks,
            selectedTaskId: selectedId,
            currentPage: page
        )

        // Rafraîchissement régulier toutes les 5 minutes (ou instantané lors des AppIntents)
        let nextUpdate = Date().addingTimeInterval(300)
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - 3. Composant Widget principal
struct MyTrackWidget: Widget {
    let kind: String = "MyTrackWidget"

    private static var supportedWidgetFamilies: [WidgetFamily] {
        if #available(iOS 16.0, *) {
            return [.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryInline, .accessoryCircular]
        } else {
            return [.systemSmall, .systemMedium, .systemLarge]
        }
    }

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            MyTrackWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("myTrack — Tâches & Chrono")
        .description("Suivez vos tâches actives ou choisissez une tâche à démarrer en un clic.")
        .supportedFamilies(MyTrackWidget.supportedWidgetFamilies)
    }
}

// MARK: - 4. Vues de rendu
struct MyTrackWidgetEntryView: View {
    let entry: ActiveTaskEntry
    @Environment(\.widgetFamily) var family

    let brandNeon = Color(red: 0.83, green: 0.96, blue: 0.24) // #D4F63D
    let darkBg = Color(red: 0.07, green: 0.07, blue: 0.08) // #111214

    var body: some View {
        Group {
            // --- Vues Écran Verrouillé (Accessory Widgets) ---
            if family == .accessoryRectangular {
                LockScreenAccessoryRectangularView(entry: entry, brandNeon: brandNeon, darkBg: darkBg)
            } else if family == .accessoryInline {
                LockScreenAccessoryInlineView(entry: entry)
            } else if family == .accessoryCircular {
                LockScreenAccessoryCircularView(entry: entry, brandNeon: brandNeon, darkBg: darkBg)
            }
            // --- Vues Home Screen Déverrouillé ---
            else if entry.activeTasks.count >= 2 {
                // 2 Tâches Actives simultanées (l'une sous l'autre en Medium)
                if family == .systemMedium {
                    DualMediumActiveTasksView(tasks: entry.activeTasks, brandNeon: brandNeon, darkBg: darkBg)
                } else if family == .systemLarge {
                    DualLargeActiveTasksView(tasks: entry.activeTasks, brandNeon: brandNeon, darkBg: darkBg)
                } else {
                    SmallActiveTaskView(task: entry.activeTasks[0], brandNeon: brandNeon, darkBg: darkBg)
                }
            } else if let singleActive = entry.activeTasks.first {
                // 1 Tâche Active
                if family == .systemMedium {
                    MediumActiveTaskView(task: singleActive, brandNeon: brandNeon, darkBg: darkBg)
                } else if family == .systemLarge {
                    LargeActiveTaskView(task: singleActive, brandNeon: brandNeon, darkBg: darkBg)
                } else {
                    SmallActiveTaskView(task: singleActive, brandNeon: brandNeon, darkBg: darkBg)
                }
            } else {
                // Aucune tâche active -> Liste des tâches avec barre de saisie
                if family == .systemLarge {
                    LargeTasksListWidgetView(
                        tasks: entry.tasks,
                        selectedTaskId: entry.selectedTaskId,
                        currentPage: entry.currentPage,
                        brandNeon: brandNeon,
                        darkBg: darkBg
                    )
                } else if family == .systemMedium {
                    MediumTasksListWidgetView(
                        tasks: entry.tasks,
                        selectedTaskId: entry.selectedTaskId,
                        currentPage: entry.currentPage,
                        brandNeon: brandNeon,
                        darkBg: darkBg
                    )
                } else {
                    SmallTasksListWidgetView(
                        tasks: entry.tasks,
                        selectedTaskId: entry.selectedTaskId,
                        brandNeon: brandNeon,
                        darkBg: darkBg
                    )
                }
            }
        }
        .containerBackground(for: .widget) {
            if family == .accessoryRectangular || family == .accessoryInline || family == .accessoryCircular {
                Color.clear
            } else if !entry.activeTasks.isEmpty {
                brandNeon
            } else {
                darkBg
            }
        }
    }
}

// MARK: - 5. Vues Écran Verrouillé (Lock Screen Widgets)

struct LockScreenAccessoryRectangularView: View {
    let entry: ActiveTaskEntry
    let brandNeon: Color
    let darkBg: Color

    var body: some View {
        if let active = entry.activeTasks.first {
            // Mode Tâche Active sur Écran Verrouillé
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    AppLogoView(size: 11)
                    Text(active.taskTitle)
                        .font(.system(size: 12, weight: .bold))
                        .lineLimit(1)
                }
                
                Text(active.subtitle ?? active.category ?? "En cours")
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
                    .lineLimit(1)

                HStack(spacing: 3) {
                    Text("⏱")
                        .font(.system(size: 9))
                    Text(timerInterval: active.safeStartedAt...Date(timeIntervalSinceNow: 86400), countsDown: false)
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                }
            }
        } else {
            // Mode Inactif sur Écran Verrouillé : Input / Ajouter + Prochaine tâche sur la liste
            Link(destination: URL(string: "mytrack://tasks?action=new-task")!) {
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 4) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 10, weight: .bold))
                        Text("Ajouter...")
                            .font(.system(size: 11, weight: .bold))
                        Spacer()
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2.5)
                    .background(Color.white.opacity(0.15))
                    .cornerRadius(6)

                    if let nextTask = entry.tasks.first(where: { $0.isCompleted != true }) {
                        HStack(spacing: 3) {
                            Text("📋")
                                .font(.system(size: 9))
                            Text(nextTask.title)
                                .font(.system(size: 10.5, weight: .medium))
                                .lineLimit(1)
                        }
                    } else {
                        Text("🎉 Toutes terminées")
                            .font(.system(size: 9.5))
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
    }
}

struct LockScreenAccessoryInlineView: View {
    let entry: ActiveTaskEntry

    var body: some View {
        if let active = entry.activeTasks.first {
            Text("⏱ \(active.taskTitle)")
        } else if let nextTask = entry.tasks.first(where: { $0.isCompleted != true }) {
            Text("📋 \(nextTask.title)")
        } else {
            Text("myTrack • + Ajouter tâche")
        }
    }
}

struct LockScreenAccessoryCircularView: View {
    let entry: ActiveTaskEntry
    let brandNeon: Color
    let darkBg: Color

    var body: some View {
        if let active = entry.activeTasks.first {
            Link(destination: URL(string: "mytrack://tasks")!) {
                ZStack {
                    AccessoryWidgetBackground()
                    VStack(spacing: 1) {
                        Image(systemName: "timer")
                            .font(.system(size: 13, weight: .bold))
                        Text(active.taskTitle)
                            .font(.system(size: 8, weight: .bold))
                            .lineLimit(1)
                    }
                }
            }
        } else {
            Link(destination: URL(string: "mytrack://tasks?action=new-task")!) {
                ZStack {
                    AccessoryWidgetBackground()
                    Image(systemName: "plus")
                        .font(.system(size: 16, weight: .heavy))
                }
            }
        }
    }
}

// MARK: - 6. Vues Tâche Active Unique (Chrono & Bouton Arrêter)

struct MediumActiveTaskView: View {
    let task: ActiveTaskWidgetModel
    let brandNeon: Color
    let darkBg: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 8) {
                Link(destination: URL(string: "mytrack://tasks")!) {
                    HStack(alignment: .center, spacing: 8) {
                        AppLogoView(size: 22)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(task.taskTitle)
                                .font(.system(size: 15, weight: .bold))
                                .foregroundColor(darkBg)
                                .lineLimit(1)

                            Text(task.subtitle ?? task.category ?? "En cours")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(darkBg.opacity(0.8))
                                .lineLimit(1)
                        }
                    }
                }

                Spacer()

                Button(intent: StopTaskIntent(taskId: task.taskId)) {
                    HStack(spacing: 5) {
                        Image(systemName: "square.fill")
                            .font(.system(size: 10, weight: .bold))
                        Text("Arrêter")
                            .font(.system(size: 13, weight: .bold))
                    }
                    .foregroundColor(darkBg)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 7)
                    .background(Color.white)
                    .clipShape(Capsule())
                    .shadow(color: Color.black.opacity(0.12), radius: 3, x: 0, y: 1)
                }
                .buttonStyle(.plain)
            }

            Spacer()

            HStack(alignment: .center) {
                HStack(spacing: 4) {
                    Image(systemName: "clock.fill")
                        .font(.system(size: 11))
                    Text(task.category ?? "myTrack")
                        .font(.system(size: 11, weight: .semibold))
                }
                .foregroundColor(darkBg.opacity(0.85))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(darkBg.opacity(0.1))
                .cornerRadius(8)

                Spacer()

                HStack(spacing: 4) {
                    Text("⏱")
                        .font(.system(size: 11))
                    Text(timerInterval: task.safeStartedAt...Date(timeIntervalSinceNow: 86400), countsDown: false)
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .monospacedDigit()
                }
                .foregroundColor(brandNeon)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(darkBg)
                .cornerRadius(10)
                .shadow(color: Color.black.opacity(0.15), radius: 2, x: 0, y: 1)
            }
        }
        .padding(14)
    }
}

struct LargeActiveTaskView: View {
    let task: ActiveTaskWidgetModel
    let brandNeon: Color
    let darkBg: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            MediumActiveTaskView(task: task, brandNeon: brandNeon, darkBg: darkBg)
            
            Divider()
                .background(darkBg.opacity(0.2))

            VStack(alignment: .leading, spacing: 6) {
                Text("DÉTAILS DE LA SESSION")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(darkBg.opacity(0.7))

                HStack {
                    Text("Catégorie :")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(darkBg.opacity(0.8))
                    Text(task.category ?? "myTrack")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(darkBg)
                }

                if let total = task.totalFormattedDuration {
                    HStack {
                        Text("Objectif :")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(darkBg.opacity(0.8))
                        Text(total)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(darkBg)
                    }
                }
            }
            .padding(.horizontal, 14)
            .padding(.bottom, 10)
        }
    }
}

struct SmallActiveTaskView: View {
    let task: ActiveTaskWidgetModel
    let brandNeon: Color
    let darkBg: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Link(destination: URL(string: "mytrack://tasks")!) {
                HStack(spacing: 6) {
                    AppLogoView(size: 16)

                    Text("EN COURS")
                        .font(.system(size: 9, weight: .heavy))
                        .foregroundColor(darkBg.opacity(0.8))

                    Spacer()
                }
            }

            Text(task.taskTitle)
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(darkBg)
                .lineLimit(2)

            Spacer()

            HStack {
                Text(timerInterval: task.safeStartedAt...Date(timeIntervalSinceNow: 86400), countsDown: false)
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .monospacedDigit()
                    .foregroundColor(brandNeon)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(darkBg)
                    .cornerRadius(8)

                Spacer()

                Button(intent: StopTaskIntent(taskId: task.taskId)) {
                    Image(systemName: "square.fill")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(darkBg)
                        .padding(8)
                        .background(Color.white)
                        .clipShape(Circle())
                        .shadow(color: Color.black.opacity(0.15), radius: 2, x: 0, y: 1)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(12)
    }
}

// MARK: - 7. Vues Double Tâche Active (2 Actions simultanées l'une sous l'autre)

struct DualMediumActiveTasksView: View {
    let tasks: [ActiveTaskWidgetModel]
    let brandNeon: Color
    let darkBg: Color

    var body: some View {
        VStack(spacing: 6) {
            ForEach(Array(tasks.prefix(2).enumerated()), id: \.element.id) { index, task in
                HStack(alignment: .center, spacing: 8) {
                    AppLogoView(size: 16)

                    VStack(alignment: .leading, spacing: 1) {
                        Link(destination: URL(string: "mytrack://tasks")!) {
                            Text(task.taskTitle)
                                .font(.system(size: 12.5, weight: .bold))
                                .foregroundColor(darkBg)
                                .lineLimit(1)
                        }

                        Text(task.subtitle ?? task.category ?? "En cours")
                            .font(.system(size: 9.5, weight: .medium))
                            .foregroundColor(darkBg.opacity(0.8))
                            .lineLimit(1)
                    }

                    Spacer()

                    // Chronomètre en direct
                    HStack(spacing: 3) {
                        Text("⏱")
                            .font(.system(size: 9))
                        Text(timerInterval: task.safeStartedAt...Date(timeIntervalSinceNow: 86400), countsDown: false)
                            .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                            .monospacedDigit()
                    }
                    .foregroundColor(brandNeon)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 4)
                    .background(darkBg)
                    .cornerRadius(8)
                    .shadow(color: Color.black.opacity(0.12), radius: 2, x: 0, y: 1)

                    // Bouton Stop
                    Button(intent: StopTaskIntent(taskId: task.taskId)) {
                        HStack(spacing: 3) {
                            Image(systemName: "square.fill")
                                .font(.system(size: 7.5, weight: .bold))
                            Text("Stop")
                                .font(.system(size: 10, weight: .bold))
                        }
                        .foregroundColor(darkBg)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                        .background(Color.white)
                        .clipShape(Capsule())
                        .shadow(color: Color.black.opacity(0.12), radius: 2, x: 0, y: 1)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .background(Color.white.opacity(0.24))
                .cornerRadius(12)
            }
        }
        .padding(8)
    }
}

struct DualLargeActiveTasksView: View {
    let tasks: [ActiveTaskWidgetModel]
    let brandNeon: Color
    let darkBg: Color

    var body: some View {
        VStack(spacing: 9) {
            HStack {
                AppLogoView(size: 18)
                Text("2 ACTIONS EN COURS")
                    .font(.system(size: 11, weight: .heavy))
                    .foregroundColor(darkBg.opacity(0.85))
                Spacer()
            }
            .padding(.horizontal, 4)

            ForEach(Array(tasks.prefix(2)), id: \.id) { task in
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .top, spacing: 8) {
                        Link(destination: URL(string: "mytrack://tasks")!) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(task.taskTitle)
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(darkBg)
                                    .lineLimit(1)

                                Text(task.subtitle ?? task.category ?? "En cours")
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundColor(darkBg.opacity(0.8))
                                    .lineLimit(1)
                            }
                        }

                        Spacer()

                        Button(intent: StopTaskIntent(taskId: task.taskId)) {
                            HStack(spacing: 4) {
                                Image(systemName: "square.fill")
                                    .font(.system(size: 9, weight: .bold))
                                Text("Arrêter")
                                    .font(.system(size: 12, weight: .bold))
                            }
                            .foregroundColor(darkBg)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.white)
                            .clipShape(Capsule())
                            .shadow(color: Color.black.opacity(0.12), radius: 2, x: 0, y: 1)
                        }
                        .buttonStyle(.plain)
                    }

                    HStack(alignment: .center) {
                        HStack(spacing: 4) {
                            Image(systemName: "clock.fill")
                                .font(.system(size: 10))
                            Text(task.category ?? "myTrack")
                                .font(.system(size: 10, weight: .semibold))
                        }
                        .foregroundColor(darkBg.opacity(0.85))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(darkBg.opacity(0.1))
                        .cornerRadius(6)

                        if let total = task.totalFormattedDuration, !total.isEmpty {
                            Text("• \(total)")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(darkBg.opacity(0.75))
                        }

                        Spacer()

                        HStack(spacing: 4) {
                            Text("⏱")
                                .font(.system(size: 10))
                            Text(timerInterval: task.safeStartedAt...Date(timeIntervalSinceNow: 86400), countsDown: false)
                                .font(.system(size: 11.5, weight: .bold, design: .monospaced))
                                .monospacedDigit()
                        }
                        .foregroundColor(brandNeon)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 4)
                        .background(darkBg)
                        .cornerRadius(9)
                    }
                }
                .padding(12)
                .background(Color.white.opacity(0.24))
                .cornerRadius(15)
            }
        }
        .padding(11)
    }
}

// MARK: - 8. Vues Liste des Tâches avec Pagination & Input & Sélection Instantanée

struct MediumTasksListWidgetView: View {
    let tasks: [TaskItemWidgetModel]
    let selectedTaskId: String?
    let currentPage: Int
    let brandNeon: Color
    let darkBg: Color

    let pageSize = 2

    var body: some View {
        let totalPages = max(1, Int(ceil(Double(tasks.count) / Double(pageSize))))
        let safePage = min(max(0, currentPage), totalPages - 1)
        let pageTasks = Array(tasks.dropFirst(safePage * pageSize).prefix(pageSize))

        VStack(alignment: .leading, spacing: 6) {
            // Header compact: Bouton Lancer App + Barre de saisie + Boutons de défilement / pagination
            HStack(spacing: 5) {
                // Bouton haut-gauche pour lancer l'application directement
                Link(destination: URL(string: "mytrack://tasks")!) {
                    AppLogoView(size: 26, cornerRadius: 8)
                }

                Link(destination: URL(string: "mytrack://tasks?action=new-task")!) {
                    HStack(spacing: 5) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(brandNeon)
                        Text("Ajouter...")
                            .font(.system(size: 10.5, weight: .medium))
                            .foregroundColor(Color(white: 0.6))
                        Spacer()
                    }
                    .padding(.horizontal, 7)
                    .padding(.vertical, 5)
                    .background(Color.white.opacity(0.08))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.white.opacity(0.12), lineWidth: 1)
                    )
                    .cornerRadius(8)
                }

                if totalPages > 1 {
                    HStack(spacing: 3) {
                        Button(intent: ChangeTaskPageIntent(delta: -1)) {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(.white)
                                .frame(width: 20, height: 20)
                                .background(Color.white.opacity(0.12))
                                .clipShape(Circle())
                        }
                        .buttonStyle(.plain)

                        Text("\(safePage + 1)/\(totalPages)")
                            .font(.system(size: 9, weight: .semibold, design: .monospaced))
                            .foregroundColor(Color(white: 0.7))

                        Button(intent: ChangeTaskPageIntent(delta: 1)) {
                            Image(systemName: "chevron.right")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(.white)
                                .frame(width: 20, height: 20)
                                .background(Color.white.opacity(0.12))
                                .clipShape(Circle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            if tasks.isEmpty {
                Spacer()
                HStack {
                    Spacer()
                    Text("Aucune tâche aujourd'hui")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Color.gray)
                    Spacer()
                }
                Spacer()
            } else {
                VStack(spacing: 5) {
                    ForEach(pageTasks) { task in
                        TaskRowInteractiveView(
                            task: task,
                            isSelected: selectedTaskId == task.id,
                            brandNeon: brandNeon,
                            darkBg: darkBg
                        )
                    }
                }
            }
        }
        .padding(10)
    }
}

struct LargeTasksListWidgetView: View {
    let tasks: [TaskItemWidgetModel]
    let selectedTaskId: String?
    let currentPage: Int
    let brandNeon: Color
    let darkBg: Color

    let pageSize = 5

    var body: some View {
        let totalPages = max(1, Int(ceil(Double(tasks.count) / Double(pageSize))))
        let safePage = min(max(0, currentPage), totalPages - 1)
        let pageTasks = Array(tasks.dropFirst(safePage * pageSize).prefix(pageSize))

        VStack(alignment: .leading, spacing: 9) {
            // Header avec bouton de lancement de l'application + pagination
            HStack(spacing: 8) {
                Link(destination: URL(string: "mytrack://tasks")!) {
                    HStack(spacing: 6) {
                        AppLogoView(size: 18)

                        Text("myTrack")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.white.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }

                Text("• Mes Tâches")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Color(white: 0.75))

                if !tasks.isEmpty {
                    Text("(\(tasks.count))")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(brandNeon)
                }

                Spacer()

                if totalPages > 1 {
                    HStack(spacing: 4) {
                        Button(intent: ChangeTaskPageIntent(delta: -1)) {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.white)
                                .frame(width: 22, height: 22)
                                .background(Color.white.opacity(0.12))
                                .clipShape(Circle())
                        }
                        .buttonStyle(.plain)

                        Text("\(safePage + 1)/\(totalPages)")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundColor(Color(white: 0.8))

                        Button(intent: ChangeTaskPageIntent(delta: 1)) {
                            Image(systemName: "chevron.right")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.white)
                                .frame(width: 22, height: 22)
                                .background(Color.white.opacity(0.12))
                                .clipShape(Circle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            // Barre de saisie / Input pour ajouter directement une tâche
            Link(destination: URL(string: "mytrack://tasks?action=new-task")!) {
                HStack(spacing: 8) {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(brandNeon)
                    Text("Nom de la tâche...")
                        .font(.system(size: 12))
                        .foregroundColor(Color(white: 0.55))
                    Spacer()
                    Image(systemName: "return")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(Color(white: 0.4))
                }
                .padding(.horizontal, 11)
                .padding(.vertical, 7)
                .background(Color.white.opacity(0.07))
                .overlay(
                    RoundedRectangle(cornerRadius: 11)
                        .stroke(Color.white.opacity(0.14), lineWidth: 1)
                )
                .cornerRadius(11)
            }

            if tasks.isEmpty {
                Spacer()
                HStack {
                    Spacer()
                    VStack(spacing: 4) {
                        Text("🎉 Toutes les tâches sont terminées !")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.white)
                        Text("Touchez + pour en ajouter une nouvelle.")
                            .font(.system(size: 11))
                            .foregroundColor(Color.gray)
                    }
                    Spacer()
                }
                Spacer()
            } else {
                VStack(spacing: 5) {
                    ForEach(pageTasks) { task in
                        TaskRowInteractiveView(
                            task: task,
                            isSelected: selectedTaskId == task.id,
                            brandNeon: brandNeon,
                            darkBg: darkBg
                        )
                    }
                }
            }
        }
        .padding(12)
    }
}

struct SmallTasksListWidgetView: View {
    let tasks: [TaskItemWidgetModel]
    let selectedTaskId: String?
    let brandNeon: Color
    let darkBg: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Link(destination: URL(string: "mytrack://tasks")!) {
                HStack(spacing: 5) {
                    AppLogoView(size: 16)
                    Text("myTrack")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.white)
                    Spacer()
                }
            }

            if let firstTask = tasks.first {
                let isExternal = firstTask.id.starts(with: "ext_")
                let eventColor = (firstTask.color != nil && !firstTask.color!.isEmpty)
                    ? Color(hexString: firstTask.color!)
                    : Color(red: 0.23, green: 0.51, blue: 0.96)

                Text(firstTask.title)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(2)

                HStack(spacing: 4) {
                    if isExternal {
                        Image(systemName: "calendar")
                            .font(.system(size: 9))
                            .foregroundColor(eventColor)
                    }
                    Text(firstTask.category)
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(isExternal ? eventColor : Color.gray)
                        .lineLimit(1)
                }

                if let timeStr = firstTask.targetFormattedDuration ?? firstTask.subtitle {
                    Text(timeStr)
                        .font(.system(size: 9.5))
                        .foregroundColor(Color(white: 0.7))
                        .lineLimit(1)
                }

                Spacer()

                Button(intent: StartTaskIntent(taskId: firstTask.id, taskTitle: firstTask.title, category: firstTask.category)) {
                    HStack(spacing: 4) {
                        Image(systemName: "play.fill")
                            .font(.system(size: 10, weight: .bold))
                        Text(isExternal ? "Suivre" : "Démarrer")
                            .font(.system(size: 11, weight: .bold))
                    }
                    .foregroundColor(darkBg)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(brandNeon)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            } else {
                Spacer()
                Text("Aucune tâche")
                    .font(.system(size: 11))
                    .foregroundColor(Color.gray)
                Spacer()
            }
        }
        .padding(12)
    }
}

// MARK: - 9. Ligne de tâche Interactive (Sélection + Bouton Play Démarrer)
struct TaskRowInteractiveView: View {
    let task: TaskItemWidgetModel
    let isSelected: Bool
    let brandNeon: Color
    let darkBg: Color

    var isExternalEvent: Bool {
        task.id.starts(with: "ext_")
    }

    var accentColor: Color {
        if let hex = task.color, !hex.isEmpty {
            return Color(hexString: hex)
        }
        return isExternalEvent ? Color(red: 0.23, green: 0.51, blue: 0.96) : brandNeon
    }

    var body: some View {
        HStack(spacing: 7) {
            // Bouton de sélection de la tâche / événement
            Button(intent: SelectTaskIntent(taskId: task.id)) {
                HStack(spacing: 7) {
                    if isExternalEvent {
                        Image(systemName: isSelected ? "calendar.badge.clock" : "calendar")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(isSelected ? brandNeon : accentColor)
                    } else {
                        Image(systemName: isSelected ? "checkmark.circle.fill" : (task.isCompleted == true ? "checkmark.circle" : "circle"))
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(isSelected ? brandNeon : (task.isCompleted == true ? Color.gray.opacity(0.5) : Color.gray))
                    }

                    VStack(alignment: .leading, spacing: 1) {
                        Text(task.title)
                            .font(.system(size: 12, weight: isSelected ? .bold : .semibold))
                            .foregroundColor(isSelected ? .white : (task.isCompleted == true ? Color.white.opacity(0.5) : Color.white.opacity(0.95)))
                            .strikethrough(task.isCompleted == true && !isSelected)
                            .lineLimit(1)

                        HStack(spacing: 4) {
                            Text(task.category)
                                .font(.system(size: 9.5, weight: .medium))
                                .foregroundColor(isSelected ? brandNeon : (isExternalEvent ? accentColor : Color.gray))
                            
                            if let dur = task.targetFormattedDuration ?? task.subtitle {
                                Text("• \(dur)")
                                    .font(.system(size: 9.5))
                                    .foregroundColor(Color.gray)
                            }
                        }
                    }

                    Spacer()
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            // BOUTON PLAY qui apparaît quand la tâche est sélectionnée
            if isSelected {
                Button(intent: StartTaskIntent(taskId: task.id, taskTitle: task.title, category: task.category)) {
                    HStack(spacing: 4) {
                        Image(systemName: "play.fill")
                            .font(.system(size: 9.5, weight: .heavy))
                        Text("Play")
                            .font(.system(size: 11, weight: .heavy))
                    }
                    .foregroundColor(darkBg)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(brandNeon)
                    .clipShape(Capsule())
                    .shadow(color: brandNeon.opacity(0.3), radius: 3, x: 0, y: 1)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 6)
        .background(isSelected ? Color.white.opacity(0.12) : Color.white.opacity(0.04))
        .overlay(
            RoundedRectangle(cornerRadius: 11)
                .stroke(isSelected ? brandNeon.opacity(0.8) : Color.clear, lineWidth: 1.5)
        )
        .cornerRadius(11)
    }
}

// MARK: - Extension Color pour codes HEX (#3B82F6, etc.)
extension Color {
    init(hexString: String) {
        let hex = hexString.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
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

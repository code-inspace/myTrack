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
    public let projectColor: String?
    public let projectName: String?

    public var safeStartedAt: Date {
        let ts = startedAtTimestamp > 10000000000 ? startedAtTimestamp / 1000.0 : startedAtTimestamp
        let d = Date(timeIntervalSince1970: ts)
        if d > Date() {
            return Date()
        }
        return d
    }

    /// Couleur d'accent du projet (brandNeon #D4F63D si non défini)
    public var accentColor: Color {
        if let hex = projectColor, !hex.isEmpty {
            return Color(hexString: hex)
        }
        return Color(red: 0.83, green: 0.96, blue: 0.24)
    }

    public init(
        taskId: String,
        taskTitle: String,
        category: String? = nil,
        subtitle: String? = nil,
        startedAtTimestamp: Double = Date().timeIntervalSince1970,
        totalFormattedDuration: String? = nil,
        projectColor: String? = nil,
        projectName: String? = nil
    ) {
        self.taskId = taskId
        self.taskTitle = taskTitle
        self.category = category
        self.subtitle = subtitle
        self.startedAtTimestamp = startedAtTimestamp
        self.totalFormattedDuration = totalFormattedDuration
        self.projectColor = projectColor
        self.projectName = projectName
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
    public let projectName: String?
    public let projectColor: String?

    public init(
        id: String,
        title: String,
        category: String = "myTrack",
        subtitle: String? = nil,
        targetFormattedDuration: String? = nil,
        isHabit: Bool? = false,
        color: String? = "#D4F63D",
        isCompleted: Bool? = false,
        projectName: String? = nil,
        projectColor: String? = nil
    ) {
        self.id = id
        self.title = title
        self.category = category
        self.subtitle = subtitle
        self.targetFormattedDuration = targetFormattedDuration
        self.isHabit = isHabit
        self.color = color
        self.isCompleted = isCompleted
        self.projectName = projectName
        self.projectColor = projectColor
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
    public let isSleepMode: Bool
    public let bedtime: String?
    public let wakeTime: String?
    public let sleepPhaseIndex: Int
    public let sleepPhaseCount: Int
    public let isAwakeBetweenPhases: Bool
    public let isSecondSleep: Bool

    public var activeTask: ActiveTaskWidgetModel? {
        activeTasks.first
    }

    public init(
        date: Date,
        activeTasks: [ActiveTaskWidgetModel] = [],
        tasks: [TaskItemWidgetModel] = [],
        selectedTaskId: String? = nil,
        currentPage: Int = 0,
        isSleepMode: Bool = false,
        bedtime: String? = nil,
        wakeTime: String? = nil,
        sleepPhaseIndex: Int = 1,
        sleepPhaseCount: Int = 1,
        isAwakeBetweenPhases: Bool = false,
        isSecondSleep: Bool = false
    ) {
        self.date = date
        self.activeTasks = activeTasks
        self.tasks = tasks
        self.selectedTaskId = selectedTaskId
        self.currentPage = currentPage
        self.isSleepMode = isSleepMode
        self.bedtime = bedtime
        self.wakeTime = wakeTime
        self.sleepPhaseIndex = sleepPhaseIndex
        self.sleepPhaseCount = sleepPhaseCount
        self.isAwakeBetweenPhases = isAwakeBetweenPhases
        self.isSecondSleep = isSecondSleep
    }
}

// MARK: - 2. Provider de données
struct Provider: TimelineProvider {
    private func fetchSleepState() -> (isSleepMode: Bool, bedtime: String?, wakeTime: String?, phaseIndex: Int, phaseCount: Int, isAwake: Bool, isSecondSleep: Bool) {
        let suite = UserDefaults(suiteName: "group.com.mytrack.app") ?? UserDefaults.standard
        let isActive = suite.bool(forKey: "mytrack_sleep_is_active")
        let isAwake = suite.bool(forKey: "mytrack_sleep_is_awake_between_phases")
        let isSecondSleepStored = suite.bool(forKey: "mytrack_sleep_is_second_sleep")
        let currentBedtime = suite.string(forKey: "mytrack_sleep_current_bedtime")
        let currentWakeTime = suite.string(forKey: "mytrack_sleep_current_wake_time")
        let lastWakeTs = suite.double(forKey: "mytrack_sleep_last_wake_timestamp")
        let phaseIndex = max(1, suite.integer(forKey: "mytrack_sleep_phase_index"))

        var sessionCount = 0
        if let raw = suite.string(forKey: "mytrack_sleep_sessions"),
           let data = raw.data(using: .utf8),
           let list = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            sessionCount = list.count
        }

        let isSecondSleep = isSecondSleepStored || phaseIndex > 1 || sessionCount >= 1

        let canceledTs = suite.double(forKey: "mytrack_sleep_canceled_second_sleep_ts")
        let startedSleepTs = suite.double(forKey: "mytrack_sleep_started_timestamp")
        let nowTs = Date().timeIntervalSince1970
        let isRecentlyCanceled = canceledTs > 0 && (nowTs - canceledTs < 8 * 3600) && (startedSleepTs <= canceledTs)

        let calendar = Calendar.current
        let hour = calendar.component(.hour, from: Date())
        let isInSleepWindow = hour >= 23 || hour < 12

        let hasWokenUpToday: Bool = {
            if lastWakeTs > 0 {
                let wakeDate = Date(timeIntervalSince1970: lastWakeTs)
                return calendar.isDateInToday(wakeDate)
            }
            return currentWakeTime != nil && !isActive
        }()

        let shouldShowSleep: Bool
        if isRecentlyCanceled {
            // L'utilisateur a explicitement cliqué sur "Je ne dors pas" : interdiction formelle d'afficher le sommeil
            shouldShowSleep = false
        } else if isActive {
            shouldShowSleep = true
        } else if hasWokenUpToday {
            // L'utilisateur s'est déjà réveillé aujourd'hui : le widget doit afficher le mode normal immédiatement
            shouldShowSleep = false
        } else {
            // Pas encore de réveil aujourd'hui : afficher le mode sommeil si dans la fenêtre nocturne/matinale
            shouldShowSleep = isInSleepWindow
        }

        return (
            isSleepMode: shouldShowSleep,
            bedtime: currentBedtime ?? "23:00",
            wakeTime: currentWakeTime,
            phaseIndex: phaseIndex,
            phaseCount: max(phaseIndex, sessionCount),
            isAwake: isAwake,
            isSecondSleep: isSecondSleep
        )
    }

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
            currentPage: 0,
            isSleepMode: false,
            isSecondSleep: false
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (ActiveTaskEntry) -> Void) {
        let selectedId = getSelectedTaskId()
        let page = getCurrentPage()
        let localTasks = fetchLocalTasksList()
        let localActives = fetchLocalActiveTasks(tasks: localTasks)
        let sleep = fetchSleepState()

        let entry = ActiveTaskEntry(
            date: Date(),
            activeTasks: localActives,
            tasks: localTasks,
            selectedTaskId: selectedId,
            currentPage: page,
            isSleepMode: sleep.isSleepMode,
            bedtime: sleep.bedtime,
            wakeTime: sleep.wakeTime,
            sleepPhaseIndex: sleep.phaseIndex,
            sleepPhaseCount: sleep.phaseCount,
            isAwakeBetweenPhases: sleep.isAwake,
            isSecondSleep: sleep.isSecondSleep
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ActiveTaskEntry>) -> Void) {
        let selectedId = getSelectedTaskId()
        let page = getCurrentPage()
        let localTasks = fetchLocalTasksList()
        let localActives = fetchLocalActiveTasks(tasks: localTasks)
        let sleep = fetchSleepState()

        let entry = ActiveTaskEntry(
            date: Date(),
            activeTasks: localActives,
            tasks: localTasks,
            selectedTaskId: selectedId,
            currentPage: page,
            isSleepMode: sleep.isSleepMode,
            bedtime: sleep.bedtime,
            wakeTime: sleep.wakeTime,
            sleepPhaseIndex: sleep.phaseIndex,
            sleepPhaseCount: sleep.phaseCount,
            isAwakeBetweenPhases: sleep.isAwake,
            isSecondSleep: sleep.isSecondSleep
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

    private var accessoryDestinationURL: URL {
        if !entry.activeTasks.isEmpty {
            return URL(string: "mytrack://tasks")!
        } else if entry.isSleepMode {
            return URL(string: "mytrack://sleep")!
        } else {
            return URL(string: "mytrack://tasks?action=new-task")!
        }
    }

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
            } else if entry.isSleepMode {
                // MODE SOMMEIL DÉTECTÉ (23h - 12h ou Sommeil actif)
                if family == .systemLarge {
                    LargeSleepWidgetView(entry: entry, brandNeon: brandNeon, darkBg: darkBg)
                } else if family == .systemMedium {
                    MediumSleepWidgetView(entry: entry, brandNeon: brandNeon, darkBg: darkBg)
                } else {
                    SmallSleepWidgetView(entry: entry, brandNeon: brandNeon, darkBg: darkBg)
                }
            } else {
                // Aucune tâche active et hors sommeil -> Liste des tâches avec barre de saisie
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
        .widgetURL(family == .accessoryRectangular || family == .accessoryInline || family == .accessoryCircular ? accessoryDestinationURL : nil)
        .containerBackground(for: .widget) {
            if family == .accessoryRectangular || family == .accessoryInline || family == .accessoryCircular {
                Color.clear
            } else if !entry.activeTasks.isEmpty {
                brandNeon
            } else if entry.isSleepMode {
                Color(red: 0.08, green: 0.09, blue: 0.13)
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
    let sleepIndigo = Color(red: 0.38, green: 0.45, blue: 0.98)

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
                
                Text(active.projectName ?? active.subtitle ?? (active.category != "Général" ? active.category : nil) ?? "En cours")
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
        } else if entry.isSleepMode {
            // Mode Sommeil sur Écran Verrouillé
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Image(systemName: "moon.stars.fill")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(sleepIndigo)
                    Text("Mode Sommeil")
                        .font(.system(size: 12, weight: .bold))
                        .lineLimit(1)
                }

                if let bTime = entry.bedtime {
                    Text("Couché : \(bTime)")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.secondary)
                }

                if let wTime = entry.wakeTime {
                    Text("Réveil : \(wTime)")
                        .font(.system(size: 10, weight: .semibold))
                } else {
                    Text("En sommeil...")
                        .font(.system(size: 9.5))
                        .foregroundColor(.secondary)
                }
            }
        } else {
            // Mode Inactif sur Écran Verrouillé : Input / Ajouter + Prochaine tâche sur la liste
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

struct LockScreenAccessoryInlineView: View {
    let entry: ActiveTaskEntry

    var body: some View {
        if let active = entry.activeTasks.first {
            Text("⏱ \(active.taskTitle)")
        } else if entry.isSleepMode {
            if let bTime = entry.bedtime {
                Text("🌙 Sommeil • Couché \(bTime)")
            } else {
                Text("🌙 Mode Sommeil")
            }
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
        } else if entry.isSleepMode {
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 1) {
                    Image(systemName: "moon.stars.fill")
                        .font(.system(size: 13, weight: .bold))
                    Text("Sommeil")
                        .font(.system(size: 7.5, weight: .bold))
                }
            }
        } else {
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "plus")
                    .font(.system(size: 16, weight: .heavy))
            }
        }
    }
}

// MARK: - Sleep Mode Widget Views

struct MediumSleepWidgetView: View {
    let entry: ActiveTaskEntry
    let brandNeon: Color
    let darkBg: Color
    let sleepIndigo = Color(red: 0.38, green: 0.45, blue: 0.98) // #6173FA
    let cancelRed = Color(red: 0.95, green: 0.26, blue: 0.21)

    var body: some View {
        let phaseIdx = entry.sleepPhaseIndex
        let isAwake = entry.isAwakeBetweenPhases
        let isSecond = entry.isSecondSleep || phaseIdx > 1

        VStack(alignment: .leading, spacing: 9) {
            // Header
            HStack(alignment: .center, spacing: 8) {
                Link(destination: URL(string: "mytrack://sleep")!) {
                    HStack(spacing: 6) {
                        ZStack {
                            Circle()
                                .fill((isSecond ? sleepIndigo : sleepIndigo).opacity(0.25))
                                .frame(width: 26, height: 26)
                            Image(systemName: isAwake ? "sun.haze.fill" : (isSecond ? "moon.zzz.fill" : "moon.stars.fill"))
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(isAwake ? brandNeon : (isSecond ? Color(red: 0.65, green: 0.72, blue: 1.0) : sleepIndigo))
                        }

                        VStack(alignment: .leading, spacing: 1) {
                            HStack(spacing: 4) {
                                Text(isSecond ? "2nd Sommeil" : "Mode Sommeil")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(.white)

                                if phaseIdx > 1 {
                                    Text("Phase \(phaseIdx)")
                                        .font(.system(size: 9, weight: .heavy))
                                        .foregroundColor(sleepIndigo)
                                        .padding(.horizontal, 5)
                                        .padding(.vertical, 1)
                                        .background(sleepIndigo.opacity(0.2))
                                        .clipShape(Capsule())
                                }
                            }

                            Text(isSecond ? "Détecté après inactivité" : (isAwake ? "Réveillé" : "Enregistrement du sommeil"))
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(Color.gray)
                        }
                    }
                }

                Spacer()

                if let bTime = entry.bedtime {
                    HStack(spacing: 4) {
                        Image(systemName: "bed.double.fill")
                            .font(.system(size: 10))
                        Text(bTime)
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                    }
                    .foregroundColor(sleepIndigo)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.white.opacity(0.08))
                    .cornerRadius(8)
                }
            }

            Spacer(minLength: 2)

            // Boutons Interactifs
            HStack(spacing: 8) {
                if isSecond {
                    // Pour le 2ème sommeil : Bouton "Je ne dors pas" (annuler ce sommeil)
                    Button(intent: SleepNotSleepingIntent()) {
                        HStack(spacing: 5) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 11, weight: .bold))
                            Text("Je ne dors pas")
                                .font(.system(size: 11.5, weight: .bold))
                                .lineLimit(1)
                        }
                        .foregroundColor(Color.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(Color.white.opacity(0.14))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)

                    // Bouton "Je me réveille"
                    Button(intent: SleepWakeNowIntent()) {
                        HStack(spacing: 5) {
                            Image(systemName: "sun.max.fill")
                                .font(.system(size: 11, weight: .bold))
                            Text("Je me réveille")
                                .font(.system(size: 11.5, weight: .bold))
                                .lineLimit(1)
                        }
                        .foregroundColor(Color(red: 0.07, green: 0.07, blue: 0.08))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(brandNeon)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .shadow(color: brandNeon.opacity(0.25), radius: 2, x: 0, y: 1)
                    }
                    .buttonStyle(.plain)
                } else {
                    // Pour le 1er sommeil initial
                    Button(intent: SleepStartNowIntent()) {
                        HStack(spacing: 5) {
                            Image(systemName: "bed.double.fill")
                                .font(.system(size: 11, weight: .bold))
                            Text("Je me couche")
                                .font(.system(size: 12, weight: .bold))
                                .lineLimit(1)
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(sleepIndigo.opacity(0.9))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .shadow(color: sleepIndigo.opacity(0.3), radius: 2, x: 0, y: 1)
                    }
                    .buttonStyle(.plain)

                    Button(intent: SleepWakeNowIntent()) {
                        HStack(spacing: 5) {
                            Image(systemName: "sun.max.fill")
                                .font(.system(size: 11, weight: .bold))
                            Text("Je me réveille")
                                .font(.system(size: 12, weight: .bold))
                                .lineLimit(1)
                        }
                        .foregroundColor(Color(red: 0.07, green: 0.07, blue: 0.08))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(brandNeon)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .shadow(color: brandNeon.opacity(0.25), radius: 2, x: 0, y: 1)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(13)
    }
}

struct LargeSleepWidgetView: View {
    let entry: ActiveTaskEntry
    let brandNeon: Color
    let darkBg: Color
    let sleepIndigo = Color(red: 0.38, green: 0.45, blue: 0.98) // #6173FA

    var body: some View {
        let phaseIdx = entry.sleepPhaseIndex
        let isAwake = entry.isAwakeBetweenPhases
        let isSecond = entry.isSecondSleep || phaseIdx > 1

        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack(spacing: 8) {
                Link(destination: URL(string: "mytrack://sleep")!) {
                    HStack(spacing: 6) {
                        AppLogoView(size: 20)
                        Text("myTrack")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                    }
                }

                Text(isSecond ? "• 2nd Sommeil" : "• Mode Sommeil")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Color(white: 0.75))

                Spacer()

                if phaseIdx > 1 {
                    Text("Phase \(phaseIdx)")
                        .font(.system(size: 10, weight: .heavy))
                        .foregroundColor(sleepIndigo)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(sleepIndigo.opacity(0.2))
                        .clipShape(Capsule())
                }
            }

            // Card statut
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    ZStack {
                        Circle()
                            .fill(sleepIndigo.opacity(0.25))
                            .frame(width: 32, height: 32)
                        Image(systemName: isAwake ? "sun.haze.fill" : (isSecond ? "moon.zzz.fill" : "moon.stars.fill"))
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(isAwake ? brandNeon : sleepIndigo)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(isSecond ? "2nd Sommeil détecté" : (isAwake ? "Phase \(phaseIdx) terminée" : "Sommeil en cours"))
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)

                        Text(isSecond ? "Enregistrement relancé après 1h d'inactivité. Confirmez votre état :" : (isAwake ? "Vous pouvez vous recoucher ou démarrer vos tâches" : "Bonne nuit ! Vos cycles sont suivis automatiquement"))
                            .font(.system(size: 11))
                            .foregroundColor(Color.gray)
                    }
                }

                Divider()
                    .background(Color.white.opacity(0.1))

                HStack {
                    if let bTime = entry.bedtime {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(isSecond ? "Début 2nd dodo" : "Couché")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(Color.gray)
                            Text(bTime)
                                .font(.system(size: 14, weight: .bold, design: .rounded))
                                .foregroundColor(sleepIndigo)
                        }
                    }

                    Spacer()

                    if let wTime = entry.wakeTime {
                        VStack(alignment: .trailing, spacing: 1) {
                            Text("1er réveil")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(Color.gray)
                            Text(wTime)
                                .font(.system(size: 14, weight: .bold, design: .rounded))
                                .foregroundColor(brandNeon)
                        }
                    } else {
                        VStack(alignment: .trailing, spacing: 1) {
                            Text("Statut")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(Color.gray)
                            Text("En sommeil")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(brandNeon)
                        }
                    }
                }
            }
            .padding(12)
            .background(Color.white.opacity(0.06))
            .cornerRadius(14)

            Spacer()

            // Boutons Interactifs
            VStack(spacing: 8) {
                if isSecond {
                    Button(intent: SleepWakeNowIntent()) {
                        HStack(spacing: 6) {
                            Image(systemName: "sun.max.fill")
                                .font(.system(size: 12, weight: .bold))
                            Text("Je me réveille maintenant")
                                .font(.system(size: 13, weight: .bold))
                        }
                        .foregroundColor(Color(red: 0.07, green: 0.07, blue: 0.08))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .background(brandNeon)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .shadow(color: brandNeon.opacity(0.25), radius: 3, x: 0, y: 1)
                    }
                    .buttonStyle(.plain)

                    Button(intent: SleepNotSleepingIntent()) {
                        HStack(spacing: 6) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 12, weight: .bold))
                            Text("Je ne dors pas (annuler ce sommeil)")
                                .font(.system(size: 13, weight: .bold))
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .background(Color.white.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                } else {
                    Button(intent: SleepStartNowIntent()) {
                        HStack(spacing: 6) {
                            Image(systemName: "bed.double.fill")
                                .font(.system(size: 12, weight: .bold))
                            Text("Je me couche maintenant")
                                .font(.system(size: 13, weight: .bold))
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .background(sleepIndigo.opacity(0.9))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .shadow(color: sleepIndigo.opacity(0.3), radius: 3, x: 0, y: 1)
                    }
                    .buttonStyle(.plain)

                    Button(intent: SleepWakeNowIntent()) {
                        HStack(spacing: 6) {
                            Image(systemName: "sun.max.fill")
                                .font(.system(size: 12, weight: .bold))
                            Text("Je me réveille maintenant")
                                .font(.system(size: 13, weight: .bold))
                        }
                        .foregroundColor(Color(red: 0.07, green: 0.07, blue: 0.08))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .background(brandNeon)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .shadow(color: brandNeon.opacity(0.25), radius: 3, x: 0, y: 1)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(13)
    }
}

struct SmallSleepWidgetView: View {
    let entry: ActiveTaskEntry
    let brandNeon: Color
    let darkBg: Color
    let sleepIndigo = Color(red: 0.38, green: 0.45, blue: 0.98) // #6173FA

    var body: some View {
        let isAwake = entry.isAwakeBetweenPhases
        let isSecond = entry.isSecondSleep || entry.sleepPhaseIndex > 1

        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Image(systemName: isAwake ? "sun.haze.fill" : (isSecond ? "moon.zzz.fill" : "moon.stars.fill"))
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(isAwake ? brandNeon : sleepIndigo)

                Text(isSecond ? "2nd Dodo" : "Sommeil")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.white)

                Spacer()

                if let bTime = entry.bedtime {
                    Text(bTime)
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundColor(sleepIndigo)
                }
            }

            Spacer()

            VStack(spacing: 6) {
                if isSecond {
                    Button(intent: SleepNotSleepingIntent()) {
                        HStack(spacing: 3) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 9, weight: .bold))
                            Text("Pas sommeil")
                                .font(.system(size: 10, weight: .bold))
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 5)
                        .background(Color.white.opacity(0.15))
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)

                    Button(intent: SleepWakeNowIntent()) {
                        HStack(spacing: 3) {
                            Image(systemName: "sun.max.fill")
                                .font(.system(size: 9, weight: .bold))
                            Text("Réveil")
                                .font(.system(size: 10.5, weight: .bold))
                        }
                        .foregroundColor(Color(red: 0.07, green: 0.07, blue: 0.08))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 5)
                        .background(brandNeon)
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                } else {
                    Button(intent: SleepStartNowIntent()) {
                        HStack(spacing: 3) {
                            Image(systemName: "bed.double.fill")
                                .font(.system(size: 9, weight: .bold))
                            Text("Coucher")
                                .font(.system(size: 10.5, weight: .bold))
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 5)
                        .background(sleepIndigo.opacity(0.85))
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)

                    Button(intent: SleepWakeNowIntent()) {
                        HStack(spacing: 3) {
                            Image(systemName: "sun.max.fill")
                                .font(.system(size: 9, weight: .bold))
                            Text("Réveil")
                                .font(.system(size: 10.5, weight: .bold))
                        }
                        .foregroundColor(Color(red: 0.07, green: 0.07, blue: 0.08))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 5)
                        .background(brandNeon)
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(10)
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
                HStack(spacing: 5) {
                    Circle()
                        .fill(task.accentColor)
                        .frame(width: 7, height: 7)
                    Text(task.projectName ?? task.category ?? "myTrack")
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
                .foregroundColor(task.accentColor)
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

                HStack(spacing: 6) {
                    Text("Projet :")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(darkBg.opacity(0.8))
                    Circle()
                        .fill(task.accentColor)
                        .frame(width: 7, height: 7)
                    Text(task.projectName ?? task.category ?? "myTrack")
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
                    .foregroundColor(task.accentColor)
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
                    .foregroundColor(task.accentColor)
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
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
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
                        HStack(spacing: 5) {
                            Circle()
                                .fill(task.accentColor)
                                .frame(width: 6, height: 6)
                            Text(task.projectName ?? task.category ?? "myTrack")
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
                        .foregroundColor(task.accentColor)
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

        VStack(alignment: .leading, spacing: 0) {
            // Header compact: Bouton Lancer App + Barre de saisie + Boutons de défilement / pagination
            HStack(spacing: 6) {
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
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(Color(white: 0.6))
                        Spacer()
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(Color.white.opacity(0.08))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.white.opacity(0.12), lineWidth: 1)
                    )
                    .cornerRadius(8)
                }

                if totalPages > 1 {
                    HStack(spacing: 2) {
                        Button(intent: ChangeTaskPageIntent(delta: -1)) {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 10, weight: .heavy))
                                .foregroundColor(.white)
                                .frame(width: 26, height: 26)
                                .background(Color.white.opacity(0.12))
                                .clipShape(Circle())
                        }
                        .buttonStyle(.plain)

                        Text("\(safePage + 1)/\(totalPages)")
                            .font(.system(size: 9.5, weight: .semibold, design: .monospaced))
                            .foregroundColor(Color(white: 0.75))

                        Button(intent: ChangeTaskPageIntent(delta: 1)) {
                            Image(systemName: "chevron.right")
                                .font(.system(size: 10, weight: .heavy))
                                .foregroundColor(.white)
                                .frame(width: 26, height: 26)
                                .background(Color.white.opacity(0.12))
                                .clipShape(Circle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            Spacer(minLength: 6)

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
                VStack(spacing: 6) {
                    ForEach(pageTasks) { task in
                        TaskRowInteractiveView(
                            task: task,
                            isSelected: selectedTaskId == task.id,
                            brandNeon: brandNeon,
                            darkBg: darkBg
                        )
                    }
                }

                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
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

                if isExternal {
                    Link(destination: URL(string: "mytrack://agenda")!) {
                        HStack(spacing: 4) {
                            Image(systemName: "calendar")
                                .font(.system(size: 10, weight: .bold))
                            Text("Voir l'agenda")
                                .font(.system(size: 11, weight: .bold))
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                        .background(Color.white.opacity(0.15))
                        .clipShape(Capsule())
                    }
                } else {
                    Button(intent: StartTaskIntent(taskId: firstTask.id, taskTitle: firstTask.title, category: firstTask.category, projectName: firstTask.projectName, projectColor: firstTask.projectColor)) {
                        HStack(spacing: 4) {
                            Image(systemName: "play.fill")
                                .font(.system(size: 10, weight: .bold))
                            Text("Démarrer")
                                .font(.system(size: 11, weight: .bold))
                        }
                        .foregroundColor(darkBg)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                        .background(brandNeon)
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
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
        Group {
            if isExternalEvent {
                // ==========================================
                // ÉVÉNEMENT EXTERNE : Ouvre directement l'Agenda, aucun bouton Play
                // ==========================================
                Link(destination: URL(string: "mytrack://agenda")!) {
                    HStack(spacing: 7) {
                        Image(systemName: "calendar")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(accentColor)

                        VStack(alignment: .leading, spacing: 1) {
                            Text(task.title)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(.white)
                                .lineLimit(1)

                            HStack(spacing: 4) {
                                Circle()
                                    .fill(accentColor)
                                    .frame(width: 5, height: 5)
                                Text(task.projectName ?? (task.category != "Général" ? task.category : nil) ?? "myTrack")
                                    .font(.system(size: 9.5, weight: .medium))
                                    .foregroundColor(accentColor)

                                if let dur = task.targetFormattedDuration ?? task.subtitle {
                                    Text("• \(dur)")
                                        .font(.system(size: 9.5))
                                        .foregroundColor(Color.gray)
                                }
                            }
                        }

                        Spacer()

                        Image(systemName: "chevron.right")
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundColor(Color.white.opacity(0.3))
                    }
                    .contentShape(Rectangle())
                    .padding(.horizontal, 9)
                    .padding(.vertical, 7)
                    .frame(minHeight: 38)
                    .background(Color.white.opacity(0.04))
                    .overlay(
                        RoundedRectangle(cornerRadius: 11)
                            .stroke(Color.white.opacity(0.08), lineWidth: 1)
                    )
                    .cornerRadius(11)
                }
            } else {
                // ==========================================
                // TÂCHE INTERNE : Sélection Interactive + Bouton Play
                // ==========================================
                HStack(spacing: 7) {
                    // Bouton de sélection de la tâche
                    Button(intent: SelectTaskIntent(taskId: task.id)) {
                        HStack(spacing: 7) {
                            Image(systemName: isSelected ? "checkmark.circle.fill" : (task.isCompleted == true ? "checkmark.circle" : "circle"))
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(isSelected ? brandNeon : (task.isCompleted == true ? Color.gray.opacity(0.5) : Color.gray))

                            VStack(alignment: .leading, spacing: 1) {
                                Text(task.title)
                                    .font(.system(size: 12, weight: isSelected ? .bold : .semibold))
                                    .foregroundColor(isSelected ? .white : (task.isCompleted == true ? Color.white.opacity(0.5) : Color.white.opacity(0.95)))
                                    .strikethrough(task.isCompleted == true && !isSelected)
                                    .lineLimit(1)

                                HStack(spacing: 4) {
                                    Circle()
                                        .fill(accentColor)
                                        .frame(width: 5, height: 5)
                                    Text(task.projectName ?? (task.category != "Général" ? task.category : nil) ?? "myTrack")
                                        .font(.system(size: 9.5, weight: .medium))
                                        .foregroundColor(isSelected ? brandNeon : accentColor.opacity(0.85))

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
                        Button(intent: StartTaskIntent(taskId: task.id, taskTitle: task.title, category: task.category, projectName: task.projectName, projectColor: task.projectColor)) {
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
                .padding(.vertical, 7)
                .frame(minHeight: 38)
                .background(isSelected ? Color.white.opacity(0.12) : Color.white.opacity(0.04))
                .overlay(
                    RoundedRectangle(cornerRadius: 11)
                        .stroke(isSelected ? brandNeon.opacity(0.8) : Color.clear, lineWidth: 1.5)
                )
                .cornerRadius(11)
            }
        }
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

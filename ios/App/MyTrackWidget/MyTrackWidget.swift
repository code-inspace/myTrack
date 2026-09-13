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
public struct ActiveTaskWidgetModel: Codable {
    public let taskId: String
    public let taskTitle: String
    public let category: String?
    public let subtitle: String?
    public let startedAtTimestamp: Double
    public let totalFormattedDuration: String?

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
    public let activeTask: ActiveTaskWidgetModel?
    public let tasks: [TaskItemWidgetModel]
    public let selectedTaskId: String?
    public let currentPage: Int

    public init(
        date: Date,
        activeTask: ActiveTaskWidgetModel?,
        tasks: [TaskItemWidgetModel] = [],
        selectedTaskId: String? = nil,
        currentPage: Int = 0
    ) {
        self.date = date
        self.activeTask = activeTask
        self.tasks = tasks
        self.selectedTaskId = selectedTaskId
        self.currentPage = currentPage
    }
}

// MARK: - 2. Provider de données
struct Provider: TimelineProvider {
    private func fetchLocalActiveTask() -> ActiveTaskWidgetModel? {
        if let rawJson = UserDefaults(suiteName: "group.com.mytrack.app")?.string(forKey: "mytrack_active_task")
            ?? UserDefaults.standard.string(forKey: "mytrack_active_task"),
           let data = rawJson.data(using: .utf8),
           let task = try? JSONDecoder().decode(ActiveTaskWidgetModel.self, from: data) {
            return task
        }

        let tempUrl = URL(fileURLWithPath: "/tmp/mytrack_active_task.json")
        if let data = try? Data(contentsOf: tempUrl),
           let task = try? JSONDecoder().decode(ActiveTaskWidgetModel.self, from: data) {
            return task
        }

        return nil
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

    private func backgroundFetchRemoteData() {
        guard let url = URL(string: "https://mytrack-nine.vercel.app/api/widget/tasks") else { return }
        var req = URLRequest(url: url)
        req.timeoutInterval = 4.0
        URLSession.shared.dataTask(with: req) { data, _, _ in
            guard let data = data,
                  let resp = try? JSONDecoder().decode(TasksListApiResponse.self, from: data),
                  !resp.tasks.isEmpty else { return }
            if let encoded = try? JSONEncoder().encode(resp.tasks),
               let jsonStr = String(data: encoded, encoding: .utf8) {
                UserDefaults(suiteName: "group.com.mytrack.app")?.set(jsonStr, forKey: "mytrack_tasks_list")
                UserDefaults.standard.set(jsonStr, forKey: "mytrack_tasks_list")
                WidgetCenter.shared.reloadAllTimelines()
            }
        }.resume()
    }

    func placeholder(in context: Context) -> ActiveTaskEntry {
        ActiveTaskEntry(
            date: Date(),
            activeTask: nil,
            tasks: [
                TaskItemWidgetModel(id: "1", title: "Séance Musculation", category: "Sport", targetFormattedDuration: "45 min"),
                TaskItemWidgetModel(id: "2", title: "Lecture & Apprentissage", category: "Focus", targetFormattedDuration: "20 min"),
                TaskItemWidgetModel(id: "3", title: "Méditation", category: "Santé", targetFormattedDuration: "10 min")
            ],
            selectedTaskId: nil,
            currentPage: 0
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (ActiveTaskEntry) -> Void) {
        let selectedId = getSelectedTaskId()
        let page = getCurrentPage()
        let localTasks = fetchLocalTasksList()
        let localActive = fetchLocalActiveTask()

        let entry = ActiveTaskEntry(
            date: Date(),
            activeTask: localActive,
            tasks: localTasks.isEmpty ? placeholder(in: context).tasks : localTasks,
            selectedTaskId: selectedId,
            currentPage: page
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ActiveTaskEntry>) -> Void) {
        let selectedId = getSelectedTaskId()
        let page = getCurrentPage()
        let localTasks = fetchLocalTasksList()
        let localActive = fetchLocalActiveTask()

        // Si aucune tâche en mémoire locale, lancer un rafraîchissement asynchrone non-bloquant
        if localTasks.isEmpty && localActive == nil {
            backgroundFetchRemoteData()
        }

        let entry = ActiveTaskEntry(
            date: Date(),
            activeTask: localActive,
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

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            MyTrackWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("myTrack — Tâches & Chrono")
        .description("Suivez votre tâche active ou choisissez une tâche à démarrer en un clic.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
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
            if let activeTask = entry.activeTask {
                if family == .systemMedium {
                    MediumActiveTaskView(task: activeTask, brandNeon: brandNeon, darkBg: darkBg)
                } else if family == .systemLarge {
                    LargeActiveTaskView(task: activeTask, brandNeon: brandNeon, darkBg: darkBg)
                } else {
                    SmallActiveTaskView(task: activeTask, brandNeon: brandNeon, darkBg: darkBg)
                }
            } else {
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
            if entry.activeTask != nil {
                brandNeon
            } else {
                darkBg
            }
        }
    }
}

// MARK: - 5. Vues Tâche Active (Chrono & Bouton Arrêter)

struct MediumActiveTaskView: View {
    let task: ActiveTaskWidgetModel
    let brandNeon: Color
    let darkBg: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 8) {
                HStack(alignment: .center, spacing: 8) {
                    ZStack {
                        Circle()
                            .fill(darkBg)
                            .frame(width: 16, height: 16)
                        Circle()
                            .fill(brandNeon)
                            .frame(width: 7, height: 7)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(task.taskTitle)
                            .font(.system(size: 16, weight: .bold))
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
                    Text(timerInterval: Date(timeIntervalSince1970: task.startedAtTimestamp)...Date(timeIntervalSinceNow: 86400), countsDown: false)
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
            HStack(spacing: 6) {
                ZStack {
                    Circle()
                        .fill(darkBg)
                        .frame(width: 14, height: 14)
                    Circle()
                        .fill(brandNeon)
                        .frame(width: 6, height: 6)
                }

                Text("EN COURS")
                    .font(.system(size: 9, weight: .heavy))
                    .foregroundColor(darkBg.opacity(0.8))

                Spacer()
            }

            Text(task.taskTitle)
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(darkBg)
                .lineLimit(2)

            Spacer()

            HStack {
                Text(timerInterval: Date(timeIntervalSince1970: task.startedAtTimestamp)...Date(timeIntervalSinceNow: 86400), countsDown: false)
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

// MARK: - 6. Vues Liste des Tâches avec Pagination & Input & Sélection Instantanée

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
            // Header compact: Barre de saisie + Boutons de défilement / pagination
            HStack(spacing: 6) {
                Link(destination: URL(string: "mytrack://tasks?action=new-task")!) {
                    HStack(spacing: 6) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(brandNeon)
                        Text("Ajouter une tâche...")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(Color(white: 0.6))
                        Spacer()
                    }
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(Color.white.opacity(0.08))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color.white.opacity(0.12), lineWidth: 1)
                    )
                    .cornerRadius(10)
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
            // Header avec logo myTrack + pagination
            HStack(spacing: 8) {
                Image(systemName: "figure.run.circle.fill")
                    .font(.system(size: 17))
                    .foregroundColor(brandNeon)

                Text("Mes Tâches du Jour")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)

                if !tasks.isEmpty {
                    Text("(\(tasks.count))")
                        .font(.system(size: 12, weight: .semibold))
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
            HStack(spacing: 4) {
                Image(systemName: "figure.run.circle.fill")
                    .font(.system(size: 14))
                    .foregroundColor(brandNeon)
                Text("myTrack")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.white)
                Spacer()
            }

            if let firstTask = tasks.first {
                Text(firstTask.title)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(2)

                Text(firstTask.category)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(Color.gray)

                Spacer()

                Button(intent: StartTaskIntent(taskId: firstTask.id, taskTitle: firstTask.title, category: firstTask.category)) {
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

// MARK: - 7. Ligne de tâche Interactive (Sélection + Bouton Play Démarrer)
struct TaskRowInteractiveView: View {
    let task: TaskItemWidgetModel
    let isSelected: Bool
    let brandNeon: Color
    let darkBg: Color

    var body: some View {
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
                            Text(task.category)
                                .font(.system(size: 9.5, weight: .medium))
                                .foregroundColor(isSelected ? brandNeon : Color.gray)
                            
                            if let dur = task.targetFormattedDuration {
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

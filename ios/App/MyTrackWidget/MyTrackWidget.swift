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

    public init(
        id: String,
        title: String,
        category: String = "myTrack",
        subtitle: String? = nil,
        targetFormattedDuration: String? = nil,
        isHabit: Bool? = false,
        color: String? = "#D4F63D"
    ) {
        self.id = id
        self.title = title
        self.category = category
        self.subtitle = subtitle
        self.targetFormattedDuration = targetFormattedDuration
        self.isHabit = isHabit
        self.color = color
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

    public init(
        date: Date,
        activeTask: ActiveTaskWidgetModel?,
        tasks: [TaskItemWidgetModel] = [],
        selectedTaskId: String? = nil
    ) {
        self.date = date
        self.activeTask = activeTask
        self.tasks = tasks
        self.selectedTaskId = selectedTaskId
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

    private func fetchRemoteData(completion: @escaping (ActiveTaskWidgetModel?, [TaskItemWidgetModel]) -> Void) {
        let activeTaskUrls = [
            "http://127.0.0.1:3000/api/widget/active-task",
            "https://mytrack-nine.vercel.app/api/widget/active-task"
        ]

        let tasksListUrls = [
            "http://127.0.0.1:3000/api/widget/tasks",
            "https://mytrack-nine.vercel.app/api/widget/tasks"
        ]

        func tryFetchActiveTask(index: Int, done: @escaping (ActiveTaskWidgetModel?) -> Void) {
            guard index < activeTaskUrls.count, let url = URL(string: activeTaskUrls[index]) else {
                done(self.fetchLocalActiveTask())
                return
            }

            var req = URLRequest(url: url)
            req.timeoutInterval = 2.0
            req.cachePolicy = .reloadIgnoringLocalCacheData

            URLSession.shared.dataTask(with: req) { data, _, _ in
                if let data = data,
                   let resp = try? JSONDecoder().decode(ActiveTaskApiResponse.self, from: data) {
                    if resp.active, let task = resp.task {
                        done(task)
                        return
                    } else if !resp.active {
                        done(nil)
                        return
                    }
                }
                tryFetchActiveTask(index: index + 1, done: done)
            }.resume()
        }

        func tryFetchTasksList(index: Int, done: @escaping ([TaskItemWidgetModel]) -> Void) {
            let local = self.fetchLocalTasksList()
            guard index < tasksListUrls.count, let url = URL(string: tasksListUrls[index]) else {
                done(local)
                return
            }

            var req = URLRequest(url: url)
            req.timeoutInterval = 2.0
            req.cachePolicy = .reloadIgnoringLocalCacheData

            URLSession.shared.dataTask(with: req) { data, _, _ in
                if let data = data,
                   let resp = try? JSONDecoder().decode(TasksListApiResponse.self, from: data),
                   !resp.tasks.isEmpty {
                    if let encoded = try? JSONEncoder().encode(resp.tasks),
                       let jsonStr = String(data: encoded, encoding: .utf8) {
                        UserDefaults(suiteName: "group.com.mytrack.app")?.set(jsonStr, forKey: "mytrack_tasks_list")
                        UserDefaults.standard.set(jsonStr, forKey: "mytrack_tasks_list")
                    }
                    done(resp.tasks)
                    return
                }
                tryFetchTasksList(index: index + 1, done: done)
            }.resume()
        }

        tryFetchActiveTask(index: 0) { activeTask in
            if activeTask != nil {
                completion(activeTask, [])
            } else {
                tryFetchTasksList(index: 0) { tasksList in
                    completion(nil, tasksList)
                }
            }
        }
    }

    func placeholder(in context: Context) -> ActiveTaskEntry {
        ActiveTaskEntry(
            date: Date(),
            activeTask: nil,
            tasks: [
                TaskItemWidgetModel(id: "1", title: "Séance Musculation", category: "Sport", targetFormattedDuration: "45 min"),
                TaskItemWidgetModel(id: "2", title: "Lecture & Apprentissage", category: "Focus", targetFormattedDuration: "20 min")
            ],
            selectedTaskId: nil
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (ActiveTaskEntry) -> Void) {
        let selectedId = getSelectedTaskId()
        let localTasks = fetchLocalTasksList()
        if let local = fetchLocalActiveTask() {
            completion(ActiveTaskEntry(date: Date(), activeTask: local, tasks: [], selectedTaskId: selectedId))
        } else if !localTasks.isEmpty {
            completion(ActiveTaskEntry(date: Date(), activeTask: nil, tasks: localTasks, selectedTaskId: selectedId))
        } else {
            fetchRemoteData { activeTask, tasks in
                completion(ActiveTaskEntry(date: Date(), activeTask: activeTask, tasks: tasks, selectedTaskId: selectedId))
            }
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ActiveTaskEntry>) -> Void) {
        let selectedId = getSelectedTaskId()
        fetchRemoteData { activeTask, tasks in
            let entry = ActiveTaskEntry(date: Date(), activeTask: activeTask, tasks: tasks, selectedTaskId: selectedId)
            let nextUpdate = Date().addingTimeInterval(60)
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
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
                    LargeTasksListWidgetView(tasks: entry.tasks, selectedTaskId: entry.selectedTaskId, brandNeon: brandNeon, darkBg: darkBg)
                } else if family == .systemMedium {
                    MediumTasksListWidgetView(tasks: entry.tasks, selectedTaskId: entry.selectedTaskId, brandNeon: brandNeon, darkBg: darkBg)
                } else {
                    SmallTasksListWidgetView(tasks: entry.tasks, selectedTaskId: entry.selectedTaskId, brandNeon: brandNeon, darkBg: darkBg)
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

// MARK: - 6. Vues Liste des Tâches (Sans tâche active) avec Sélection & Bouton Play

struct MediumTasksListWidgetView: View {
    let tasks: [TaskItemWidgetModel]
    let selectedTaskId: String?
    let brandNeon: Color
    let darkBg: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Barre de saisie / Input pour ajouter directement une tâche
            Link(destination: URL(string: "mytrack://new-task")!) {
                HStack(spacing: 6) {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(brandNeon)
                    Text("Nom de la tâche...")
                        .font(.system(size: 11))
                        .foregroundColor(Color(white: 0.55))
                    Spacer()
                    Image(systemName: "return")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(Color(white: 0.4))
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color.white.opacity(0.07))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.white.opacity(0.12), lineWidth: 1)
                )
                .cornerRadius(10)
            }

            if tasks.isEmpty {
                Spacer()
                HStack {
                    Spacer()
                    Text("Aucune tâche en attente")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Color.gray)
                    Spacer()
                }
                Spacer()
            } else {
                VStack(spacing: 5) {
                    ForEach(tasks.prefix(2)) { task in
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
    let brandNeon: Color
    let darkBg: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header avec logo myTrack
            HStack(spacing: 8) {
                Image(systemName: "figure.run.circle.fill")
                    .font(.system(size: 18))
                    .foregroundColor(brandNeon)

                Text("Mes Tâches du Jour")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(.white)

                Spacer()
            }

            // Barre de saisie / Input pour ajouter directement une tâche
            Link(destination: URL(string: "mytrack://new-task")!) {
                HStack(spacing: 8) {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(brandNeon)
                    Text("Nom de la tâche...")
                        .font(.system(size: 13))
                        .foregroundColor(Color(white: 0.55))
                    Spacer()
                    Image(systemName: "return")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(Color(white: 0.4))
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.white.opacity(0.07))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.white.opacity(0.14), lineWidth: 1)
                )
                .cornerRadius(12)
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
                VStack(spacing: 6) {
                    ForEach(tasks.prefix(5)) { task in
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
        .padding(14)
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
        HStack(spacing: 8) {
            // Bouton de sélection de la tâche
            Button(intent: SelectTaskIntent(taskId: task.id)) {
                HStack(spacing: 8) {
                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(isSelected ? brandNeon : Color.gray)

                    VStack(alignment: .leading, spacing: 1) {
                        Text(task.title)
                            .font(.system(size: 13, weight: isSelected ? .bold : .semibold))
                            .foregroundColor(isSelected ? .white : Color.white.opacity(0.9))
                            .lineLimit(1)

                        HStack(spacing: 4) {
                            Text(task.category)
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(isSelected ? brandNeon : Color.gray)
                            
                            if let dur = task.targetFormattedDuration {
                                Text("• \(dur)")
                                    .font(.system(size: 10))
                                    .foregroundColor(Color.gray)
                            }
                        }
                    }

                    Spacer()
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            // BOUTON PLAY qui apparaît quand la tâche est sélectionnée (ou présent en permanence)
            if isSelected {
                Button(intent: StartTaskIntent(taskId: task.id, taskTitle: task.title, category: task.category)) {
                    HStack(spacing: 4) {
                        Image(systemName: "play.fill")
                            .font(.system(size: 10, weight: .heavy))
                        Text("Play")
                            .font(.system(size: 11, weight: .heavy))
                    }
                    .foregroundColor(darkBg)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(brandNeon)
                    .clipShape(Capsule())
                    .shadow(color: brandNeon.opacity(0.3), radius: 3, x: 0, y: 1)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(isSelected ? Color.white.opacity(0.12) : Color.white.opacity(0.04))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isSelected ? brandNeon.opacity(0.8) : Color.clear, lineWidth: 1.5)
        )
        .cornerRadius(12)
    }
}

import Foundation
import AppIntents
import ActivityKit
import WidgetKit

// MARK: - 1. Intent pour Arrêter la tâche active (Widget Home Screen)
@available(iOS 16.0, macOS 13.0, *)
public struct StopTaskIntent: AppIntent {
    public static var title: LocalizedStringResource = "Arrêter la tâche"
    public static var description = IntentDescription("Arrête la tâche active myTrack directement sans ouvrir l'application.")
    public static var openAppWhenRun: Bool = false

    @Parameter(title: "Task ID")
    public var taskId: String

    public init() {
        self.taskId = ""
    }

    public init(taskId: String) {
        self.taskId = taskId
    }

    public func perform() async throws -> some IntentResult {
        print("[StopTaskIntent] Performing background stop for task ID: \(taskId)")

        let suite = UserDefaults(suiteName: "group.com.mytrack.app") ?? UserDefaults.standard

        // 1. Enregistrer l'ID de la tâche arrêtée
        if !taskId.isEmpty {
            suite.set(taskId, forKey: "mytrack_last_stopped_task_id")
            suite.set(Date().timeIntervalSince1970, forKey: "mytrack_last_stopped_timestamp")
        }

        // 2. Mettre à jour les données locales partagées pour le widget (jusqu'à 2 tâches)
        var currentActiveList: [[String: Any]] = []
        if let rawListJson = suite.string(forKey: "mytrack_active_tasks"),
           let data = rawListJson.data(using: .utf8),
           let list = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            currentActiveList = list
        }

        currentActiveList.removeAll { ($0["taskId"] as? String) == taskId }

        if !currentActiveList.isEmpty {
            if let listData = try? JSONSerialization.data(withJSONObject: currentActiveList),
               let listJsonString = String(data: listData, encoding: .utf8) {
                suite.set(listJsonString, forKey: "mytrack_active_tasks")
                UserDefaults.standard.set(listJsonString, forKey: "mytrack_active_tasks")
                try? listData.write(to: URL(fileURLWithPath: "/tmp/mytrack_active_tasks.json"))
            }

            if let remaining = currentActiveList.first,
               let primData = try? JSONSerialization.data(withJSONObject: remaining),
               let primJson = String(data: primData, encoding: .utf8) {
                suite.set(primJson, forKey: "mytrack_active_task")
                UserDefaults.standard.set(primJson, forKey: "mytrack_active_task")
                try? primData.write(to: URL(fileURLWithPath: "/tmp/mytrack_active_task.json"))
            }
        } else {
            suite.removeObject(forKey: "mytrack_active_tasks")
            UserDefaults.standard.removeObject(forKey: "mytrack_active_tasks")
            suite.removeObject(forKey: "mytrack_active_task")
            UserDefaults.standard.removeObject(forKey: "mytrack_active_task")
            try? FileManager.default.removeItem(at: URL(fileURLWithPath: "/tmp/mytrack_active_tasks.json"))
            try? FileManager.default.removeItem(at: URL(fileURLWithPath: "/tmp/mytrack_active_task.json"))
        }

        suite.removeObject(forKey: "mytrack_selected_widget_task_id")
        UserDefaults.standard.removeObject(forKey: "mytrack_selected_widget_task_id")

        // 3. Clôturer uniquement la Live Activity ciblée
        if #available(iOS 16.2, *) {
            for activity in Activity<TaskActivityAttributes>.activities {
                if taskId.isEmpty || activity.attributes.taskId == taskId {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }

            if taskId == "standby" {
                suite.set(false, forKey: "mytrack_lockscreen_standby")
                UserDefaults.standard.set(false, forKey: "mytrack_lockscreen_standby")
            }
        }

        // 4. Recharger immédiatement les widgets
        WidgetCenter.shared.reloadAllTimelines()

        // 5. Notifier l'API distante en tâche de fond non-bloquante
        let currentTaskId = self.taskId
        Task.detached(priority: .background) {
            guard let url = URL(string: "https://mytrack-nine.vercel.app/api/widget/stop-task") else { return }
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.timeoutInterval = 3.0
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let body: [String: Any] = ["taskId": currentTaskId]
            request.httpBody = try? JSONSerialization.data(withJSONObject: body)
            _ = try? await URLSession.shared.data(for: request)
        }

        return .result()
    }
}

// MARK: - 1b. Intent pour Arrêter la Live Activity (Lock Screen & Dynamic Island)
@available(iOS 16.0, macOS 13.0, *)
public struct StopLiveActivityIntent: LiveActivityIntent {
    public static var title: LocalizedStringResource = "Arrêter la tâche (Live Activity)"
    public static var description = IntentDescription("Arrête la Live Activity active myTrack.")
    public static var openAppWhenRun: Bool = false

    @Parameter(title: "Task ID")
    public var taskId: String

    public init() {
        self.taskId = ""
    }

    public init(taskId: String) {
        self.taskId = taskId
    }

    public func perform() async throws -> some IntentResult {
        print("[StopLiveActivityIntent] Stopping Live Activity for task ID: \(taskId)")

        let suite = UserDefaults(suiteName: "group.com.mytrack.app") ?? UserDefaults.standard

        if !taskId.isEmpty && taskId != "standby" {
            suite.set(taskId, forKey: "mytrack_last_stopped_task_id")
            suite.set(Date().timeIntervalSince1970, forKey: "mytrack_last_stopped_timestamp")
        }

        var currentActiveList: [[String: Any]] = []
        if let rawListJson = suite.string(forKey: "mytrack_active_tasks"),
           let data = rawListJson.data(using: .utf8),
           let list = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            currentActiveList = list
        }

        currentActiveList.removeAll { ($0["taskId"] as? String) == taskId }

        if !currentActiveList.isEmpty {
            if let listData = try? JSONSerialization.data(withJSONObject: currentActiveList),
               let listJsonString = String(data: listData, encoding: .utf8) {
                suite.set(listJsonString, forKey: "mytrack_active_tasks")
                UserDefaults.standard.set(listJsonString, forKey: "mytrack_active_tasks")
                try? listData.write(to: URL(fileURLWithPath: "/tmp/mytrack_active_tasks.json"))
            }

            if let remaining = currentActiveList.first,
               let primData = try? JSONSerialization.data(withJSONObject: remaining),
               let primJson = String(data: primData, encoding: .utf8) {
                suite.set(primJson, forKey: "mytrack_active_task")
                UserDefaults.standard.set(primJson, forKey: "mytrack_active_task")
                try? primData.write(to: URL(fileURLWithPath: "/tmp/mytrack_active_task.json"))
            }
        } else {
            suite.removeObject(forKey: "mytrack_active_tasks")
            UserDefaults.standard.removeObject(forKey: "mytrack_active_tasks")
            suite.removeObject(forKey: "mytrack_active_task")
            UserDefaults.standard.removeObject(forKey: "mytrack_active_task")
            try? FileManager.default.removeItem(at: URL(fileURLWithPath: "/tmp/mytrack_active_tasks.json"))
            try? FileManager.default.removeItem(at: URL(fileURLWithPath: "/tmp/mytrack_active_task.json"))
        }

        suite.removeObject(forKey: "mytrack_selected_widget_task_id")
        UserDefaults.standard.removeObject(forKey: "mytrack_selected_widget_task_id")

        if #available(iOS 16.2, *) {
            for activity in Activity<TaskActivityAttributes>.activities {
                if taskId.isEmpty || activity.attributes.taskId == taskId {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }

            if taskId == "standby" {
                suite.set(false, forKey: "mytrack_lockscreen_standby")
                UserDefaults.standard.set(false, forKey: "mytrack_lockscreen_standby")
            }
        }

        WidgetCenter.shared.reloadAllTimelines()

        let currentTaskId = self.taskId
        Task.detached(priority: .background) {
            guard let url = URL(string: "https://mytrack-nine.vercel.app/api/widget/stop-task") else { return }
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.timeoutInterval = 3.0
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let body: [String: Any] = ["taskId": currentTaskId]
            request.httpBody = try? JSONSerialization.data(withJSONObject: body)
            _ = try? await URLSession.shared.data(for: request)
        }

        return .result()
    }
}

// MARK: - 2. Intent pour Sélectionner une tâche dans la liste du widget
@available(iOS 16.0, macOS 13.0, *)
public struct SelectTaskIntent: AppIntent {
    public static var title: LocalizedStringResource = "Sélectionner la tâche"
    public static var description = IntentDescription("Sélectionne ou désélectionne une tâche dans le widget myTrack.")
    public static var openAppWhenRun: Bool = false

    @Parameter(title: "Task ID")
    public var taskId: String

    public init() {
        self.taskId = ""
    }

    public init(taskId: String) {
        self.taskId = taskId
    }

    public func perform() async throws -> some IntentResult {
        let suite = UserDefaults(suiteName: "group.com.mytrack.app") ?? UserDefaults.standard
        let currentSelected = suite.string(forKey: "mytrack_selected_widget_task_id")

        if currentSelected == taskId {
            suite.removeObject(forKey: "mytrack_selected_widget_task_id")
        } else {
            suite.set(taskId, forKey: "mytrack_selected_widget_task_id")
        }

        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

// MARK: - 3. Intent pour Démarrer la tâche sélectionnée en tâche de fond
@available(iOS 16.0, macOS 13.0, *)
public struct StartTaskIntent: AppIntent {
    public static var title: LocalizedStringResource = "Démarrer la tâche"
    public static var description = IntentDescription("Démarre la tâche sélectionnée dans myTrack sans ouvrir l'application.")
    public static var openAppWhenRun: Bool = false

    @Parameter(title: "Task ID")
    public var taskId: String

    @Parameter(title: "Task Title")
    public var taskTitle: String

    @Parameter(title: "Category")
    public var category: String

    public init() {
        self.taskId = ""
        self.taskTitle = "Tâche"
        self.category = "myTrack"
    }

    public init(taskId: String, taskTitle: String = "Tâche", category: String = "myTrack") {
        self.taskId = taskId
        self.taskTitle = taskTitle
        self.category = category
    }

    public func perform() async throws -> some IntentResult {
        let startedAtTimestamp = Date().timeIntervalSince1970
        let suite = UserDefaults(suiteName: "group.com.mytrack.app") ?? UserDefaults.standard

        // 1. Sauvegarder localement pour le widget (conserve jusqu'à 2 tâches actives)
        let dict: [String: Any] = [
            "taskId": taskId,
            "taskTitle": taskTitle,
            "category": category,
            "subtitle": category,
            "startedAtTimestamp": startedAtTimestamp,
            "totalFormattedDuration": ""
        ]

        var currentActiveList: [[String: Any]] = []
        if let rawListJson = suite.string(forKey: "mytrack_active_tasks"),
           let data = rawListJson.data(using: .utf8),
           let list = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            currentActiveList = list
        }

        currentActiveList.removeAll { ($0["taskId"] as? String) == taskId }
        currentActiveList.insert(dict, at: 0)
        let cappedList = Array(currentActiveList.prefix(2))

        if let listData = try? JSONSerialization.data(withJSONObject: cappedList),
           let listJsonString = String(data: listData, encoding: .utf8) {
            suite.set(listJsonString, forKey: "mytrack_active_tasks")
            UserDefaults.standard.set(listJsonString, forKey: "mytrack_active_tasks")
            try? listData.write(to: URL(fileURLWithPath: "/tmp/mytrack_active_tasks.json"))
        }

        if let data = try? JSONSerialization.data(withJSONObject: dict),
           let jsonString = String(data: data, encoding: .utf8) {
            suite.set(jsonString, forKey: "mytrack_active_task")
            UserDefaults.standard.set(jsonString, forKey: "mytrack_active_task")
            try? data.write(to: URL(fileURLWithPath: "/tmp/mytrack_active_task.json"))
        }

        // 2. Nettoyer la sélection et le dernier arrêt
        suite.removeObject(forKey: "mytrack_last_stopped_task_id")
        suite.removeObject(forKey: "mytrack_selected_widget_task_id")
        UserDefaults.standard.removeObject(forKey: "mytrack_selected_widget_task_id")

        // 3. Lancer la Live Activity sur Dynamic Island et Lock Screen (max 2)
        if #available(iOS 16.2, *) {
            let attributes = TaskActivityAttributes(
                taskId: taskId,
                taskTitle: taskTitle,
                category: category
            )
            let initialContentState = TaskActivityAttributes.ContentState(
                currentStatus: "IN_PROGRESS",
                startedAtTimestamp: startedAtTimestamp,
                elapsedSeconds: 0,
                targetDurationSeconds: nil,
                totalFormattedDuration: "",
                subtitle: category,
                progress: 0.0
            )

            // Fermer proprement si même taskId ou si activité standby avant de créer la nouvelle
            for runningActivity in Activity<TaskActivityAttributes>.activities {
                if runningActivity.attributes.taskId == taskId || runningActivity.attributes.taskId == "standby" {
                    await runningActivity.end(nil, dismissalPolicy: .immediate)
                }
            }

            // Si déjà >= 2 autres activités, fermer la plus ancienne
            let otherActivities = Activity<TaskActivityAttributes>.activities.filter { $0.attributes.taskId != taskId && $0.attributes.taskId != "standby" }
            if otherActivities.count >= 2 {
                for oldActivity in otherActivities.dropFirst() {
                    await oldActivity.end(nil, dismissalPolicy: .immediate)
                }
            }

            do {
                _ = try Activity<TaskActivityAttributes>.request(
                    attributes: attributes,
                    content: .init(state: initialContentState, staleDate: nil),
                    pushType: nil
                )
                print("[StartTaskIntent] Successfully started Live Activity for: \(taskId)")
            } catch {
                print("[StartTaskIntent] Activity.request failed: \(error)")
            }
        }

        // 4. Recharger immédiatement les widgets
        WidgetCenter.shared.reloadAllTimelines()

        // 5. Notifier l'API distante en tâche de fond non-bloquante
        let currentTaskId = self.taskId
        Task.detached(priority: .background) {
            guard let url = URL(string: "https://mytrack-nine.vercel.app/api/widget/start-task") else { return }
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.timeoutInterval = 5.0
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let body: [String: Any] = ["taskId": currentTaskId]
            request.httpBody = try? JSONSerialization.data(withJSONObject: body)
            _ = try? await URLSession.shared.data(for: request)
        }

        return .result()
    }
}

// MARK: - 4. Intent pour Changer de Page (Pagination / Défilement des tâches)
@available(iOS 16.0, macOS 13.0, *)
public struct ChangeTaskPageIntent: AppIntent {
    public static var title: LocalizedStringResource = "Changer de page"
    public static var description = IntentDescription("Fait défiler les tâches dans le widget myTrack.")
    public static var openAppWhenRun: Bool = false

    @Parameter(title: "Delta")
    public var delta: Int

    public init() {
        self.delta = 1
    }

    public init(delta: Int) {
        self.delta = delta
    }

    public func perform() async throws -> some IntentResult {
        let suite = UserDefaults(suiteName: "group.com.mytrack.app") ?? UserDefaults.standard
        let currentPage = suite.integer(forKey: "mytrack_widget_task_page")

        var totalTasks = 0
        if let rawJson = suite.string(forKey: "mytrack_tasks_list") ?? UserDefaults.standard.string(forKey: "mytrack_tasks_list"),
           let data = rawJson.data(using: .utf8),
           let list = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            totalTasks = list.count
        } else if let tempUrlData = try? Data(contentsOf: URL(fileURLWithPath: "/tmp/mytrack_tasks_list.json")),
                  let list = try? JSONSerialization.jsonObject(with: tempUrlData) as? [[String: Any]] {
            totalTasks = list.count
        }

        let pageSize = 2
        let totalPages = max(1, Int(ceil(Double(totalTasks) / Double(pageSize))))

        var newPage = (currentPage + delta) % totalPages
        if newPage < 0 {
            newPage = max(0, totalPages - 1)
        }

        suite.set(newPage, forKey: "mytrack_widget_task_page")
        UserDefaults.standard.set(newPage, forKey: "mytrack_widget_task_page")
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

// MARK: - 5. Intent pour Réinitialiser complètement le widget
@available(iOS 16.0, macOS 13.0, *)
public struct ResetWidgetIntent: AppIntent {
    public static var title: LocalizedStringResource = "Réinitialiser le widget"
    public static var description = IntentDescription("Réinitialise les états de sélection et de tâches actives du widget.")
    public static var openAppWhenRun: Bool = false

    public init() {}

    public func perform() async throws -> some IntentResult {
        let suite = UserDefaults(suiteName: "group.com.mytrack.app") ?? UserDefaults.standard
        suite.removeObject(forKey: "mytrack_active_tasks")
        UserDefaults.standard.removeObject(forKey: "mytrack_active_tasks")
        suite.removeObject(forKey: "mytrack_active_task")
        UserDefaults.standard.removeObject(forKey: "mytrack_active_task")
        suite.removeObject(forKey: "mytrack_selected_widget_task_id")
        UserDefaults.standard.removeObject(forKey: "mytrack_selected_widget_task_id")
        suite.removeObject(forKey: "mytrack_last_stopped_task_id")
        suite.removeObject(forKey: "mytrack_widget_task_page")

        try? FileManager.default.removeItem(at: URL(fileURLWithPath: "/tmp/mytrack_active_tasks.json"))
        try? FileManager.default.removeItem(at: URL(fileURLWithPath: "/tmp/mytrack_active_task.json"))

        if #available(iOS 16.2, *) {
            for activity in Activity<TaskActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }

        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

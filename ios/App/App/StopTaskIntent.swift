import Foundation
import AppIntents
import ActivityKit
import WidgetKit

// MARK: - 1. Intent pour Arrêter la tâche active
@available(iOS 16.0, macOS 13.0, *)
public struct StopTaskIntent: AppIntent, LiveActivityIntent {
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

        // 1. Clôturer immédiatement toutes les Live Activities
        if #available(iOS 16.2, *) {
            for activity in Activity<TaskActivityAttributes>.activities {
                if activity.attributes.taskId == taskId || taskId.isEmpty {
                    Task {
                        await activity.end(nil, dismissalPolicy: .immediate)
                    }
                }
            }
        }

        // 2. Nettoyer les données locales partagées pour le widget
        UserDefaults(suiteName: "group.com.mytrack.app")?.removeObject(forKey: "mytrack_active_task")
        UserDefaults.standard.removeObject(forKey: "mytrack_active_task")
        UserDefaults(suiteName: "group.com.mytrack.app")?.removeObject(forKey: "mytrack_selected_widget_task_id")
        UserDefaults.standard.removeObject(forKey: "mytrack_selected_widget_task_id")
        let tempUrl = URL(fileURLWithPath: "/tmp/mytrack_active_task.json")
        try? FileManager.default.removeItem(at: tempUrl)

        // 3. Recharger immédiatement les widgets
        WidgetCenter.shared.reloadAllTimelines()

        // 4. Notifier l'API distante en tâche de fond non-bloquante
        let currentTaskId = self.taskId
        Task.detached(priority: .background) {
            guard let url = URL(string: "https://mytrack-nine.vercel.app/api/widget/stop-task") else { return }
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

        // 1. Sauvegarder localement pour le widget
        let dict: [String: Any] = [
            "taskId": taskId,
            "taskTitle": taskTitle,
            "category": category,
            "subtitle": category,
            "startedAtTimestamp": startedAtTimestamp,
            "totalFormattedDuration": ""
        ]
        if let data = try? JSONSerialization.data(withJSONObject: dict),
           let jsonString = String(data: data, encoding: .utf8) {
            UserDefaults(suiteName: "group.com.mytrack.app")?.set(jsonString, forKey: "mytrack_active_task")
            UserDefaults.standard.set(jsonString, forKey: "mytrack_active_task")
            let tempUrl = URL(fileURLWithPath: "/tmp/mytrack_active_task.json")
            try? data.write(to: tempUrl)
        }

        // 2. Nettoyer la sélection
        UserDefaults(suiteName: "group.com.mytrack.app")?.removeObject(forKey: "mytrack_selected_widget_task_id")
        UserDefaults.standard.removeObject(forKey: "mytrack_selected_widget_task_id")

        // 3. Lancer la Live Activity sur Dynamic Island et Lock Screen
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

            // Clôturer les précédentes
            for runningActivity in Activity<TaskActivityAttributes>.activities {
                Task {
                    await runningActivity.end(nil, dismissalPolicy: .immediate)
                }
            }

            _ = try? Activity<TaskActivityAttributes>.request(
                attributes: attributes,
                content: .init(state: initialContentState, staleDate: nil),
                pushType: nil
            )
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
        let newPage = max(0, currentPage + delta)
        suite.set(newPage, forKey: "mytrack_widget_task_page")
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}


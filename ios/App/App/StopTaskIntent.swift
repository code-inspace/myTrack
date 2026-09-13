import Foundation
import AppIntents
import ActivityKit
import WidgetKit

@available(iOS 16.0, macOS 13.0, *)
public struct StopTaskIntent: AppIntent, LiveActivityIntent {
    public static var title: LocalizedStringResource = "Arrêter la tâche"
    public static var description = IntentDescription("Arrête la tâche active myTrack directement sans ouvrir l'application.")
    
    // IMPORTANT: Indique à iOS de NE PAS ouvrir l'application au premier plan
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
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }
        }

        // 2. Nettoyer les données locales partagées pour le widget
        UserDefaults(suiteName: "group.com.mytrack.app")?.removeObject(forKey: "mytrack_active_task")
        UserDefaults.standard.removeObject(forKey: "mytrack_active_task")
        let tempUrl = URL(fileURLWithPath: "/tmp/mytrack_active_task.json")
        try? FileManager.default.removeItem(at: tempUrl)

        // 3. Notifier l'API distante pour arrêter la tâche sur le serveur / Supabase
        let candidateUrls = [
            "http://127.0.0.1:3000/api/widget/stop-task",
            "https://mytrack-nine.vercel.app/api/widget/stop-task"
        ]

        for urlString in candidateUrls {
            if let url = URL(string: urlString) {
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.timeoutInterval = 2.0
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                let body: [String: Any] = ["taskId": taskId]
                request.httpBody = try? JSONSerialization.data(withJSONObject: body)
                _ = try? await URLSession.shared.data(for: request)
            }
        }

        // 4. Recharger immédiatement les widgets
        WidgetCenter.shared.reloadAllTimelines()

        return .result()
    }
}

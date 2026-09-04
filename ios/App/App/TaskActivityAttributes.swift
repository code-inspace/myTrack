import Foundation
import ActivityKit

// MARK: - Structure de données partagée pour l'Activité en Direct
public struct TaskActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var currentStatus: String // "IN_PROGRESS", "PAUSED", "COMPLETED"
        public var startedAtTimestamp: Double // UNIX timestamp en secondes
        public var elapsedSeconds: Int
        public var targetDurationSeconds: Int?
        public var totalFormattedDuration: String? // ex: "50 min et 57 s"
        public var subtitle: String? // ex: "Série 1/2 - 16 répétitions" ou "Fitness • En cours"
        public var progress: Double // 0.0 -> 1.0

        public init(
            currentStatus: String = "IN_PROGRESS",
            startedAtTimestamp: Double,
            elapsedSeconds: Int = 0,
            targetDurationSeconds: Int? = nil,
            totalFormattedDuration: String? = nil,
            subtitle: String? = nil,
            progress: Double = 0.0
        ) {
            self.currentStatus = currentStatus
            self.startedAtTimestamp = startedAtTimestamp
            self.elapsedSeconds = elapsedSeconds
            self.targetDurationSeconds = targetDurationSeconds
            self.totalFormattedDuration = totalFormattedDuration
            self.subtitle = subtitle
            self.progress = progress
        }
    }

    public var taskId: String
    public var taskTitle: String
    public var category: String?

    public init(taskId: String, taskTitle: String, category: String? = nil) {
        self.taskId = taskId
        self.taskTitle = taskTitle
        self.category = category
    }
}

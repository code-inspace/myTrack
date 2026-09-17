import Foundation
import ActivityKit

// MARK: - Structure de données partagée pour l'Activité en Direct
public struct TaskActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var currentStatus: String // "IN_PROGRESS", "PAUSED", "COMPLETED", "STANDBY", "SLEEP", "SLEEP_AWAKE"
        public var startedAtTimestamp: Double // UNIX timestamp en secondes
        public var elapsedSeconds: Int
        public var targetDurationSeconds: Int?
        public var totalFormattedDuration: String? // ex: "50 min et 57 s"
        public var subtitle: String? // ex: "Série 1/2 - 16 répétitions" ou "Fitness • En cours"
        public var progress: Double // 0.0 -> 1.0

        public var nextTaskId: String?
        public var nextTaskTitle: String?
        public var nextTaskCategory: String?

        // Sleep Mode specific fields
        public var isSleepMode: Bool?
        public var bedtime: String?
        public var wakeTime: String?
        public var sleepPhaseIndex: Int?
        public var sleepPhaseCount: Int?
        public var isAwakeBetweenPhases: Bool?

        public init(
            currentStatus: String = "IN_PROGRESS",
            startedAtTimestamp: Double,
            elapsedSeconds: Int = 0,
            targetDurationSeconds: Int? = nil,
            totalFormattedDuration: String? = nil,
            subtitle: String? = nil,
            progress: Double = 0.0,
            nextTaskId: String? = nil,
            nextTaskTitle: String? = nil,
            nextTaskCategory: String? = nil,
            isSleepMode: Bool? = false,
            bedtime: String? = nil,
            wakeTime: String? = nil,
            sleepPhaseIndex: Int? = 1,
            sleepPhaseCount: Int? = 1,
            isAwakeBetweenPhases: Bool? = false
        ) {
            self.currentStatus = currentStatus
            self.startedAtTimestamp = startedAtTimestamp
            self.elapsedSeconds = elapsedSeconds
            self.targetDurationSeconds = targetDurationSeconds
            self.totalFormattedDuration = totalFormattedDuration
            self.subtitle = subtitle
            self.progress = progress
            self.nextTaskId = nextTaskId
            self.nextTaskTitle = nextTaskTitle
            self.nextTaskCategory = nextTaskCategory
            self.isSleepMode = isSleepMode
            self.bedtime = bedtime
            self.wakeTime = wakeTime
            self.sleepPhaseIndex = sleepPhaseIndex
            self.sleepPhaseCount = sleepPhaseCount
            self.isAwakeBetweenPhases = isAwakeBetweenPhases
        }
    }

    public var taskId: String
    public var taskTitle: String
    public var category: String?
    public var projectColor: String? // Couleur hex du projet (ex: "#FF5733")
    public var projectName: String?  // Nom du projet

    public init(
        taskId: String,
        taskTitle: String,
        category: String? = nil,
        projectColor: String? = nil,
        projectName: String? = nil
    ) {
        self.taskId = taskId
        self.taskTitle = taskTitle
        self.category = category
        self.projectColor = projectColor
        self.projectName = projectName
    }
}

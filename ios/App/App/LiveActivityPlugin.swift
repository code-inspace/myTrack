import Foundation
import Capacitor
import ActivityKit
import WidgetKit

@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivityPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getActiveTask", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "syncTasks", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "syncStandby", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "syncSleepMode", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise)
    ]

    @objc func getActiveTask(_ call: CAPPluginCall) {
        let suite = UserDefaults(suiteName: "group.com.mytrack.app") ?? UserDefaults.standard
        let lastStoppedTaskId = suite.string(forKey: "mytrack_last_stopped_task_id")
        
        var activeList: [[String: Any]] = []
        if let rawListJson = suite.string(forKey: "mytrack_active_tasks"),
           let data = rawListJson.data(using: .utf8),
           let list = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            activeList = list
        } else if let tempUrlData = try? Data(contentsOf: URL(fileURLWithPath: "/tmp/mytrack_active_tasks.json")),
                  let list = try? JSONSerialization.jsonObject(with: tempUrlData) as? [[String: Any]] {
            activeList = list
        }

        var primaryTask: [String: Any]? = activeList.first
        if primaryTask == nil {
            if let rawJson = suite.string(forKey: "mytrack_active_task"),
               let data = rawJson.data(using: .utf8),
               let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                primaryTask = dict
                activeList = [dict]
            } else if let tempUrlData = try? Data(contentsOf: URL(fileURLWithPath: "/tmp/mytrack_active_task.json")),
                      let dict = try? JSONSerialization.jsonObject(with: tempUrlData) as? [String: Any] {
                primaryTask = dict
                activeList = [dict]
            }
        }

        // Nettoyage automatique des Live Activities orphelines
        if #available(iOS 16.2, *) {
            let activeTaskIds = Set(activeList.compactMap { $0["taskId"] as? String })
            Task {
                for activity in Activity<TaskActivityAttributes>.activities {
                    let actTaskId = activity.attributes.taskId
                    if actTaskId != "standby" && actTaskId != "sleep" && !activeTaskIds.contains(actTaskId) {
                        print("[LiveActivityPlugin] getActiveTask: Ending orphan Live Activity for task: \(actTaskId)")
                        await activity.end(nil, dismissalPolicy: .immediate)
                    }
                }
            }
        }

        if let task = primaryTask {
            call.resolve([
                "hasActiveTask": true,
                "task": task,
                "activeTasks": activeList,
                "lastStoppedTaskId": lastStoppedTaskId ?? NSNull()
            ])
            return
        }

        call.resolve([
            "hasActiveTask": false,
            "task": NSNull(),
            "activeTasks": [],
            "lastStoppedTaskId": lastStoppedTaskId ?? NSNull()
        ])
    }

    @objc func syncTasks(_ call: CAPPluginCall) {
        let suite = UserDefaults(suiteName: "group.com.mytrack.app") ?? UserDefaults.standard

        if let tasksArray = call.getArray("tasks") as? [[String: Any]],
           let data = try? JSONSerialization.data(withJSONObject: tasksArray),
           let jsonString = String(data: data, encoding: .utf8) {
            suite.set(jsonString, forKey: "mytrack_tasks_list")
            UserDefaults.standard.set(jsonString, forKey: "mytrack_tasks_list")
            let tempUrl = URL(fileURLWithPath: "/tmp/mytrack_tasks_list.json")
            try? data.write(to: tempUrl)
        }

        // Synchronisation des tâches actives (supporte jusqu'à 2 tâches)
        var normalizedActiveList: [[String: Any]] = []
        if let rawActiveArray = call.getArray("activeTasks") as? [[String: Any]] {
            for rawItem in rawActiveArray.prefix(2) {
                guard let taskId = rawItem["taskId"] as? String, !taskId.isEmpty else { continue }
                var item = rawItem
                if let rawTs = rawItem["startedAtTimestamp"] as? Double {
                    item["startedAtTimestamp"] = rawTs > 10000000000 ? rawTs / 1000.0 : rawTs
                } else {
                    item["startedAtTimestamp"] = Date().timeIntervalSince1970
                }
                normalizedActiveList.append(item)
            }
        } else if let activeTaskDict = call.getObject("activeTask") as? [String: Any],
                  let taskId = activeTaskDict["taskId"] as? String, !taskId.isEmpty {
            var item = activeTaskDict
            if let rawTs = activeTaskDict["startedAtTimestamp"] as? Double {
                item["startedAtTimestamp"] = rawTs > 10000000000 ? rawTs / 1000.0 : rawTs
            } else {
                item["startedAtTimestamp"] = Date().timeIntervalSince1970
            }
            normalizedActiveList.append(item)
        }

        if !normalizedActiveList.isEmpty {
            if let listData = try? JSONSerialization.data(withJSONObject: normalizedActiveList),
               let listJsonString = String(data: listData, encoding: .utf8) {
                suite.set(listJsonString, forKey: "mytrack_active_tasks")
                UserDefaults.standard.set(listJsonString, forKey: "mytrack_active_tasks")
                let tempUrl = URL(fileURLWithPath: "/tmp/mytrack_active_tasks.json")
                try? listData.write(to: tempUrl)
            }

            if let primary = normalizedActiveList.first,
               let primaryData = try? JSONSerialization.data(withJSONObject: primary),
               let primaryJsonString = String(data: primaryData, encoding: .utf8) {
                suite.set(primaryJsonString, forKey: "mytrack_active_task")
                UserDefaults.standard.set(primaryJsonString, forKey: "mytrack_active_task")
                let tempUrl = URL(fileURLWithPath: "/tmp/mytrack_active_task.json")
                try? primaryData.write(to: tempUrl)
            }
        } else {
            // Aucune tâche active -> suppression
            suite.removeObject(forKey: "mytrack_active_tasks")
            UserDefaults.standard.removeObject(forKey: "mytrack_active_tasks")
            suite.removeObject(forKey: "mytrack_active_task")
            UserDefaults.standard.removeObject(forKey: "mytrack_active_task")
            try? FileManager.default.removeItem(at: URL(fileURLWithPath: "/tmp/mytrack_active_tasks.json"))
            try? FileManager.default.removeItem(at: URL(fileURLWithPath: "/tmp/mytrack_active_task.json"))
        }

        // Réconcilier immédiatement les Live Activities iOS avec la liste des tâches actives réelles
        if #available(iOS 16.2, *) {
            let activeTaskIds = Set(normalizedActiveList.compactMap { $0["taskId"] as? String })
            Task {
                for activity in Activity<TaskActivityAttributes>.activities {
                    let actTaskId = activity.attributes.taskId
                    // Si l'activité n'est pas dans la liste des tâches actives et n'est ni standby ni sleep, on la ferme immédiatement
                    if actTaskId != "standby" && actTaskId != "sleep" && !activeTaskIds.contains(actTaskId) {
                        print("[LiveActivityPlugin] syncTasks: Terminating orphan Live Activity for task ID: \(actTaskId)")
                        await activity.end(nil, dismissalPolicy: .immediate)
                    }
                }
            }
        }

        if #available(iOS 14.0, macOS 11.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve(["success": true])
    }

    private func saveActiveTaskForWidget(
        taskId: String,
        taskTitle: String,
        category: String?,
        startedAtTimestamp: Double,
        subtitle: String?,
        totalFormattedDuration: String?
    ) {
        let suite = UserDefaults(suiteName: "group.com.mytrack.app") ?? UserDefaults.standard
        suite.removeObject(forKey: "mytrack_last_stopped_task_id")
        suite.removeObject(forKey: "mytrack_selected_widget_task_id")

        let normalizedTimestamp = startedAtTimestamp > 10000000000 ? startedAtTimestamp / 1000.0 : startedAtTimestamp

        let newDict: [String: Any] = [
            "taskId": taskId,
            "taskTitle": taskTitle,
            "category": category ?? "myTrack",
            "subtitle": subtitle ?? (category ?? "En cours"),
            "startedAtTimestamp": normalizedTimestamp,
            "totalFormattedDuration": totalFormattedDuration ?? ""
        ]

        // Lire les tâches déjà actives et ajouter/mettre à jour celle-ci (max 2)
        var currentActiveList: [[String: Any]] = []
        if let rawListJson = suite.string(forKey: "mytrack_active_tasks"),
           let data = rawListJson.data(using: .utf8),
           let list = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            currentActiveList = list
        }

        // Remplacer si même ID, sinon ajouter en tête et garder au maximum 2
        currentActiveList.removeAll { ($0["taskId"] as? String) == taskId }
        currentActiveList.insert(newDict, at: 0)
        let cappedList = Array(currentActiveList.prefix(2))

        if let listData = try? JSONSerialization.data(withJSONObject: cappedList),
           let listJsonString = String(data: listData, encoding: .utf8) {
            suite.set(listJsonString, forKey: "mytrack_active_tasks")
            UserDefaults.standard.set(listJsonString, forKey: "mytrack_active_tasks")
            let tempUrl = URL(fileURLWithPath: "/tmp/mytrack_active_tasks.json")
            try? listData.write(to: tempUrl)
        }

        // Garder mytrack_active_task pour rétrocompatibilité avec la tâche principale
        if let data = try? JSONSerialization.data(withJSONObject: newDict),
           let jsonString = String(data: data, encoding: .utf8) {
            suite.set(jsonString, forKey: "mytrack_active_task")
            UserDefaults.standard.set(jsonString, forKey: "mytrack_active_task")
            let tempUrl = URL(fileURLWithPath: "/tmp/mytrack_active_task.json")
            try? data.write(to: tempUrl)
        }

        if #available(iOS 14.0, macOS 11.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    private func clearActiveTaskForWidget(taskId: String? = nil) {
        let suite = UserDefaults(suiteName: "group.com.mytrack.app") ?? UserDefaults.standard
        suite.removeObject(forKey: "mytrack_selected_widget_task_id")
        UserDefaults.standard.removeObject(forKey: "mytrack_selected_widget_task_id")

        if let targetId = taskId, !targetId.isEmpty {
            suite.set(targetId, forKey: "mytrack_last_stopped_task_id")
            
            var currentActiveList: [[String: Any]] = []
            if let rawListJson = suite.string(forKey: "mytrack_active_tasks"),
               let data = rawListJson.data(using: .utf8),
               let list = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
                currentActiveList = list
            }

            currentActiveList.removeAll { ($0["taskId"] as? String) == targetId }

            if !currentActiveList.isEmpty {
                // Il reste encore 1 tâche active !
                if let listData = try? JSONSerialization.data(withJSONObject: currentActiveList),
                   let listJsonString = String(data: listData, encoding: .utf8) {
                    suite.set(listJsonString, forKey: "mytrack_active_tasks")
                    UserDefaults.standard.set(listJsonString, forKey: "mytrack_active_tasks")
                    let tempUrl = URL(fileURLWithPath: "/tmp/mytrack_active_tasks.json")
                    try? listData.write(to: tempUrl)
                }

                if let remaining = currentActiveList.first,
                   let primData = try? JSONSerialization.data(withJSONObject: remaining),
                   let primJson = String(data: primData, encoding: .utf8) {
                    suite.set(primJson, forKey: "mytrack_active_task")
                    UserDefaults.standard.set(primJson, forKey: "mytrack_active_task")
                    let tempUrl = URL(fileURLWithPath: "/tmp/mytrack_active_task.json")
                    try? primData.write(to: tempUrl)
                }
            } else {
                // Plus aucune tâche active
                suite.removeObject(forKey: "mytrack_active_tasks")
                UserDefaults.standard.removeObject(forKey: "mytrack_active_tasks")
                suite.removeObject(forKey: "mytrack_active_task")
                UserDefaults.standard.removeObject(forKey: "mytrack_active_task")
                try? FileManager.default.removeItem(at: URL(fileURLWithPath: "/tmp/mytrack_active_tasks.json"))
                try? FileManager.default.removeItem(at: URL(fileURLWithPath: "/tmp/mytrack_active_task.json"))
            }
        } else {
            // Tout effacer
            suite.removeObject(forKey: "mytrack_active_tasks")
            UserDefaults.standard.removeObject(forKey: "mytrack_active_tasks")
            suite.removeObject(forKey: "mytrack_active_task")
            UserDefaults.standard.removeObject(forKey: "mytrack_active_task")
            suite.removeObject(forKey: "mytrack_last_stopped_task_id")
            try? FileManager.default.removeItem(at: URL(fileURLWithPath: "/tmp/mytrack_active_tasks.json"))
            try? FileManager.default.removeItem(at: URL(fileURLWithPath: "/tmp/mytrack_active_task.json"))
        }

        if #available(iOS 14.0, macOS 11.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    @objc func startActivity(_ call: CAPPluginCall) {
        let taskId = call.getString("taskId") ?? UUID().uuidString
        let taskTitle = call.getString("taskTitle") ?? "Tâche"
        let category = call.getString("category") ?? "myTrack"
        let subtitle = call.getString("subtitle") ?? category
        let rawTimestamp = call.getDouble("startedAtTimestamp") ?? Date().timeIntervalSince1970
        let startedAtTimestamp = rawTimestamp > 10000000000 ? rawTimestamp / 1000.0 : rawTimestamp
        let totalFormattedDuration = call.getString("totalFormattedDuration") ?? "30 min"
        let progress = call.getDouble("progress") ?? 0.0

        // Synchroniser immédiatement pour le Widget macOS & iOS Home Screen (garde jusqu'à 2 tâches)
        saveActiveTaskForWidget(
            taskId: taskId,
            taskTitle: taskTitle,
            category: category,
            startedAtTimestamp: startedAtTimestamp,
            subtitle: subtitle,
            totalFormattedDuration: totalFormattedDuration
        )

        guard #available(iOS 16.2, *) else {
            call.resolve(["taskId": taskId, "note": "Widget updated, iOS 16.2+ needed for Live Activity"])
            return
        }

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
            totalFormattedDuration: totalFormattedDuration,
            subtitle: subtitle,
            progress: progress
        )

        Task {
            // 1. Fermer l'activité si le même taskId tourne déjà ou s'il y a une activité standby
            for runningActivity in Activity<TaskActivityAttributes>.activities {
                if runningActivity.attributes.taskId == taskId || runningActivity.attributes.taskId == "standby" {
                    await runningActivity.end(nil, dismissalPolicy: .immediate)
                }
            }

            // 2. Si on a déjà 2 ou plus d'activités en cours, fermer la plus ancienne pour ne garder que 2 max
            let currentActivities = Activity<TaskActivityAttributes>.activities.filter { $0.attributes.taskId != taskId && $0.attributes.taskId != "standby" }
            if currentActivities.count >= 2 {
                for oldActivity in currentActivities.dropFirst() {
                    await oldActivity.end(nil, dismissalPolicy: .immediate)
                }
            }

            do {
                let activity = try Activity<TaskActivityAttributes>.request(
                    attributes: attributes,
                    content: .init(state: initialContentState, staleDate: nil),
                    pushType: nil
                )

                print("[LiveActivityPlugin] Successfully launched Live Activity with ID: \(activity.id) for task: \(taskId)")

                call.resolve([
                    "activityId": activity.id,
                    "taskId": taskId
                ])
            } catch {
                print("[LiveActivityPlugin] Live Activity request failed: \(error.localizedDescription)")
                call.resolve([
                    "taskId": taskId,
                    "warning": "Live Activity error: \(error.localizedDescription)"
                ])
            }
        }
    }

    @objc func updateActivity(_ call: CAPPluginCall) {
        let taskId = call.getString("taskId")
        let rawTimestamp = call.getDouble("startedAtTimestamp")
        let subtitle = call.getString("subtitle")
        let progress = call.getDouble("progress")

        // 1. Update Widget / App Group Storage
        if let rawTs = rawTimestamp {
            let startedAtTimestamp = rawTs > 10000000000 ? rawTs / 1000.0 : rawTs
            let suite = UserDefaults(suiteName: "group.com.mytrack.app") ?? UserDefaults.standard
            
            var currentActiveList: [[String: Any]] = []
            if let rawListJson = suite.string(forKey: "mytrack_active_tasks"),
               let data = rawListJson.data(using: .utf8),
               let list = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
                currentActiveList = list
            }

            let updatedList = currentActiveList.map { item -> [String: Any] in
                var updated = item
                if taskId == nil || (item["taskId"] as? String) == taskId {
                    updated["startedAtTimestamp"] = startedAtTimestamp
                    if let sub = subtitle {
                        updated["subtitle"] = sub
                    }
                }
                return updated
            }

            if let listData = try? JSONSerialization.data(withJSONObject: updatedList),
               let listJsonString = String(data: listData, encoding: .utf8) {
                suite.set(listJsonString, forKey: "mytrack_active_tasks")
                UserDefaults.standard.set(listJsonString, forKey: "mytrack_active_tasks")
                try? listData.write(to: URL(fileURLWithPath: "/tmp/mytrack_active_tasks.json"))
            }

            if let prim = updatedList.first,
               let primData = try? JSONSerialization.data(withJSONObject: prim),
               let primJson = String(data: primData, encoding: .utf8) {
                suite.set(primJson, forKey: "mytrack_active_task")
                UserDefaults.standard.set(primJson, forKey: "mytrack_active_task")
                try? primData.write(to: URL(fileURLWithPath: "/tmp/mytrack_active_task.json"))
            }

            if #available(iOS 14.0, macOS 11.0, *) {
                WidgetCenter.shared.reloadAllTimelines()
            }
        }

        // 2. Update Live Activities (Dynamic Island & Lock Screen)
        if #available(iOS 16.2, *) {
            for activity in Activity<TaskActivityAttributes>.activities {
                if taskId == nil || activity.attributes.taskId == taskId {
                    var updatedState = activity.content.state
                    if let prog = progress {
                        updatedState.progress = prog
                    }
                    if let sub = subtitle {
                        updatedState.subtitle = sub
                    }
                    if let rawTs = rawTimestamp {
                        let startedAtTimestamp = rawTs > 10000000000 ? rawTs / 1000.0 : rawTs
                        updatedState.startedAtTimestamp = startedAtTimestamp
                    }
                    Task {
                        await activity.update(.init(state: updatedState, staleDate: nil))
                    }
                }
            }
        }

        call.resolve(["success": true])
    }

    @objc func stopActivity(_ call: CAPPluginCall) {
        let taskId = call.getString("taskId") ?? call.getString("activityId")

        clearActiveTaskForWidget(taskId: taskId)

        if #available(iOS 16.2, *) {
            for activity in Activity<TaskActivityAttributes>.activities {
                if taskId == nil || activity.attributes.taskId == taskId {
                    Task {
                        await activity.end(nil, dismissalPolicy: .immediate)
                    }
                }
            }

            // Si le mode veille est activé et qu'aucune autre activité ne tourne, démarrer le standby
            let suite = UserDefaults(suiteName: "group.com.mytrack.app") ?? UserDefaults.standard
            let isStandbyEnabled = suite.object(forKey: "mytrack_lockscreen_standby") as? Bool ?? true
            if isStandbyEnabled {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    let remaining = Activity<TaskActivityAttributes>.activities.filter {
                        if let tId = taskId { return $0.attributes.taskId != tId }
                        return false
                    }
                    if remaining.isEmpty {
                        var nextId: String? = nil
                        var nextTitle: String? = nil
                        var nextCategory: String? = nil

                        if let rawJson = suite.string(forKey: "mytrack_tasks_list"),
                           let data = rawJson.data(using: .utf8),
                           let tasks = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
                            if let firstUncompleted = tasks.first(where: { ($0["isCompleted"] as? Bool) != true }) {
                                nextId = firstUncompleted["id"] as? String
                                nextTitle = firstUncompleted["title"] as? String
                                nextCategory = firstUncompleted["category"] as? String
                            }
                        }

                        let attributes = TaskActivityAttributes(
                            taskId: "standby",
                            taskTitle: "myTrack",
                            category: "Prêt"
                        )
                        let contentState = TaskActivityAttributes.ContentState(
                            currentStatus: "STANDBY",
                            startedAtTimestamp: Date().timeIntervalSince1970,
                            elapsedSeconds: 0,
                            targetDurationSeconds: nil,
                            totalFormattedDuration: nil,
                            subtitle: "Prêt à démarrer",
                            progress: 0.0,
                            nextTaskId: nextId,
                            nextTaskTitle: nextTitle,
                            nextTaskCategory: nextCategory
                        )
                        _ = try? Activity<TaskActivityAttributes>.request(
                            attributes: attributes,
                            content: .init(state: contentState, staleDate: nil),
                            pushType: nil
                        )
                    }
                }
            }
        }

        call.resolve(["success": true])
    }

    @objc func syncStandby(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? true
        let nextTaskId = call.getString("nextTaskId")
        let nextTaskTitle = call.getString("nextTaskTitle")
        let nextTaskCategory = call.getString("nextTaskCategory")

        let suite = UserDefaults(suiteName: "group.com.mytrack.app") ?? UserDefaults.standard
        suite.set(enabled, forKey: "mytrack_lockscreen_standby")
        UserDefaults.standard.set(enabled, forKey: "mytrack_lockscreen_standby")

        guard #available(iOS 16.2, *) else {
            call.resolve(["success": true, "note": "iOS 16.2+ required for Live Activity"])
            return
        }

        if !enabled {
            // Fermer toute activité standby
            for activity in Activity<TaskActivityAttributes>.activities {
                if activity.attributes.taskId == "standby" {
                    Task {
                        await activity.end(nil, dismissalPolicy: .immediate)
                    }
                }
            }
            call.resolve(["success": true, "standby": false])
            return
        }

        // Si activé : vérifier si des tâches réelles sont déjà en cours
        let nonStandbyActivities = Activity<TaskActivityAttributes>.activities.filter { $0.attributes.taskId != "standby" }
        if !nonStandbyActivities.isEmpty {
            call.resolve(["success": true, "note": "Active task already running"])
            return
        }

        // Si une activité standby existe déjà, mettre à jour son contenu
        if let existingStandby = Activity<TaskActivityAttributes>.activities.first(where: { $0.attributes.taskId == "standby" }) {
            let updatedState = TaskActivityAttributes.ContentState(
                currentStatus: "STANDBY",
                startedAtTimestamp: Date().timeIntervalSince1970,
                elapsedSeconds: 0,
                targetDurationSeconds: nil,
                totalFormattedDuration: nil,
                subtitle: "Prêt à démarrer",
                progress: 0.0,
                nextTaskId: nextTaskId,
                nextTaskTitle: nextTaskTitle,
                nextTaskCategory: nextTaskCategory
            )
            Task {
                await existingStandby.update(.init(state: updatedState, staleDate: nil))
            }
            call.resolve(["success": true, "updated": true])
            return
        }

        // Créer une nouvelle activité de veille
        let attributes = TaskActivityAttributes(
            taskId: "standby",
            taskTitle: "myTrack",
            category: "Prêt"
        )
        let contentState = TaskActivityAttributes.ContentState(
            currentStatus: "STANDBY",
            startedAtTimestamp: Date().timeIntervalSince1970,
            elapsedSeconds: 0,
            targetDurationSeconds: nil,
            totalFormattedDuration: nil,
            subtitle: "Prêt à démarrer",
            progress: 0.0,
            nextTaskId: nextTaskId,
            nextTaskTitle: nextTaskTitle,
            nextTaskCategory: nextTaskCategory
        )

        do {
            let activity = try Activity<TaskActivityAttributes>.request(
                attributes: attributes,
                content: .init(state: contentState, staleDate: nil),
                pushType: nil
            )
            print("[LiveActivityPlugin] Standby Live Activity launched with ID: \(activity.id)")
            call.resolve(["success": true, "activityId": activity.id])
        } catch {
            print("[LiveActivityPlugin] Standby Live Activity request failed: \(error.localizedDescription)")
            call.resolve(["success": false, "error": error.localizedDescription])
        }
    }

    @objc func syncSleepMode(_ call: CAPPluginCall) {
        let isActive = call.getBool("isActive") ?? false
        let bedtime = call.getString("bedtime") ?? "23:00"
        let wakeTime = call.getString("wakeTime")
        let phaseIndex = call.getInt("phaseIndex") ?? 1
        let startedAtTimestamp = call.getDouble("startedAtTimestamp") ?? Date().timeIntervalSince1970

        let suite = UserDefaults(suiteName: "group.com.mytrack.app") ?? UserDefaults.standard
        suite.set(isActive, forKey: "mytrack_sleep_is_active")
        UserDefaults.standard.set(isActive, forKey: "mytrack_sleep_is_active")
        suite.set(bedtime, forKey: "mytrack_sleep_current_bedtime")
        UserDefaults.standard.set(bedtime, forKey: "mytrack_sleep_current_bedtime")
        if let w = wakeTime {
            suite.set(w, forKey: "mytrack_sleep_current_wake_time")
            UserDefaults.standard.set(w, forKey: "mytrack_sleep_current_wake_time")
        } else {
            suite.removeObject(forKey: "mytrack_sleep_current_wake_time")
            UserDefaults.standard.removeObject(forKey: "mytrack_sleep_current_wake_time")
        }
        suite.set(phaseIndex, forKey: "mytrack_sleep_phase_index")
        UserDefaults.standard.set(phaseIndex, forKey: "mytrack_sleep_phase_index")
        suite.set(startedAtTimestamp, forKey: "mytrack_sleep_started_timestamp")
        UserDefaults.standard.set(startedAtTimestamp, forKey: "mytrack_sleep_started_timestamp")

        if let sessionsArray = call.getArray("sessions") as? [[String: Any]],
           let data = try? JSONSerialization.data(withJSONObject: sessionsArray),
           let jsonStr = String(data: data, encoding: .utf8) {
            suite.set(jsonStr, forKey: "mytrack_sleep_sessions")
            UserDefaults.standard.set(jsonStr, forKey: "mytrack_sleep_sessions")
        }

        // Mettre à jour ou lancer la Live Activity Sommeil
        if #available(iOS 16.2, *) {
            if isActive {
                let sleepActivities = Activity<TaskActivityAttributes>.activities.filter { $0.attributes.taskId == "sleep" }
                let contentState = TaskActivityAttributes.ContentState(
                    currentStatus: "SLEEP",
                    startedAtTimestamp: startedAtTimestamp,
                    elapsedSeconds: 0,
                    subtitle: phaseIndex > 1 ? "Phase de sommeil \(phaseIndex)" : "En sommeil",
                    isSleepMode: true,
                    bedtime: bedtime,
                    wakeTime: wakeTime,
                    sleepPhaseIndex: phaseIndex,
                    sleepPhaseCount: phaseIndex,
                    isAwakeBetweenPhases: false
                )

                if let existing = sleepActivities.first {
                    Task {
                        await existing.update(.init(state: contentState, staleDate: nil))
                    }
                } else {
                    let attributes = TaskActivityAttributes(
                        taskId: "sleep",
                        taskTitle: "Mode Sommeil",
                        category: "Sommeil"
                    )
                    _ = try? Activity<TaskActivityAttributes>.request(
                        attributes: attributes,
                        content: .init(state: contentState, staleDate: nil),
                        pushType: nil
                    )
                }
            } else {
                // Si réveil en cours de nuit mais phase terminée
                if let w = wakeTime {
                    for activity in Activity<TaskActivityAttributes>.activities.filter({ $0.attributes.taskId == "sleep" }) {
                        Task {
                            let contentState = TaskActivityAttributes.ContentState(
                                currentStatus: "SLEEP_AWAKE",
                                startedAtTimestamp: startedAtTimestamp,
                                elapsedSeconds: 0,
                                subtitle: "Réveillé à \(w) • Phase \(phaseIndex) terminée",
                                isSleepMode: true,
                                bedtime: bedtime,
                                wakeTime: w,
                                sleepPhaseIndex: phaseIndex,
                                sleepPhaseCount: phaseIndex,
                                isAwakeBetweenPhases: true
                            )
                            await activity.update(.init(state: contentState, staleDate: nil))
                        }
                    }
                }
            }
        }

        WidgetCenter.shared.reloadAllTimelines()
        call.resolve(["success": true])
    }

    @objc func checkAuthorization(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve([
                "enabled": false,
                "frequentUpdatesEnabled": false,
                "supported": false,
                "reason": "iOS 16.2+ required"
            ])
            return
        }

        let info = ActivityAuthorizationInfo()
        call.resolve([
            "enabled": info.areActivitiesEnabled,
            "frequentUpdatesEnabled": info.frequentPushesEnabled,
            "supported": true
        ])
    }

    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let settingsUrl = URL(string: UIApplication.openSettingsURLString),
                  UIApplication.shared.canOpenURL(settingsUrl) else {
                call.reject("Cannot open settings URL")
                return
            }
            UIApplication.shared.open(settingsUrl) { success in
                call.resolve(["success": success])
            }
        }
    }
}

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
        CAPPluginMethod(name: "checkAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise)
    ]

    private func saveActiveTaskForWidget(
        taskId: String,
        taskTitle: String,
        category: String?,
        startedAtTimestamp: Double,
        subtitle: String?,
        totalFormattedDuration: String?
    ) {
        let dict: [String: Any] = [
            "taskId": taskId,
            "taskTitle": taskTitle,
            "category": category ?? "myTrack",
            "subtitle": subtitle ?? (category ?? "En cours"),
            "startedAtTimestamp": startedAtTimestamp,
            "totalFormattedDuration": totalFormattedDuration ?? ""
        ]
        if let data = try? JSONSerialization.data(withJSONObject: dict),
           let jsonString = String(data: data, encoding: .utf8) {
            UserDefaults(suiteName: "group.com.mytrack.app")?.set(jsonString, forKey: "mytrack_active_task")
            UserDefaults.standard.set(jsonString, forKey: "mytrack_active_task")
            
            // Fallback fichier partagé pour macOS (Mac Catalyst & Widget Simulator)
            let tempUrl = URL(fileURLWithPath: "/tmp/mytrack_active_task.json")
            try? data.write(to: tempUrl)
        }
        if #available(iOS 14.0, macOS 11.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    private func clearActiveTaskForWidget() {
        UserDefaults(suiteName: "group.com.mytrack.app")?.removeObject(forKey: "mytrack_active_task")
        UserDefaults.standard.removeObject(forKey: "mytrack_active_task")
        let tempUrl = URL(fileURLWithPath: "/tmp/mytrack_active_task.json")
        try? FileManager.default.removeItem(at: tempUrl)
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

        // Synchroniser immédiatement pour le Widget macOS & iOS Home Screen
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

        do {
            // Clôturer les activités précédentes pour n'en garder qu'une seule active
            for runningActivity in Activity<TaskActivityAttributes>.activities {
                Task {
                    await runningActivity.end(nil, dismissalPolicy: .immediate)
                }
            }

            let activity = try Activity<TaskActivityAttributes>.request(
                attributes: attributes,
                content: .init(state: initialContentState, staleDate: nil),
                pushType: nil
            )

            print("[LiveActivityPlugin] Successfully launched Live Activity with ID: \(activity.id)")

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

    @objc func updateActivity(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            let progress = call.getDouble("progress") ?? 0.0
            let subtitle = call.getString("subtitle")

            for activity in Activity<TaskActivityAttributes>.activities {
                var updatedState = activity.content.state
                updatedState.progress = progress
                if let sub = subtitle {
                    updatedState.subtitle = sub
                }
                Task {
                    await activity.update(.init(state: updatedState, staleDate: nil))
                }
            }
        }

        call.resolve(["success": true])
    }

    @objc func stopActivity(_ call: CAPPluginCall) {
        clearActiveTaskForWidget()

        if #available(iOS 16.2, *) {
            for activity in Activity<TaskActivityAttributes>.activities {
                Task {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }
        }

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

import Foundation
import Capacitor
import ActivityKit

@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivityPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopActivity", returnType: CAPPluginReturnPromise)
    ]

    @objc func startActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities require iOS 16.2+")
            return
        }

        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.reject("Live Activities are not enabled by user")
            return
        }

        let taskId = call.getString("taskId") ?? UUID().uuidString
        let taskTitle = call.getString("taskTitle") ?? "Tâche"
        let category = call.getString("category") ?? "myTrack"
        let subtitle = call.getString("subtitle") ?? category
        let rawTimestamp = call.getDouble("startedAtTimestamp") ?? Date().timeIntervalSince1970
        let startedAtTimestamp = rawTimestamp > 10000000000 ? rawTimestamp / 1000.0 : rawTimestamp
        let totalFormattedDuration = call.getString("totalFormattedDuration") ?? "30 min"
        let progress = call.getDouble("progress") ?? 0.0

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
            print("[LiveActivityPlugin] Failed to start Live Activity: \(error)")
            call.reject("Failed to start Live Activity: \(error.localizedDescription)")
        }
    }

    @objc func updateActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities require iOS 16.2+")
            return
        }

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

        call.resolve(["success": true])
    }

    @objc func stopActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities require iOS 16.2+")
            return
        }

        for activity in Activity<TaskActivityAttributes>.activities {
            Task {
                await activity.end(nil, dismissalPolicy: .immediate)
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

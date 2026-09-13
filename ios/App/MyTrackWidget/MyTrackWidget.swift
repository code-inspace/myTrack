//
//  MyTrackWidget.swift
//  MyTrackWidget
//
//  Created by Axel on 03/09/2026.
//

import WidgetKit
import SwiftUI

// MARK: - 1. Modèle de données pour la tâche active dans le Widget
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

public struct ActiveTaskApiResponse: Codable {
    public let active: Bool
    public let task: ActiveTaskWidgetModel?
}

public struct ActiveTaskEntry: TimelineEntry {
    public let date: Date
    public let task: ActiveTaskWidgetModel?

    public init(date: Date, task: ActiveTaskWidgetModel?) {
        self.date = date
        self.task = task
    }
}

// MARK: - 2. Provider de données (Hybride : Cache Local + API Temps Réel)
struct Provider: TimelineProvider {
    private func fetchLocalActiveTask() -> ActiveTaskWidgetModel? {
        if let rawJson = UserDefaults(suiteName: "group.com.mytrack.app")?.string(forKey: "mytrack_active_task")
            ?? UserDefaults.standard.string(forKey: "mytrack_active_task"),
           let data = rawJson.data(using: .utf8),
           let task = try? JSONDecoder().decode(ActiveTaskWidgetModel.self, from: data) {
            return task
        }

        // Fallback fichier partagé pour macOS
        let tempUrl = URL(fileURLWithPath: "/tmp/mytrack_active_task.json")
        if let data = try? Data(contentsOf: tempUrl),
           let task = try? JSONDecoder().decode(ActiveTaskWidgetModel.self, from: data) {
            return task
        }

        return nil
    }

    private func fetchRemoteActiveTask(completion: @escaping (ActiveTaskWidgetModel?) -> Void) {
        let candidateUrls = [
            "http://127.0.0.1:3000/api/widget/active-task",
            "http://192.168.68.105:3000/api/widget/active-task",
            "https://mytrack-nine.vercel.app/api/widget/active-task"
        ]

        func tryNextUrl(index: Int) {
            guard index < candidateUrls.count, let url = URL(string: candidateUrls[index]) else {
                completion(self.fetchLocalActiveTask())
                return
            }

            var request = URLRequest(url: url)
            request.timeoutInterval = 2.0
            request.cachePolicy = .reloadIgnoringLocalCacheData

            URLSession.shared.dataTask(with: request) { data, response, error in
                if let data = data,
                   let apiResp = try? JSONDecoder().decode(ActiveTaskApiResponse.self, from: data) {
                    if apiResp.active, let remoteTask = apiResp.task {
                        if let encoded = try? JSONEncoder().encode(remoteTask),
                           let jsonStr = String(data: encoded, encoding: .utf8) {
                            UserDefaults(suiteName: "group.com.mytrack.app")?.set(jsonStr, forKey: "mytrack_active_task")
                            UserDefaults.standard.set(jsonStr, forKey: "mytrack_active_task")
                        }
                        completion(remoteTask)
                        return
                    } else if !apiResp.active {
                        UserDefaults(suiteName: "group.com.mytrack.app")?.removeObject(forKey: "mytrack_active_task")
                        UserDefaults.standard.removeObject(forKey: "mytrack_active_task")
                        let tempUrl = URL(fileURLWithPath: "/tmp/mytrack_active_task.json")
                        try? FileManager.default.removeItem(at: tempUrl)
                        completion(nil)
                        return
                    }
                }
                tryNextUrl(index: index + 1)
            }.resume()
        }

        tryNextUrl(index: 0)
    }

    func placeholder(in context: Context) -> ActiveTaskEntry {
        ActiveTaskEntry(
            date: Date(),
            task: ActiveTaskWidgetModel(
                taskId: "preview-task",
                taskTitle: "Conf scaleway",
                category: "General",
                subtitle: "En cours",
                startedAtTimestamp: Date().timeIntervalSince1970 - 1800,
                totalFormattedDuration: "45 min"
            )
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (ActiveTaskEntry) -> Void) {
        if let local = fetchLocalActiveTask() {
            completion(ActiveTaskEntry(date: Date(), task: local))
        } else {
            fetchRemoteActiveTask { task in
                completion(ActiveTaskEntry(date: Date(), task: task))
            }
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ActiveTaskEntry>) -> Void) {
        fetchRemoteActiveTask { task in
            let entry = ActiveTaskEntry(date: Date(), task: task)
            // Rafraîchissement automatique toutes les 60 secondes
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
        .configurationDisplayName("myTrack — Tâche en cours")
        .description("Affiche la tâche en cours avec le chrono en direct et le bouton Arrêter.")
        .supportedFamilies([.systemSmall, .systemMedium])
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
            if let task = entry.task {
                if family == .systemMedium {
                    MediumActiveTaskView(task: task, brandNeon: brandNeon, darkBg: darkBg)
                } else {
                    SmallActiveTaskView(task: task, brandNeon: brandNeon, darkBg: darkBg)
                }
            } else {
                EmptyTaskWidgetView(brandNeon: brandNeon, darkBg: darkBg)
            }
        }
        .containerBackground(for: .widget) {
            if entry.task != nil {
                brandNeon
            } else {
                darkBg
            }
        }
    }
}

// MARK: - 5. Vue Format Moyen (1:1 avec la bannière de l'application)
struct MediumActiveTaskView: View {
    let task: ActiveTaskWidgetModel
    let brandNeon: Color
    let darkBg: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Ligne du haut : Point clignotant + Titre + Bouton Arrêter
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

                // Bouton Arrêter (1:1 avec le bouton blanc de l'app)
                Link(destination: URL(string: "mytrack://stop-task?id=\(task.taskId)")!) {
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
            }

            Spacer()

            // Ligne du bas : Heure de début et Chrono en direct
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

                // Pilule Chrono Noir + Vert Fluo
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

// MARK: - 6. Vue Format Petit
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

                Link(destination: URL(string: "mytrack://stop-task?id=\(task.taskId)")!) {
                    Image(systemName: "square.fill")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(darkBg)
                        .padding(8)
                        .background(Color.white)
                        .clipShape(Circle())
                        .shadow(color: Color.black.opacity(0.15), radius: 2, x: 0, y: 1)
                }
            }
        }
        .padding(12)
    }
}

// MARK: - 7. Vue État Inactif / Vide
struct EmptyTaskWidgetView: View {
    let brandNeon: Color
    let darkBg: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: "figure.run.circle.fill")
                    .font(.system(size: 18))
                    .foregroundColor(brandNeon)
                Text("myTrack")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
                Spacer()
            }

            Spacer()

            Text("Aucune tâche en cours")
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(.white)

            Text("Touchez pour démarrer votre routine")
                .font(.system(size: 11))
                .foregroundColor(Color.gray)
                .lineLimit(1)
        }
        .padding(14)
        .widgetURL(URL(string: "mytrack://tasks"))
    }
}

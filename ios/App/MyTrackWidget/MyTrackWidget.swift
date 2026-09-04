//
//  MyTrackWidget.swift
//  MyTrackWidget
//
//  Created by Axel on 03/09/2026.
//

import WidgetKit
import SwiftUI

struct HomeWidgetEntry: TimelineEntry {
    let date: Date
    let emoji: String
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> HomeWidgetEntry {
        HomeWidgetEntry(date: Date(), emoji: "⚡️")
    }

    func getSnapshot(in context: Context, completion: @escaping (HomeWidgetEntry) -> Void) {
        completion(HomeWidgetEntry(date: Date(), emoji: "⚡️"))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HomeWidgetEntry>) -> Void) {
        let entry = HomeWidgetEntry(date: Date(), emoji: "⚡️")
        let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(3600)))
        completion(timeline)
    }
}

struct MyTrackWidget: Widget {
    let kind: String = "MyTrackWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Image(systemName: "figure.run.circle.fill")
                        .foregroundColor(Color(red: 0.83, green: 0.96, blue: 0.24))
                    Text("myTrack")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.white)
                }
                Spacer()
                Text("Prêt à démarrer !")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.white)
                Text("Vos tâches & agenda synchronisés")
                    .font(.system(size: 10))
                    .foregroundColor(.gray)
            }
            .padding()
            .containerBackground(for: .widget) {
                Color(red: 0.10, green: 0.11, blue: 0.14)
            }
        }
        .configurationDisplayName("myTrack")
        .description("Suivez vos tâches en direct.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

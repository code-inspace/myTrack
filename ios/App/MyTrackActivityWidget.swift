import ActivityKit
import WidgetKit
import SwiftUI
import AppIntents

// MARK: - 1. Structure de données partagée pour l'Activité en Direct
struct TaskActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var currentStatus: String // "IN_PROGRESS", "PAUSED", "COMPLETED"
        var startedAtTimestamp: Double
        var elapsedSeconds: Int
        var targetDurationSeconds: Int?
        var totalFormattedDuration: String? // ex: "50 min et 57 s"
        var subtitle: String? // ex: "Série 1/2 - 16 répétitions" ou "Fitness • En cours"
        var progress: Double // 0.0 -> 1.0
    }

    var taskId: String
    var taskTitle: String
    var category: String?
}

// MARK: - 2. Configuration du Widget & Dynamic Island
@main
struct MyTrackActivityWidget: Widget {
    let brandNeon = Color(red: 0.83, green: 0.96, blue: 0.24) // #D4F63D
    let darkCard = Color(red: 0.12, green: 0.13, blue: 0.16)

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TaskActivityAttributes.self) { context in
            // ==========================================
            // VUE ÉCRAN DE VERROUILLAGE (Lock Screen)
            // ==========================================
            LockScreenLiveActivityView(context: context, brandNeon: brandNeon)
                .activityBackgroundTint(Color.black.opacity(0.65))
                .activitySystemActionForegroundColor(brandNeon)

        } dynamicIsland: { context in
            // ==========================================
            // DYNAMIC ISLAND (Haut de l'écran)
            // ==========================================
            DynamicIsland {
                // Expanded (Appui long sur la Dynamic Island)
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        MyTrackLogoView(size: 20)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(context.attributes.taskTitle)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.white)
                                .lineLimit(1)
                            Text(context.state.subtitle ?? context.attributes.category ?? "myTrack")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(.gray)
                        }
                    }
                    .padding(.leading, 4)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(timerInterval: Date(timeIntervalSince1970: context.state.startedAtTimestamp)...Date(timeIntervalSinceNow: 86400), countsDown: false)
                            .font(.system(size: 18, weight: .heavy, design: .monospaced))
                            .foregroundColor(brandNeon)

                        if let total = context.state.totalFormattedDuration {
                            Text(total)
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(.gray)
                        }
                    }
                    .padding(.trailing, 4)
                }

                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        // Barre de progression
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule()
                                    .fill(Color.white.opacity(0.15))
                                    .frame(height: 4)
                                Capsule()
                                    .fill(brandNeon)
                                    .frame(width: max(8, geo.size.width * CGFloat(min(1.0, max(0.05, context.state.progress)))), height: 4)
                            }
                        }
                        .frame(height: 4)

                        Spacer(minLength: 16)

                        // Bouton valider
                        Link(destination: URL(string: "mytrack://complete-task?id=\(context.attributes.taskId)")!) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 20))
                                .foregroundColor(brandNeon)
                        }
                    }
                    .padding(.horizontal, 4)
                    .padding(.top, 6)
                }

            } compactLeading: {
                // ==========================================
                // PILULE GAUCHE : Logo myTrack en Vert Fluo
                // ==========================================
                MyTrackLogoView(size: 16)
                    .padding(.leading, 4)

            } compactTrailing: {
                // ==========================================
                // PILULE DROITE : Timer en direct (ex: 0:31)
                // ==========================================
                Text(timerInterval: Date(timeIntervalSince1970: context.state.startedAtTimestamp)...Date(timeIntervalSinceNow: 86400), countsDown: false)
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .monospacedDigit()
                    .foregroundColor(.white)
                    .padding(.trailing, 4)

            } minimal: {
                // Vue minimale (quand 2 apps partagent l'île)
                MyTrackLogoView(size: 14)
            }
        }
    }
}

// MARK: - 3. Vue Écran de Verrouillage (Reproduction exacte du design)
struct LockScreenLiveActivityView: View {
    let context: ActivityViewContext<TaskActivityAttributes>
    let brandNeon: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Ligne 1 : Titre + Sous-titre à gauche, Durée totale + Bouton Checkmark à droite
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(context.attributes.taskTitle)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                        .lineLimit(1)

                    Text(context.state.subtitle ?? (context.attributes.category ?? "En cours"))
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(Color.white.opacity(0.8))
                        .lineLimit(1)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 6) {
                    if let total = context.state.totalFormattedDuration {
                        Text(total)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.white)
                    }

                    // Bouton bleu/neon avec checkmark
                    Link(destination: URL(string: "mytrack://complete-task?id=\(context.attributes.taskId)")!) {
                        ZStack {
                            Circle()
                                .fill(Color(red: 0.12, green: 0.40, blue: 0.85)) // Bleu iOS
                                .frame(width: 32, height: 32)
                            Image(systemName: "checkmark")
                                .font(.system(size: 14, weight: .black))
                                .foregroundColor(.white)
                        }
                    }
                }
            }

            // Ligne 2 : Barre de progression verte fluo #D4F63D
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.white.opacity(0.15))
                        .frame(height: 4)

                    Capsule()
                        .fill(brandNeon)
                        .frame(
                            width: max(10, geo.size.width * CGFloat(min(1.0, max(0.05, context.state.progress)))),
                            height: 4
                        )
                }
            }
            .frame(height: 4)

            // Ligne 3 : Chronomètre écoulé (ex: 0:14)
            HStack {
                Text(timerInterval: Date(timeIntervalSince1970: context.state.startedAtTimestamp)...Date(timeIntervalSinceNow: 86400), countsDown: false)
                    .font(.system(size: 13, weight: .semibold, design: .monospaced))
                    .monospacedDigit()
                    .foregroundColor(Color.white.opacity(0.9))

                Spacer()
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Color(red: 0.10, green: 0.11, blue: 0.14).opacity(0.92))
        .cornerRadius(20)
    }
}

// MARK: - Logo myTrack stylisé (Hexagone / G vert fluo)
struct MyTrackLogoView: View {
    let size: CGFloat

    var body: some View {
        ZStack {
            Image(systemName: "figure.run.circle.fill")
                .resizable()
                .scaledToFit()
                .frame(width: size, height: size)
                .foregroundColor(Color(red: 0.83, green: 0.96, blue: 0.24)) // #D4F63D
        }
    }
}

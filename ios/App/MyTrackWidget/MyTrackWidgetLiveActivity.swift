//
//  MyTrackWidgetLiveActivity.swift
//  MyTrackWidget
//
//  Created by Axel on 03/09/2026.
//

import ActivityKit
import WidgetKit
import SwiftUI
import AppIntents

// MARK: - App Logo View
public struct AppLogoView: View {
    public var size: CGFloat = 16
    public var cornerRadius: CGFloat? = nil

    private let brandNeon = Color(red: 0.83, green: 0.96, blue: 0.24) // #D4F63D
    private let darkBg = Color(red: 0.07, green: 0.07, blue: 0.08) // #111214

    public init(size: CGFloat = 16, cornerRadius: CGFloat? = nil) {
        self.size = size
        self.cornerRadius = cornerRadius
    }

    public var body: some View {
        Group {
            if let uiImage = UIImage(named: "AppLogo") {
                Image(uiImage: uiImage)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: size, height: size)
                    .clipShape(RoundedRectangle(cornerRadius: cornerRadius ?? (size * 0.26)))
            } else {
                ZStack {
                    RoundedRectangle(cornerRadius: cornerRadius ?? (size * 0.26))
                        .fill(brandNeon)
                        .frame(width: size, height: size)

                    AppLogoCheckmark()
                        .stroke(darkBg, style: StrokeStyle(lineWidth: max(1.5, size * 0.14), lineCap: .round, lineJoin: .round))
                        .frame(width: size * 0.52, height: size * 0.40)
                }
            }
        }
        .frame(width: size, height: size)
    }
}

public struct AppLogoCheckmark: Shape {
    public func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.midY + rect.height * 0.1))
        path.addLine(to: CGPoint(x: rect.minX + rect.width * 0.38, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        return path
    }
}

// MARK: - Widget Live Activity (Dynamic Island & Lock Screen)
struct MyTrackWidgetLiveActivity: Widget {
    let brandNeon = Color(red: 0.83, green: 0.96, blue: 0.24) // #D4F63D
    let sleepIndigo = Color(red: 0.38, green: 0.45, blue: 0.98) // #6173FA

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TaskActivityAttributes.self) { context in
            // ==========================================
            // VUE ÉCRAN DE VERROUILLAGE (Lock Screen)
            // ==========================================
            LockScreenLiveActivityView(context: context, brandNeon: brandNeon, sleepIndigo: sleepIndigo)
                .activityBackgroundTint(Color.black.opacity(0.75))
                .activitySystemActionForegroundColor(brandNeon)

        } dynamicIsland: { context in
            // ==========================================
            // DYNAMIC ISLAND (Haut de l'écran)
            // ==========================================
            DynamicIsland {
                // Région étendue gauche (Appui long)
                DynamicIslandExpandedRegion(.leading) {
                    if context.state.isSleepMode == true || context.state.currentStatus == "SLEEP" || context.state.currentStatus == "SLEEP_AWAKE" {
                        HStack(spacing: 6) {
                            ZStack {
                                Circle()
                                    .fill(sleepIndigo.opacity(0.25))
                                    .frame(width: 22, height: 22)
                                Image(systemName: "moon.stars.fill")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(sleepIndigo)
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Mode Sommeil")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(.white)
                                    .lineLimit(1)
                                let phaseIdx = context.state.sleepPhaseIndex ?? 1
                                Text(phaseIdx > 1 ? "Phase de sommeil \(phaseIdx)" : "Nuit")
                                    .font(.system(size: 10.5, weight: .medium))
                                    .foregroundColor(.gray)
                            }
                        }
                        .padding(.leading, 4)
                    } else {
                        HStack(spacing: 6) {
                            AppLogoView(size: 20)
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
                }

                // Région étendue droite (Appui long)
                DynamicIslandExpandedRegion(.trailing) {
                    if context.state.isSleepMode == true || context.state.currentStatus == "SLEEP" || context.state.currentStatus == "SLEEP_AWAKE" {
                        VStack(alignment: .trailing, spacing: 2) {
                            if let bTime = context.state.bedtime {
                                Text("Couché : \(bTime)")
                                    .font(.system(size: 12, weight: .bold, design: .rounded))
                                    .foregroundColor(sleepIndigo)
                            }
                            if let wTime = context.state.wakeTime {
                                Text("Réveil : \(wTime)")
                                    .font(.system(size: 10.5, weight: .semibold))
                                    .foregroundColor(brandNeon)
                            }
                        }
                        .padding(.trailing, 4)
                    } else if context.state.currentStatus == "STANDBY" {
                        Link(destination: URL(string: "mytrack://tasks?action=new-task")!) {
                            HStack(spacing: 4) {
                                Image(systemName: "plus.circle.fill")
                                    .font(.system(size: 11, weight: .bold))
                                Text("Ajouter")
                                    .font(.system(size: 11, weight: .bold))
                            }
                            .foregroundColor(brandNeon)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.white.opacity(0.12))
                            .clipShape(Capsule())
                        }
                        .padding(.trailing, 4)
                    } else {
                        let taskAccent: Color = context.attributes.projectColor.flatMap { h in h.isEmpty ? nil : Color(hexString: h) } ?? Color(red: 0.83, green: 0.96, blue: 0.24)
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(timerInterval: Date(timeIntervalSince1970: context.state.startedAtTimestamp)...Date(timeIntervalSinceNow: 86400), countsDown: false)
                                .font(.system(size: 18, weight: .heavy, design: .monospaced))
                                .foregroundColor(taskAccent)

                            if let total = context.state.totalFormattedDuration {
                                Text(total)
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(.gray)
                            }
                        }
                        .padding(.trailing, 4)
                    }
                }

                // Région étendue bas (Appui long)
                DynamicIslandExpandedRegion(.bottom) {
                    if context.state.isSleepMode == true || context.state.currentStatus == "SLEEP" || context.state.currentStatus == "SLEEP_AWAKE" {
                        let isSecond = context.state.isSecondSleep == true || (context.state.sleepPhaseIndex ?? 1) > 1
                        HStack(spacing: 8) {
                            if isSecond {
                                Button(intent: SleepNotSleepingIntent()) {
                                    HStack(spacing: 4) {
                                        Image(systemName: "xmark.circle.fill")
                                            .font(.system(size: 10, weight: .bold))
                                        Text("Je ne dors pas")
                                            .font(.system(size: 11, weight: .bold))
                                    }
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(Color.white.opacity(0.16))
                                    .clipShape(Capsule())
                                }
                                .buttonStyle(.plain)

                                Spacer()

                                Button(intent: SleepWakeNowIntent()) {
                                    HStack(spacing: 4) {
                                        Image(systemName: "sun.max.fill")
                                            .font(.system(size: 10, weight: .bold))
                                        Text("Je me réveille")
                                            .font(.system(size: 11, weight: .bold))
                                    }
                                    .foregroundColor(Color(red: 0.07, green: 0.07, blue: 0.08))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(brandNeon)
                                    .clipShape(Capsule())
                                }
                                .buttonStyle(.plain)
                            } else {
                                Button(intent: SleepStartNowIntent()) {
                                    HStack(spacing: 4) {
                                        Image(systemName: "bed.double.fill")
                                            .font(.system(size: 10, weight: .bold))
                                        Text("Je me couche")
                                            .font(.system(size: 11, weight: .bold))
                                    }
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(sleepIndigo.opacity(0.85))
                                    .clipShape(Capsule())
                                }
                                .buttonStyle(.plain)

                                Spacer()

                                Button(intent: SleepWakeNowIntent()) {
                                    HStack(spacing: 4) {
                                        Image(systemName: "sun.max.fill")
                                            .font(.system(size: 10, weight: .bold))
                                        Text("Je me réveille")
                                            .font(.system(size: 11, weight: .bold))
                                    }
                                    .foregroundColor(Color(red: 0.07, green: 0.07, blue: 0.08))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(brandNeon)
                                    .clipShape(Capsule())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 4)
                        .padding(.top, 4)
                    } else if context.state.currentStatus == "STANDBY" {
                        if let nextTitle = context.state.nextTaskTitle, let nextId = context.state.nextTaskId {
                            HStack(spacing: 8) {
                                HStack(spacing: 4) {
                                    Text("📋")
                                        .font(.system(size: 11))
                                    Text(nextTitle)
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundColor(.white)
                                        .lineLimit(1)
                                }

                                Spacer()

                                Button(intent: StartTaskIntent(taskId: nextId, taskTitle: nextTitle, category: context.state.nextTaskCategory ?? "myTrack")) {
                                    HStack(spacing: 4) {
                                        Image(systemName: "play.fill")
                                            .font(.system(size: 9, weight: .bold))
                                        Text("Démarrer")
                                            .font(.system(size: 11, weight: .bold))
                                    }
                                    .foregroundColor(Color(red: 0.07, green: 0.07, blue: 0.08))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 4)
                                    .background(brandNeon)
                                    .clipShape(Capsule())
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(.horizontal, 4)
                            .padding(.top, 4)
                        } else {
                            Link(destination: URL(string: "mytrack://tasks?action=new-task")!) {
                                HStack {
                                    Image(systemName: "plus.circle.fill")
                                        .foregroundColor(brandNeon)
                                    Text("Créer une nouvelle tâche...")
                                        .font(.system(size: 12))
                                        .foregroundColor(Color(white: 0.6))
                                    Spacer()
                                }
                                .padding(.horizontal, 8)
                                .padding(.vertical, 5)
                                .background(Color.white.opacity(0.1))
                                .cornerRadius(8)
                            }
                            .padding(.horizontal, 4)
                            .padding(.top, 4)
                        }
                    } else {
                        let taskAccent: Color = context.attributes.projectColor.flatMap { h in h.isEmpty ? nil : Color(hexString: h) } ?? Color(red: 0.83, green: 0.96, blue: 0.24)
                        HStack {
                            GeometryReader { geo in
                                ZStack(alignment: .leading) {
                                    Capsule()
                                        .fill(Color.white.opacity(0.15))
                                        .frame(height: 4)
                                    Capsule()
                                        .fill(taskAccent)
                                        .frame(width: max(8, geo.size.width * CGFloat(min(1.0, max(0.05, context.state.progress)))), height: 4)
                                }
                            }
                            .frame(height: 4)

                            Spacer(minLength: 16)

                            Button(intent: StopLiveActivityIntent(taskId: context.attributes.taskId)) {
                                HStack(spacing: 4) {
                                    Image(systemName: "square.fill")
                                        .font(.system(size: 10, weight: .bold))
                                    Text("Arrêter")
                                        .font(.system(size: 11, weight: .bold))
                                }
                                .foregroundColor(Color(red: 0.07, green: 0.07, blue: 0.08))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(Color.white)
                                .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 4)
                        .padding(.top, 6)
                    }
                }

            } compactLeading: {
                // ==========================================
                // PILULE GAUCHE
                // ==========================================
                if context.state.isSleepMode == true || context.state.currentStatus == "SLEEP" || context.state.currentStatus == "SLEEP_AWAKE" {
                    Image(systemName: "moon.stars.fill")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(sleepIndigo)
                } else {
                    AppLogoView(size: 13)
                        .frame(width: 13, height: 13)
                }

            } compactTrailing: {
                // ==========================================
                // PILULE DROITE
                // ==========================================
                if context.state.isSleepMode == true || context.state.currentStatus == "SLEEP" || context.state.currentStatus == "SLEEP_AWAKE" {
                    if let bTime = context.state.bedtime {
                        Text(bTime)
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .foregroundColor(sleepIndigo)
                    } else {
                        Text("😴")
                            .font(.system(size: 10))
                    }
                } else if context.state.currentStatus == "STANDBY" {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(brandNeon)
                } else {
                    Text(timerInterval: Date(timeIntervalSince1970: context.state.startedAtTimestamp)...Date(timeIntervalSinceNow: 86400), countsDown: false)
                        .font(.system(size: 11.5, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .multilineTextAlignment(.trailing)
                        .frame(width: 32, alignment: .trailing)
                }

            } minimal: {
                if context.state.isSleepMode == true || context.state.currentStatus == "SLEEP" || context.state.currentStatus == "SLEEP_AWAKE" {
                    Image(systemName: "moon.stars.fill")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(sleepIndigo)
                } else {
                    AppLogoView(size: 12)
                        .frame(width: 12, height: 12)
                }
            }
        }
    }
}

// MARK: - 3. Vue Écran de Verrouillage (Design 1:1)
struct LockScreenLiveActivityView: View {
    let context: ActivityViewContext<TaskActivityAttributes>
    let brandNeon: Color
    var sleepIndigo: Color = Color(red: 0.38, green: 0.45, blue: 0.98)

    /// Couleur d'accent du projet (brandNeon #D4F63D si non défini)
    var accentColor: Color {
        if let hex = context.attributes.projectColor, !hex.isEmpty {
            return Color(hexString: hex)
        }
        return brandNeon
    }

    var isSleep: Bool {
        context.state.isSleepMode == true ||
        context.state.currentStatus == "SLEEP" ||
        context.state.currentStatus == "SLEEP_AWAKE" ||
        context.attributes.taskId == "sleep"
    }

    var body: some View {
        if isSleep {
            // ============================================================
            // MODE SOMMEIL (SLEEP MODE) : 2 Boutons Coucher / Réveil
            // ============================================================
            let phaseIdx = context.state.sleepPhaseIndex ?? 1
            let isAwake = context.state.isAwakeBetweenPhases == true || context.state.currentStatus == "SLEEP_AWAKE"
            let isSecond = context.state.isSecondSleep == true || phaseIdx > 1

            VStack(alignment: .leading, spacing: 10) {
                // Header Mode Sommeil
                HStack(alignment: .center, spacing: 8) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(sleepIndigo.opacity(0.2))
                            .frame(width: 28, height: 28)
                        Image(systemName: isAwake ? "sun.haze.fill" : (isSecond ? "moon.zzz.fill" : "moon.stars.fill"))
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(isAwake ? brandNeon : (isSecond ? Color(red: 0.65, green: 0.72, blue: 1.0) : sleepIndigo))
                    }

                    VStack(alignment: .leading, spacing: 1) {
                        HStack(spacing: 6) {
                            Text(isSecond ? "2nd Sommeil" : "Mode Sommeil")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.white)

                            if phaseIdx > 1 {
                                Text("Phase \(phaseIdx)")
                                    .font(.system(size: 9.5, weight: .heavy))
                                    .foregroundColor(sleepIndigo)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 1.5)
                                    .background(sleepIndigo.opacity(0.18))
                                    .clipShape(Capsule())
                            }
                        }

                        if let sub = context.state.subtitle, !sub.isEmpty {
                            Text(sub)
                                .font(.system(size: 10.5, weight: .medium))
                                .foregroundColor(Color.gray)
                        } else if let bTime = context.state.bedtime {
                            Text(isSecond ? "Détecté après inactivité" : (isAwake ? "Réveillé" : "Couché à \(bTime)"))
                                .font(.system(size: 10.5, weight: .medium))
                                .foregroundColor(Color.gray)
                        }
                    }

                    Spacer()

                    if let bTime = context.state.bedtime {
                        VStack(alignment: .trailing, spacing: 1) {
                            Text(isSecond ? "Début" : "Couché")
                                .font(.system(size: 9, weight: .semibold))
                                .foregroundColor(Color.gray)
                            Text(bTime)
                                .font(.system(size: 12, weight: .bold, design: .rounded))
                                .foregroundColor(sleepIndigo)
                        }
                    }
                }

                // Boutons d'Action Principaux
                HStack(spacing: 10) {
                    if isSecond {
                        // Bouton 1 : Je ne dors pas (annuler)
                        Button(intent: SleepNotSleepingIntent()) {
                            HStack(spacing: 5) {
                                Image(systemName: "xmark.circle.fill")
                                    .font(.system(size: 11, weight: .bold))
                                Text("Je ne dors pas")
                                    .font(.system(size: 12.5, weight: .bold))
                            }
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 9)
                            .background(Color.white.opacity(0.14))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)

                        // Bouton 2 : Je me réveille maintenant
                        Button(intent: SleepWakeNowIntent()) {
                            HStack(spacing: 5) {
                                Image(systemName: "sun.max.fill")
                                    .font(.system(size: 11, weight: .bold))
                                Text("Je me réveille")
                                    .font(.system(size: 12.5, weight: .bold))
                            }
                            .foregroundColor(Color(red: 0.07, green: 0.07, blue: 0.08))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 9)
                            .background(brandNeon)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .shadow(color: brandNeon.opacity(0.25), radius: 3, x: 0, y: 1)
                        }
                        .buttonStyle(.plain)
                    } else {
                        // Bouton 1 : Je me couche maintenant
                        Button(intent: SleepStartNowIntent()) {
                            HStack(spacing: 5) {
                                Image(systemName: "bed.double.fill")
                                    .font(.system(size: 11, weight: .bold))
                                Text("Je me couche")
                                    .font(.system(size: 12.5, weight: .bold))
                            }
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 9)
                            .background(sleepIndigo.opacity(0.9))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .shadow(color: sleepIndigo.opacity(0.3), radius: 3, x: 0, y: 1)
                        }
                        .buttonStyle(.plain)

                        // Bouton 2 : Je me réveille maintenant
                        Button(intent: SleepWakeNowIntent()) {
                            HStack(spacing: 5) {
                                Image(systemName: "sun.max.fill")
                                    .font(.system(size: 11, weight: .bold))
                                Text("Je me réveille")
                                    .font(.system(size: 12.5, weight: .bold))
                            }
                            .foregroundColor(Color(red: 0.07, green: 0.07, blue: 0.08))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 9)
                            .background(brandNeon)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .shadow(color: brandNeon.opacity(0.25), radius: 3, x: 0, y: 1)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, 15)
            .padding(.vertical, 13)
            .background(Color(red: 0.08, green: 0.09, blue: 0.13).opacity(0.97))
            .cornerRadius(20)

        } else if context.state.currentStatus == "STANDBY" {
            // ============================================================
            // MODE EN ATTENTE (STANDBY) : Aucune tâche active en cours
            // ============================================================
            VStack(alignment: .leading, spacing: 9) {
                // Ligne 1 : Header avec logo et titre
                HStack(alignment: .center, spacing: 8) {
                    AppLogoView(size: 20)

                    VStack(alignment: .leading, spacing: 1) {
                        Text("myTrack")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)

                        Text("Prêt à démarrer une action")
                            .font(.system(size: 10.5, weight: .medium))
                            .foregroundColor(Color.gray)
                    }

                    Spacer()

                    // Bouton fermer le standby si l'utilisateur veut le masquer
                    Button(intent: StopLiveActivityIntent(taskId: context.attributes.taskId)) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 16))
                            .foregroundColor(Color.gray.opacity(0.7))
                    }
                    .buttonStyle(.plain)
                }

                // Ligne 2 : Barre de saisie interactive avec redirection et clavier ouvert
                Link(destination: URL(string: "mytrack://tasks?action=new-task")!) {
                    HStack(spacing: 8) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(brandNeon)

                        Text("Ajouter une tâche...")
                            .font(.system(size: 12.5, weight: .medium))
                            .foregroundColor(Color(white: 0.65))

                        Spacer()

                        Image(systemName: "keyboard")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(Color(white: 0.45))
                    }
                    .padding(.horizontal, 11)
                    .padding(.vertical, 8)
                    .background(Color.white.opacity(0.08))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.white.opacity(0.14), lineWidth: 1)
                    )
                    .cornerRadius(12)
                }

                // Ligne 3 : Prochaine tâche sur la liste + bouton Play direct
                if let nextTitle = context.state.nextTaskTitle, let nextId = context.state.nextTaskId {
                    HStack(spacing: 8) {
                        VStack(alignment: .leading, spacing: 1) {
                            Text("PROCHAINE TÂCHE")
                                .font(.system(size: 9, weight: .heavy))
                                .foregroundColor(brandNeon.opacity(0.85))

                            Text(nextTitle)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.white)
                                .lineLimit(1)
                        }

                        Spacer()

                        Button(intent: StartTaskIntent(taskId: nextId, taskTitle: nextTitle, category: context.state.nextTaskCategory ?? "myTrack")) {
                            HStack(spacing: 4) {
                                Image(systemName: "play.fill")
                                    .font(.system(size: 9.5, weight: .bold))
                                Text("Démarrer")
                                    .font(.system(size: 11.5, weight: .bold))
                            }
                            .foregroundColor(Color(red: 0.07, green: 0.07, blue: 0.08))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(brandNeon)
                            .clipShape(Capsule())
                            .shadow(color: brandNeon.opacity(0.25), radius: 3, x: 0, y: 1)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.white.opacity(0.04))
                    .cornerRadius(10)
                }
            }
            .padding(.horizontal, 15)
            .padding(.vertical, 13)
            .background(Color(red: 0.09, green: 0.10, blue: 0.13).opacity(0.96))
            .cornerRadius(20)
        } else {
            // ============================================================
            // MODE EN COURS (IN_PROGRESS) : Session active avec chronomètre
            // ============================================================
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top) {
                    HStack(spacing: 8) {
                        AppLogoView(size: 22)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(context.attributes.taskTitle)
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.white)
                                .lineLimit(1)

                            HStack(spacing: 5) {
                                Circle()
                                    .fill(accentColor)
                                    .frame(width: 6, height: 6)
                                Text(context.state.subtitle ?? (context.attributes.projectName ?? context.attributes.category ?? "En cours"))
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundColor(Color.white.opacity(0.8))
                                    .lineLimit(1)
                            }
                        }
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 6) {
                        if let total = context.state.totalFormattedDuration {
                            Text(total)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.gray)
                        }

                        Button(intent: StopLiveActivityIntent(taskId: context.attributes.taskId)) {
                            HStack(spacing: 5) {
                                Image(systemName: "square.fill")
                                    .font(.system(size: 10, weight: .bold))
                                Text("Arrêter")
                                    .font(.system(size: 13, weight: .bold))
                            }
                            .foregroundColor(Color(red: 0.07, green: 0.07, blue: 0.08))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 7)
                            .background(Color.white)
                            .clipShape(Capsule())
                            .shadow(color: Color.black.opacity(0.15), radius: 3, x: 0, y: 1)
                        }
                        .buttonStyle(.plain)
                    }
                }

                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.white.opacity(0.15))
                            .frame(height: 4)

                        Capsule()
                            .fill(accentColor)
                            .frame(
                                width: max(10, geo.size.width * CGFloat(min(1.0, max(0.05, context.state.progress)))),
                                height: 4
                            )
                    }
                }
                .frame(height: 4)

                HStack {
                    HStack(spacing: 4) {
                        Text("⏱")
                            .font(.system(size: 11))
                        Text(timerInterval: Date(timeIntervalSince1970: context.state.startedAtTimestamp)...Date(timeIntervalSinceNow: 86400), countsDown: false)
                            .font(.system(size: 13, weight: .semibold, design: .monospaced))
                            .monospacedDigit()
                    }
                    .foregroundColor(accentColor)

                    Spacer()
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(Color(red: 0.10, green: 0.11, blue: 0.14).opacity(0.95))
            .cornerRadius(20)
        }
    }
}

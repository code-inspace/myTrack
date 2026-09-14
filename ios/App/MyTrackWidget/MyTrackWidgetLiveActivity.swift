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

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TaskActivityAttributes.self) { context in
            // ==========================================
            // VUE ÉCRAN DE VERROUILLAGE (Lock Screen)
            // ==========================================
            LockScreenLiveActivityView(context: context, brandNeon: brandNeon)
                .activityBackgroundTint(Color.black.opacity(0.75))
                .activitySystemActionForegroundColor(brandNeon)

        } dynamicIsland: { context in
            // ==========================================
            // DYNAMIC ISLAND (Haut de l'écran)
            // ==========================================
            DynamicIsland {
                // Région étendue gauche (Appui long)
                DynamicIslandExpandedRegion(.leading) {
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

                // Région étendue droite (Appui long)
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

                // Région étendue bas (Appui long)
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
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

            } compactLeading: {
                // PILULE GAUCHE : Logo Officiel MyTrack Compact
                AppLogoView(size: 14)

            } compactTrailing: {
                // PILULE DROITE : Timer Compact Monospaced
                Text(timerInterval: Date(timeIntervalSince1970: context.state.startedAtTimestamp)...Date(timeIntervalSinceNow: 86400), countsDown: false)
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(.white)

            } minimal: {
                AppLogoView(size: 13)
            }
        }
    }
}

// MARK: - 3. Vue Écran de Verrouillage (Design 1:1)
struct LockScreenLiveActivityView: View {
    let context: ActivityViewContext<TaskActivityAttributes>
    let brandNeon: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                HStack(spacing: 8) {
                    AppLogoView(size: 22)
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
                        .fill(brandNeon)
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
                .foregroundColor(brandNeon)

                Spacer()
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Color(red: 0.10, green: 0.11, blue: 0.14).opacity(0.95))
        .cornerRadius(20)
    }
}

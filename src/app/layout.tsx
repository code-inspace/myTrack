import type { Metadata, Viewport } from "next";
import "./globals.css";
import QueryProvider from "@/providers/QueryProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import OneSignalProvider from "@/providers/OneSignalProvider";
import NotificationWatcherProvider from "@/providers/NotificationWatcherProvider";
import { BottomNav } from "@/components/shared/BottomNav";
import { DesktopSidebar } from "@/components/desktop/DesktopSidebar";
import { AuthGuard } from "@/components/shared/AuthGuard";
import { DisplayModeProvider } from "@/providers/DisplayModeProvider";
import { DateProvider } from "@/providers/DateProvider";
import { NightModeProvider } from "@/features/sleep/providers/NightModeProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://mytrack-nine.vercel.app"),
  title: "MyTrack — Mon suivi d'action & tracker d'habitudes personnalisé",
  description:
    "Mon suivi d'action et tracker d'habitudes personnalisé avec agenda intelligent pour structurer mes journées et atteindre mes objectifs au quotidien.",
  applicationName: "MyTrack",
  authors: [{ name: "MyTrack" }],
  generator: "Next.js",
  keywords: [
    "suivi d'action",
    "tracker d'habitudes",
    "agenda personnalisé",
    "gestion du temps",
    "productivité",
    "streak",
    "coach IA",
    "routine quotidienne",
  ],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MyTrack",
  },
  openGraph: {
    title: "MyTrack — Mon suivi d'action & tracker d'habitudes personnalisé",
    description:
      "Mon suivi d'action et tracker d'habitudes personnalisé pour structurer mes journées, booster ma discipline et suivre ma progression en temps réel.",
    url: "https://mytrack-nine.vercel.app",
    siteName: "MyTrack",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MyTrack — Mon suivi d'action & tracker d'habitudes personnalisé",
    description:
      "Mon suivi d'action et tracker d'habitudes personnalisé avec agenda intelligent pour structurer mes journées et atteindre mes objectifs.",
  },
};

export const viewport: Viewport = {
  themeColor: "#111214",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

import { OfflineProvider } from "@/providers/OfflineProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png" />
        <link rel="apple-touch-icon-precomposed" href="/apple-touch-icon-precomposed.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer></script>
      </head>
      <body className="bg-[#0E0F12] text-[#F3F4F6] min-h-screen antialiased flex flex-row items-stretch overflow-x-hidden">
        <QueryProvider>
          <AuthProvider>
            <OfflineProvider>
              <OneSignalProvider>
                <NotificationWatcherProvider>
                  <NightModeProvider>
                    <DisplayModeProvider>
                      <DateProvider>
                        <AuthGuard>
                          {/* Desktop Sticky Left Sidebar (hidden on mobile) */}
                          <DesktopSidebar />

                          {/* Main App Container: full width on mobile, flex-1 on desktop */}
                          <main className="flex-1 min-w-0 w-full max-w-md md:max-w-none h-screen max-h-screen flex flex-col safe-top relative overflow-hidden">
                            {children}
                          </main>

                          {/* Fixed Thumb-friendly Navigation on Mobile */}
                          <BottomNav />
                        </AuthGuard>
                      </DateProvider>
                    </DisplayModeProvider>
                  </NightModeProvider>
                </NotificationWatcherProvider>
              </OneSignalProvider>
            </OfflineProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

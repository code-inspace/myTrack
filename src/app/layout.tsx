import type { Metadata, Viewport } from "next";
import "./globals.css";
import QueryProvider from "@/providers/QueryProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import OneSignalProvider from "@/providers/OneSignalProvider";
import NotificationWatcherProvider from "@/providers/NotificationWatcherProvider";
import { BottomNav } from "@/components/shared/BottomNav";
import { AuthGuard } from "@/components/shared/AuthGuard";

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
    icon: "/icon.svg",
    apple: "/icons/icon-192.png",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-[#111214] text-[#F3F4F6] min-h-screen antialiased flex flex-col items-center">
        <QueryProvider>
          <AuthProvider>
            <OneSignalProvider>
              <NotificationWatcherProvider>
                <AuthGuard>
                  {/* Main App Container */}
                  <main className="w-full max-w-md h-screen max-h-screen flex flex-col safe-top relative overflow-hidden">
                    {children}
                  </main>

                  {/* Fixed Thumb-friendly Navigation */}
                  <BottomNav />
                </AuthGuard>
              </NotificationWatcherProvider>
            </OneSignalProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

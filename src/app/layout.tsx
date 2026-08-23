import type { Metadata, Viewport } from "next";
import "./globals.css";
import QueryProvider from "@/providers/QueryProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import OneSignalProvider from "@/providers/OneSignalProvider";
import { BottomNav } from "@/components/shared/BottomNav";
import { AuthGuard } from "@/components/shared/AuthGuard";

export const metadata: Metadata = {
  metadataBase: new URL("https://mytrack-nine.vercel.app"),
  title: "MyTrack — Le tracker d'habitudes & agenda personnalisé",
  description:
    "Le tracker d'habitudes et agenda intelligent pour structurer tes journées, booster ta discipline et suivre tes objectifs en temps réel.",
  applicationName: "MyTrack",
  authors: [{ name: "MyTrack" }],
  generator: "Next.js",
  keywords: [
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
    title: "MyTrack — Le tracker d'habitudes & agenda personnalisé",
    description:
      "Structure tes journées, booste ta discipline et suis tes séries quotidiennes avec un calendrier interactif et un coach IA.",
    url: "https://mytrack-nine.vercel.app",
    siteName: "MyTrack",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MyTrack — Le tracker d'habitudes & agenda personnalisé",
    description:
      "Le tracker d'habitudes et agenda intelligent pour structurer tes journées et atteindre tes objectifs.",
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
              <AuthGuard>
                {/* Main App Container */}
                <main className="w-full max-w-md min-h-screen flex flex-col px-4 safe-top safe-bottom-nav relative">
                  {children}
                </main>

                {/* Fixed Thumb-friendly Navigation */}
                <BottomNav />
              </AuthGuard>
            </OneSignalProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

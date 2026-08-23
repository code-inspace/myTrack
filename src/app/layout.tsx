import type { Metadata, Viewport } from "next";
import "./globals.css";
import QueryProvider from "@/providers/QueryProvider";
import OneSignalProvider from "@/providers/OneSignalProvider";
import { BottomNav } from "@/components/shared/BottomNav";
import { DynamicIsland } from "@/components/shared/DynamicIsland";

export const metadata: Metadata = {
  title: "MyTrack — Elite Habit & Performance Tracking",
  description: "Production-ready PWA for tracking habits, tasks, momentum, and AI coaching.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MyTrack",
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
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-[#111214] text-[#F3F4F6] min-h-screen antialiased flex flex-col items-center">
        <QueryProvider>
          <OneSignalProvider>
            {/* Dynamic Island Floating Notification Pill */}
            <DynamicIsland />

            {/* Main App Container */}
            <main className="w-full max-w-md min-h-screen flex flex-col px-4 safe-top safe-bottom-nav relative">
              {children}
            </main>

            {/* Fixed Thumb-friendly Navigation */}
            <BottomNav />
          </OneSignalProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { Logo } from "@/components/shared/Logo";
import LoginPage from "@/app/auth/login/page";

const PUBLIC_AUTH_PATHS = [
  "/auth/login",
  "/auth/signup",
  "/auth/verify-email",
  "/auth/callback",
];

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPath = PUBLIC_AUTH_PATHS.some((path) => pathname.startsWith(path));

  useEffect(() => {
    if (isLoading) return;

    if (!user && !isAuthPath) {
      router.replace("/auth/login");
    } else if (user && isAuthPath && pathname !== "/auth/verify-email") {
      router.replace("/tasks");
    }
  }, [user, isLoading, pathname, isAuthPath, router]);

  // If session is loading or if user is unauthenticated and being redirected, display clean splash
  if (isLoading || (!user && !isAuthPath) || (user && isAuthPath && pathname !== "/auth/verify-email")) {
    return (
      <div className="flex-1 min-w-0 w-full h-full min-h-full flex flex-col items-center justify-center bg-[#0E0F12] space-y-4 select-none">
        <div className="animate-pulse">
          <Logo size="lg" showText={false} />
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-base font-extrabold text-white tracking-tight">
            My<span className="text-[#D4F63D]">Track</span>
          </p>
          <div className="flex items-center justify-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#D4F63D] animate-bounce"
              style={{ animationDuration: "1s", animationDelay: "0ms" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#D4F63D] animate-bounce"
              style={{ animationDuration: "1s", animationDelay: "150ms" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#D4F63D] animate-bounce"
              style={{ animationDuration: "1s", animationDelay: "300ms" }}
            />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

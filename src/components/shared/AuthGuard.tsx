"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { Logo } from "@/components/shared/Logo";

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

    // 1. Unauthenticated user trying to access protected routes -> redirect to login
    if (!user && !isAuthPath) {
      router.replace("/auth/login");
      return;
    }

    // 2. Unconfirmed email trying to access protected routes -> redirect to verify email
    if (user && !user.emailConfirmed && !user.isDemo && !isAuthPath) {
      router.replace(`/auth/verify-email?email=${encodeURIComponent(user.email)}`);
      return;
    }

    // 3. Authenticated & confirmed user trying to access login/signup -> redirect to tasks
    if (user && user.emailConfirmed && isAuthPath && pathname !== "/auth/verify-email") {
      router.replace("/tasks");
    }
  }, [user, isLoading, pathname, isAuthPath, router]);

  // Loading state
  if (isLoading && !isAuthPath) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="animate-pulse">
          <Logo size="lg" showText={false} />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-bold text-white tracking-tight">My<span className="text-[#D4F63D]">Track</span></p>
          <p className="text-xs text-[#8E929E] font-medium">Chargement de ta session...</p>
        </div>
      </div>
    );
  }

  // Block rendering protected routes for unauthenticated users before redirect
  if (!user && !isAuthPath) {
    return null;
  }

  return <>{children}</>;
};

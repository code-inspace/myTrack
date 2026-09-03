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

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="animate-pulse">
          <Logo size="lg" showText={false} />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-bold text-white tracking-tight">My<span className="text-[#D4F63D]">Track</span></p>
          <p className="text-xs text-[#8E929E] font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user && !isAuthPath) {
    return <LoginPage />;
  }

  return <>{children}</>;
};

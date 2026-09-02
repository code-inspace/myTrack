"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { UserSession } from "@/features/auth/types";
import {
  mapSupabaseUserToSession,
  loginWithCredentials,
  signupWithCredentials,
  logoutUser,
  getStoredUserSession,
  setStoredUserSession,
  DEMO_USER,
} from "@/features/auth/actions";
import { createClient } from "@/utils/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

import { loginOneSignalUser, logoutOneSignalUser } from "@/lib/onesignal/client";

interface AuthContextType {
  user: UserSession | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; requiresConfirmation?: boolean; error?: string }>;
  signup: (email: string, pass: string, name?: string) => Promise<{ success: boolean; requiresConfirmation?: boolean; error?: string }>;
  logout: () => void;
  switchToDemo: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(() => getStoredUserSession());
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    // 0. Purge legacy demo keys from localStorage so fake tasks never pollute real sessions
    if (typeof window !== "undefined") {
      const demoKeys = [
        "mytrack_tasks_00000000-0000-0000-0000-000000000001",
        "mytrack_tasks_v1_00000000-0000-0000-0000-000000000001",
        "mytrack_completions_00000000-0000-0000-0000-000000000001",
        "mytrack_completions_v1_00000000-0000-0000-0000-000000000001",
        "mytrack_projects_00000000-0000-0000-0000-000000000001",
        "mytrack_tasks_v1",
        "mytrack_tasks",
        "mytrack_completions_v1",
        "mytrack_completions",
      ];
      for (const k of demoKeys) {
        try {
          localStorage.removeItem(k);
        } catch {}
      }
    }

    const supabase = createClient();

    // 1. Check initial active Supabase Auth session
    supabase.auth.getSession().then((res: any) => {
      const session = res.data?.session;
      if (session?.user) {
        const mapped = mapSupabaseUserToSession(session.user);
        setUser(mapped);
        setStoredUserSession(mapped);
        loginOneSignalUser(mapped.id);
      } else {
        const stored = getStoredUserSession();
        if (!stored) {
          setUser(null);
        }
      }
      setIsLoading(false);
    });

    // 2. Real-time auth listener from Supabase
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (session?.user) {
        const mapped = mapSupabaseUserToSession(session.user);
        setUser(mapped);
        setStoredUserSession(mapped);
        loginOneSignalUser(mapped.id);
      } else {
        setUser(null);
        setStoredUserSession(null);
        logoutOneSignalUser();
      }
      queryClient.invalidateQueries();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    const res = await loginWithCredentials(email, pass);
    setIsLoading(false);
    if (res.success && res.user) {
      setUser(res.user);
      queryClient.invalidateQueries();
      return { success: true };
    }
    return {
      success: false,
      requiresConfirmation: res.requiresConfirmation,
      error: res.error || "Identifiants invalides",
    };
  };

  const signup = async (email: string, pass: string, name?: string) => {
    setIsLoading(true);
    const res = await signupWithCredentials(email, pass, name);
    setIsLoading(false);
    if (res.success && res.user) {
      if (res.requiresConfirmation) {
        return { success: true, requiresConfirmation: true };
      }
      setUser(res.user);
      queryClient.invalidateQueries();
      return { success: true, requiresConfirmation: false };
    }
    return { success: false, error: res.error || "Erreur d'inscription" };
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
    queryClient.invalidateQueries();
  };

  const switchToDemo = async () => {
    await loginWithCredentials("demo@de.mo", "demo");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        signup,
        logout,
        switchToDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

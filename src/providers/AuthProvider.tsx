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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(() => getStoredUserSession());
  const [isLoading, setIsLoading] = useState<boolean>(() => (typeof window !== "undefined" ? !getStoredUserSession() : true));
  const queryClient = useQueryClient();

  useEffect(() => {
    // 0. Purge legacy demo keys and demo items from all localStorage keys so fake tasks never pollute real sessions
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

      // Also scrub any demo-task- / demo-project- / demo-nap- / 00000000- items from any active user keys
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key &&
            (key.startsWith("mytrack_tasks") ||
              key.startsWith("mytrack_completions") ||
              key.startsWith("mytrack_projects"))
          ) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                const filtered = parsed.filter((item: any) => {
                  const id = String(item?.id || "");
                  const taskId = String(item?.taskId || "");
                  return (
                    !id.startsWith("demo-") &&
                    !id.startsWith("00000000-") &&
                    !taskId.startsWith("demo-") &&
                    !taskId.startsWith("00000000-")
                  );
                });
                localStorage.setItem(key, JSON.stringify(filtered));
              }
            }
          }
        }
      } catch {}
    }

    const supabase = createClient();

    // 1. Check initial active Supabase Auth session with safety timeout
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 800);

    supabase.auth
      .getSession()
      .then((res: any) => {
        clearTimeout(timeout);
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
      })
      .catch(() => {
        clearTimeout(timeout);
        setIsLoading(false);
      });

    // 2. Real-time auth listener from Supabase
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string, session: any) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setStoredUserSession(null);
        logoutOneSignalUser();
        queryClient.invalidateQueries();
        return;
      }

      if (session?.user) {
        const mapped = mapSupabaseUserToSession(session.user);
        setUser(mapped);
        setStoredUserSession(mapped);
        loginOneSignalUser(mapped.id);
        queryClient.invalidateQueries();
      }
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        signup,
        logout,
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

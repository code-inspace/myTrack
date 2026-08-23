"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { UserSession } from "@/features/auth/types";
import {
  getStoredUserSession,
  setStoredUserSession,
  loginWithCredentials,
  signupWithCredentials,
  logoutUser,
  DEMO_USER,
} from "@/features/auth/actions";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
  user: UserSession | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, pass: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchToDemo: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const session = getStoredUserSession();
    setUser(session);
    setIsLoading(false);
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await loginWithCredentials(email, pass);
    if (res.success && res.user) {
      setUser(res.user);
      queryClient.invalidateQueries();
      return { success: true };
    }
    return { success: false, error: res.error || "Identifiants invalides" };
  };

  const signup = async (email: string, pass: string, name?: string) => {
    const res = await signupWithCredentials(email, pass, name);
    if (res.success && res.user) {
      setUser(res.user);
      queryClient.invalidateQueries();
      return { success: true };
    }
    return { success: false, error: res.error || "Erreur d'inscription" };
  };

  const logout = () => {
    logoutUser();
    setUser(null);
    queryClient.invalidateQueries();
  };

  const switchToDemo = () => {
    setStoredUserSession(DEMO_USER);
    setUser(DEMO_USER);
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

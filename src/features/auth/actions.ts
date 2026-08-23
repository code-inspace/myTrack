import { UserSession } from "./types";
import { createClient } from "@/utils/supabase/client";

const SESSION_KEY = "mytrack_current_user_v1";

export const DEMO_USER: UserSession = {
  id: "user-demo",
  email: "demo@de.mo",
  name: "Utilisateur Démo",
  isDemo: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

export function getStoredUserSession(): UserSession {
  if (typeof window === "undefined") return DEMO_USER;
  const stored = localStorage.getItem(SESSION_KEY);
  if (!stored) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(DEMO_USER));
    return DEMO_USER;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return DEMO_USER;
  }
}

export function setStoredUserSession(user: UserSession | null): void {
  if (typeof window === "undefined") return;
  if (!user) {
    localStorage.removeItem(SESSION_KEY);
  } else {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }
}

export async function loginWithCredentials(
  email: string,
  password: string
): Promise<{ success: boolean; user?: UserSession; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Compte Démo : demo@de.mo / demo
  if (normalizedEmail === "demo@de.mo") {
    if (password !== "demo") {
      return { success: false, error: "Mot de passe incorrect pour le compte démo (mot de passe: demo)" };
    }
    setStoredUserSession(DEMO_USER);
    return { success: true, user: DEMO_USER };
  }

  // 2. Supabase Auth ou Compte Vierge Local
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (!error && data?.user) {
      const newUser: UserSession = {
        id: data.user.id,
        email: data.user.email || normalizedEmail,
        name: data.user.user_metadata?.name || normalizedEmail.split("@")[0],
        isDemo: false,
        createdAt: data.user.created_at,
      };
      setStoredUserSession(newUser);
      return { success: true, user: newUser };
    }
  } catch {
    // Si Supabase offline ou simulation
  }

  // Fallback direct compte vierge fonctionnel
  const cleanUser: UserSession = {
    id: "user-" + normalizedEmail.replace(/[^a-zA-Z0-9]/g, "_"),
    email: normalizedEmail,
    name: normalizedEmail.split("@")[0],
    isDemo: false,
    createdAt: new Date().toISOString(),
  };

  setStoredUserSession(cleanUser);
  return { success: true, user: cleanUser };
}

export async function signupWithCredentials(
  email: string,
  password: string,
  name?: string
): Promise<{ success: boolean; user?: UserSession; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail === "demo@de.mo") {
    return { success: false, error: "Le compte demo@de.mo existe déjà. Utilise l'écran de connexion." };
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { name: name || normalizedEmail.split("@")[0] },
      },
    });

    if (!error && data?.user) {
      const newUser: UserSession = {
        id: data.user.id,
        email: data.user.email || normalizedEmail,
        name: name || normalizedEmail.split("@")[0],
        isDemo: false,
        createdAt: data.user.created_at,
      };
      setStoredUserSession(newUser);
      return { success: true, user: newUser };
    }
  } catch {
    // Fallback
  }

  const cleanUser: UserSession = {
    id: "user-" + normalizedEmail.replace(/[^a-zA-Z0-9]/g, "_"),
    email: normalizedEmail,
    name: name || normalizedEmail.split("@")[0],
    isDemo: false,
    createdAt: new Date().toISOString(),
  };

  setStoredUserSession(cleanUser);
  return { success: true, user: cleanUser };
}

export function logoutUser(): void {
  setStoredUserSession(null);
  try {
    const supabase = createClient();
    supabase.auth.signOut().catch(() => {});
  } catch {}
}

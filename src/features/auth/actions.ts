import { UserSession } from "./types";
import { createClient } from "@/utils/supabase/client";

export const DEMO_USER: UserSession = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "demo@de.mo",
  name: "Axel (Démo)",
  isDemo: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

export function mapSupabaseUserToSession(sbUser: any): UserSession {
  const email = sbUser.email || "";
  const isDemo = email.toLowerCase() === "demo@de.mo" || sbUser.id === DEMO_USER.id;

  return {
    id: sbUser.id,
    email: email,
    name: sbUser.user_metadata?.name || email.split("@")[0] || "Utilisateur",
    avatarUrl: sbUser.user_metadata?.avatar_url || null,
    isDemo,
    createdAt: sbUser.created_at || new Date().toISOString(),
  };
}

export async function getActiveSession(): Promise<UserSession | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getSession();
    if (!error && data?.session?.user) {
      return mapSupabaseUserToSession(data.session.user);
    }
  } catch (err) {
    console.warn("Supabase getSession error:", err);
  }
  return null;
}

export function getStoredUserSession(): UserSession {
  if (typeof window === "undefined") return DEMO_USER;
  const stored = localStorage.getItem("mytrack_current_user_v1");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {}
  }
  return DEMO_USER;
}

export function setStoredUserSession(user: UserSession | null): void {
  if (typeof window === "undefined") return;
  if (!user) {
    localStorage.removeItem("mytrack_current_user_v1");
  } else {
    localStorage.setItem("mytrack_current_user_v1", JSON.stringify(user));
  }
}

export async function loginWithCredentials(
  email: string,
  password: string
): Promise<{ success: boolean; user?: UserSession; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: password.trim(),
    });

    if (error) {
      // Message d'erreur convivial en français
      if (error.message.includes("Invalid login credentials")) {
        return {
          success: false,
          error: normalizedEmail === "demo@de.mo"
            ? "Identifiants démo incorrects (mot de passe: demo)"
            : "Email ou mot de passe incorrect.",
        };
      }
      return { success: false, error: error.message };
    }

    if (data?.user) {
      const userSession = mapSupabaseUserToSession(data.user);
      setStoredUserSession(userSession);
      return { success: true, user: userSession };
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de connexion au serveur Supabase" };
  }

  return { success: false, error: "Impossible de créer la session" };
}

export async function signupWithCredentials(
  email: string,
  password: string,
  name?: string
): Promise<{ success: boolean; user?: UserSession; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: password.trim(),
      options: {
        data: {
          name: name?.trim() || normalizedEmail.split("@")[0],
        },
      },
    });

    if (error) {
      if (error.message.includes("User already registered")) {
        return { success: false, error: "Cette adresse email est déjà enregistrée. Connecte-toi." };
      }
      if (error.message.includes("Password should be")) {
        return { success: false, error: "Le mot de passe doit comporter au moins 6 caractères." };
      }
      return { success: false, error: error.message };
    }

    if (data?.user) {
      const userSession = mapSupabaseUserToSession(data.user);
      setStoredUserSession(userSession);
      return { success: true, user: userSession };
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur d'inscription Supabase" };
  }

  return { success: false, error: "Échec de l'inscription" };
}

export async function logoutUser(): Promise<void> {
  setStoredUserSession(null);
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("Supabase signOut error:", err);
  }
}

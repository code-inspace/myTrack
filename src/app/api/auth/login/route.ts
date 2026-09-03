import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bvdyjpxngcdindqhprmc.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZHlqcHhuZ2NkaW5kcWhwcm1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MzY2MDMsImV4cCI6MjEwMzAxMjYwM30.r94z98Yd5uQ89t-v_Z73yQxJ0M9T6oJ83iN5kQyW6qA";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email et mot de passe requis." }, { status: 400 });
    }

    const supabase = createSupabaseClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: password.trim(),
    });

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        return NextResponse.json({ error: "Email ou mot de passe incorrect." }, { status: 401 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    const user = data.user;
    const emailConfirmed = Boolean(user.email_confirmed_at || user.confirmed_at || user.id);

    const userSession = {
      id: user.id,
      email: user.email || "",
      name: user.user_metadata?.name || user.email?.split("@")[0] || "Utilisateur",
      avatarUrl: user.user_metadata?.avatar_url || null,
      emailConfirmed,
      createdAt: user.created_at || new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      user: userSession,
      session: data.session,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erreur serveur" }, { status: 500 });
  }
}

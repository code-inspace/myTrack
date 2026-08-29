"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { LogIn, Sparkles, UserPlus, ShieldCheck, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/shared/Logo";

export default function LoginPage() {
  const router = useRouter();
  const { login, switchToDemo } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const res = await login(email, password);
    setIsLoading(false);

    if (res.success) {
      router.push("/tasks");
    } else if (res.requiresConfirmation) {
      router.push(`/auth/verify-email?email=${encodeURIComponent(email.trim())}`);
    } else {
      setError(res.error || "Erreur de connexion");
    }
  };

  const handleQuickDemo = async () => {
    switchToDemo();
    router.push("/tasks");
  };

  return (
    <div className="flex-1 flex flex-col justify-center py-10 px-4 max-w-md mx-auto w-full space-y-6">
      {/* App Branding */}
      <div className="text-center space-y-2 flex flex-col items-center">
        <Logo size="xl" showText={false} />
        <h1 className="text-2xl font-black text-white tracking-tight pt-1">
          My<span className="text-[#D4F63D]">Track</span>
        </h1>
        <p className="text-xs text-[#8E929E] max-w-xs mx-auto">
          Mon suivi d'action & tracker d'habitudes personnalisé
        </p>
      </div>

      {/* Quick Demo Account Card */}
      <div className="bg-[#1C1D22] border-2 border-[#D4F63D]/30 rounded-3xl p-5 shadow-lg space-y-3 lime-glow-sm">
        <div className="flex items-center gap-2 text-[#D4F63D]">
          <Sparkles className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Compte de démonstration</span>
        </div>

        <p className="text-xs text-[#D1D5DB]">
          Accède aux données de démonstration complètes (habitudes, graphiques, streak actif) :
        </p>

        <div className="bg-[#252830] p-2.5 rounded-xl text-xs font-mono text-[#9CA3AF] flex justify-between items-center">
          <span>demo@de.mo</span>
          <span className="text-[#D4F63D]">mdp: demo</span>
        </div>

        <button
          onClick={handleQuickDemo}
          className="w-full py-3 rounded-2xl bg-[#D4F63D] hover:bg-[#c2e432] active:scale-98 text-black font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Accéder au compte Démo (demo@de.mo)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Regular / Clean Account Login Form */}
      <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-white">
          Se connecter à un compte
        </h2>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#8E929E] uppercase tracking-wider mb-1">
              Email
            </label>
            <input
              type="email"
              required
              placeholder="ex: toi@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-[#252830] border border-[#343740] text-white text-sm focus:border-[#D4F63D] outline-none placeholder-[#6B7280]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8E929E] uppercase tracking-wider mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-[#252830] border border-[#343740] text-white text-sm focus:border-[#D4F63D] outline-none placeholder-[#6B7280]"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-2xl bg-[#252830] hover:bg-[#343740] active:scale-98 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#3a3e4c]"
          >
            <LogIn className="w-4 h-4" />
            <span>{isLoading ? "Connexion..." : "Se connecter"}</span>
          </button>
        </form>

        <div className="pt-3 border-t border-[#282A30] text-center">
          <Link
            href="/auth/signup"
            className="text-xs text-[#8E929E] hover:text-[#D4F63D] font-semibold transition-colors inline-flex items-center gap-1"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Créer un nouveau compte vierge</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

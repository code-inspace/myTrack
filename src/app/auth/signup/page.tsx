"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { UserPlus, ArrowLeft, LogIn } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const res = await signup(email, password, name);
    setIsLoading(false);

    if (res.success) {
      if (res.requiresConfirmation) {
        router.push(`/auth/verify-email?email=${encodeURIComponent(email.trim())}`);
      } else {
        router.push("/tasks");
      }
    } else {
      setError(res.error || "Erreur d'inscription");
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center py-10 px-2 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-3xl bg-[#D4F63D] text-black font-extrabold text-2xl flex items-center justify-center mx-auto shadow-xl lime-glow-sm">
          M
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          Nouveau Compte
        </h1>
        <p className="text-xs text-[#8E929E]">
          Démarre avec un compte 100% vierge et personnalise tes objectifs
        </p>
      </div>

      <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-6 shadow-sm space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#8E929E] uppercase tracking-wider mb-1">
              Prénom / Pseudo
            </label>
            <input
              type="text"
              required
              placeholder="ex: Axel"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-[#252830] border border-[#343740] text-white text-sm focus:border-[#D4F63D] outline-none placeholder-[#6B7280]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8E929E] uppercase tracking-wider mb-1">
              Email
            </label>
            <input
              type="email"
              required
              placeholder="ex: axel@exemple.com"
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
            className="w-full py-3.5 rounded-2xl bg-[#D4F63D] hover:bg-[#c2e432] active:scale-98 text-black font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            <UserPlus className="w-4 h-4 stroke-[3]" />
            <span>{isLoading ? "Création du compte..." : "Créer mon compte vierge"}</span>
          </button>
        </form>

        <div className="pt-3 border-t border-[#282A30] text-center">
          <Link
            href="/auth/login"
            className="text-xs text-[#8E929E] hover:text-white font-semibold transition-colors inline-flex items-center gap-1"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Déjà un compte ? Se connecter</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

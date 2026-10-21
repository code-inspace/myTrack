"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Mail, RotateCcw, LogIn } from "lucide-react";
import { resendConfirmationEmail } from "@/features/auth/actions";
import Link from "next/link";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") || "";

  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const handleResend = async () => {
    if (!email || isResending) return;
    setIsResending(true);
    setResendStatus(null);

    const res = await resendConfirmationEmail(email);
    setIsResending(false);

    if (res.success) {
      setResendStatus("Un nouvel email de confirmation vient de t'être envoyé !");
    } else {
      setResendStatus(res.error || "Erreur lors du renvoi du lien.");
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center py-10 px-4 max-w-md mx-auto w-full space-y-6">
      {/* Brand Icon */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-3xl bg-[#D4F63D]/15 border border-[#D4F63D]/40 text-[#D4F63D] flex items-center justify-center mx-auto shadow-xl lime-glow-sm">
          <Mail className="w-8 h-8 stroke-[2.5]" />
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          Vérifie tes emails
        </h1>
        <p className="text-xs text-[#8E929E] max-w-xs mx-auto">
          Pour sécuriser ton compte et accéder à ton tableau de bord MyTrack, confirme ton adresse email.
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-6 shadow-sm space-y-4 text-center">
        <div className="p-3.5 rounded-2xl bg-[#252830] border border-[#343740] text-xs font-mono text-white break-all">
          {email || "Ton adresse email"}
        </div>

        <p className="text-xs text-[#D1D5DB] leading-relaxed">
          Nous venons d'envoyer un lien de confirmation à cette adresse. Ouvre l'email et clique sur le lien pour valider ton compte.
        </p>

        {resendStatus && (
          <div className="p-3 rounded-xl bg-[#D4F63D]/15 border border-[#D4F63D]/30 text-[#D4F63D] text-xs font-semibold">
            {resendStatus}
          </div>
        )}

        <div className="pt-2 space-y-2.5">
          <button
            onClick={handleResend}
            disabled={isResending || !email}
            className="w-full py-3 rounded-2xl bg-[#252830] hover:bg-[#343740] active:scale-98 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#3a3e4c]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isResending ? "Envoi en cours..." : "Renvoyer l'email de confirmation"}</span>
          </button>

          <Link
            href="/auth/login"
            className="w-full py-3 rounded-2xl bg-[#D4F63D] hover:bg-[#c2e432] active:scale-98 text-black font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>J'ai confirmé, me connecter</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-white">Chargement...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}

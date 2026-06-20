"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LoginFormProps = {
  nextPath: string;
  initialStep?: "signin" | "reset";
}

function mapRecoveryError(rawError: string) {
  const normalized = rawError.toLowerCase();

  if (normalized.includes("expired") || normalized.includes("invalid") || normalized.includes("otp")) {
    return "Lien de réinitialisation invalide ou expiré. Merci de refaire une demande.";
  }

  if (normalized.includes("code verifier") || normalized.includes("code_verifier")) {
    return "Ce lien doit être ouvert dans le même navigateur que la demande de réinitialisation.";
  }

  if (normalized.includes("incomplet")) {
    if (normalized.includes("invitation")) {
      return "Lien d'invitation incomplet. Merci de demander une nouvelle invitation.";
    }
    return "Lien de réinitialisation incomplet. Merci de refaire une demande.";
  }

  return `Impossible de valider le lien de réinitialisation: ${rawError}`;
}

export function LoginForm({ nextPath, initialStep = "signin" }: LoginFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "reset">(initialStep);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialStep);
  }, [initialStep]);

  useEffect(() => {
    let isCancelled = false;

    async function initializeRecoveryFlow() {
      const currentUrl = new URL(window.location.href);
      const hashParams = new URLSearchParams(
        currentUrl.hash.startsWith("#") ? currentUrl.hash.slice(1) : currentUrl.hash
      );

      const searchType = currentUrl.searchParams.get("type");
      const hashType = hashParams.get("type");
      const tokenHash = currentUrl.searchParams.get("token_hash");
      const code = currentUrl.searchParams.get("code");
      const callbackError = currentUrl.searchParams.get("auth_error");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const searchOtpType = searchType === "recovery" || searchType === "invite" ? searchType : null;
      const hashOtpType = hashType === "recovery" || hashType === "invite" ? hashType : null;
      const otpType = searchOtpType ?? hashOtpType;

      const resetMessage =
        otpType === "invite"
          ? "Définis ton mot de passe pour activer ton compte."
          : "Définis ton nouveau mot de passe.";

      const cleanRecoveryUrl = () => {
        const clean = new URL(window.location.href);
        clean.searchParams.delete("token_hash");
        clean.searchParams.delete("type");
        clean.searchParams.delete("code");
        clean.hash = "";
        window.history.replaceState({}, "", `${clean.pathname}${clean.search}`);
      };

      if (tokenHash && searchOtpType) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: searchOtpType,
        });

        if (isCancelled) return;

        if (verifyError) {
          setError("Lien de réinitialisation invalide ou expiré. Merci de refaire une demande.");
          return;
        }

        setMode("reset");
        setMessage(resetMessage);
        cleanRecoveryUrl();
        return;
      }

      if (callbackError && currentUrl.searchParams.get("step") === "reset") {
        if (isCancelled) return;

        setMode("signin");
        setError(mapRecoveryError(callbackError));
        setMessage("Refais la procédure via \"Mot de passe oublié\".");

        const clean = new URL(window.location.href);
        clean.searchParams.delete("auth_error");
        clean.searchParams.delete("step");
        window.history.replaceState({}, "", `${clean.pathname}${clean.search}`);
        return;
      }

      if (accessToken && refreshToken && hashOtpType) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (isCancelled) return;

        if (sessionError) {
          setError("Lien de réinitialisation invalide ou expiré. Merci de refaire une demande.");
          return;
        }

        setMode("reset");
        setMessage(resetMessage);
        cleanRecoveryUrl();
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (isCancelled) return;

        if (exchangeError) {
          setError(mapRecoveryError(exchangeError.message));
          return;
        }

        if (searchOtpType) {
          setMode("reset");
          setMessage(resetMessage);
          cleanRecoveryUrl();
        }
      }
    }

    void initializeRecoveryFlow();

    return () => {
      isCancelled = true;
    };
  }, [nextPath, router, supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (mode === "reset") {
      if (password.length < 6) {
        setError("Le mot de passe doit contenir au moins 6 caractères.");
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError("Les deux mots de passe ne correspondent pas.");
        setLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Session de réinitialisation expirée. Recommence via \"Mot de passe oublié\".");
        setLoading(false);
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("Session de réinitialisation invalide. Recommence via \"Mot de passe oublié\".");
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        const rawError = updateError.message.toLowerCase();

        if (rawError.includes("auth session missing") || rawError.includes("invalid jwt")) {
          setError("Session de réinitialisation expirée. Recommence via \"Mot de passe oublié\".");
        } else if (rawError.includes("same") && rawError.includes("password")) {
          setError("Le nouveau mot de passe doit être différent de l'ancien.");
        } else {
          setError(`Impossible de mettre à jour le mot de passe: ${updateError.message}`);
        }
        setLoading(false);
        return;
      }

      await supabase.auth.signOut();
      setMode("signin");
      setPassword("");
      setConfirmPassword("");
      setMessage("Mot de passe mis à jour. Connecte-toi avec ton nouveau mot de passe.");
      setLoading(false);
      return;
    }

    if (mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      router.replace(nextPath);
      setLoading(false);
      return;
    }
  }

  async function handleForgotPassword() {
    setError(null);
    setMessage(null);

    if (!email.trim()) {
      setError("Renseigne ton email puis clique sur " + '"Mot de passe oublié"' + ".");
      return;
    }

    const redirectUrl = new URL("/login", window.location.origin);
    redirectUrl.searchParams.set("step", "reset");

    const redirectTo = redirectUrl.toString();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    if (resetError) {
      const errorMessage = resetError.message.toLowerCase();
      if (errorMessage.includes("redirect") || errorMessage.includes("allowed")) {
        setError(
          "Impossible d'envoyer l'email: URL de redirection non autorisée. Ajoute " +
            `${window.location.origin}/login` +
            " dans Supabase > Authentication > URL Configuration > Redirect URLs."
        );
      } else {
        setError(`Impossible d'envoyer l'email de réinitialisation: ${resetError.message}`);
      }
      return;
    }

    setMessage("Email de réinitialisation envoyé. Vérifie ta boîte mail.");
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <div className="premium-card p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/maalka_logo.png"
            alt="Maalka"
            width={220}
            height={95}
            className="h-20 w-auto"
            priority
          />
          <h1 className="mt-5 text-3xl font-light tracking-wide text-[var(--foreground)]">Bienvenue</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Gestion élégante de location de robes de mariée</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "signin" ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--muted)]" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="premium-input w-full"
              />
            </div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--muted)]" htmlFor="password">
              {mode === "reset" ? "Nouveau mot de passe" : "Mot de passe"}
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="premium-input w-full"
            />
          </div>

          {mode === "reset" ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--muted)]" htmlFor="confirm-password">
                Confirmer le mot de passe
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="premium-input w-full"
              />
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="premium-btn w-full px-4 py-2.5 text-sm disabled:opacity-60"
          >
            {loading
              ? "Chargement..."
              : mode === "reset"
                ? "Enregistrer le nouveau mot de passe"
                : "Se connecter"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          {mode === "signin" ? (
            <>
              <button
                type="button"
                className="text-[var(--muted)] underline underline-offset-4"
                onClick={handleForgotPassword}
              >
                Mot de passe oublié
              </button>
            </>
          ) : null}

          {mode === "reset" ? (
            <button
              type="button"
              className="text-[var(--muted)] underline underline-offset-4"
              onClick={() => {
                setMode("signin");
                setPassword("");
                setConfirmPassword("");
                setError(null);
                setMessage(null);
              }}
            >
              Retour à la connexion
            </button>
          ) : null}
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
      </div>
    </main>
  );
}

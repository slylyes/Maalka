"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LoginFormProps = {
  nextPath: string;
  initialStep?: "signin" | "otp" | "reset";
};

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function mapChallengeError(rawError: string | null | undefined) {
  const value = (rawError ?? "").toLowerCase();

  if (
    value.includes("too many") ||
    value.includes("rate") ||
    value.includes("security purposes") ||
    value.includes("frequency")
  ) {
    return "Trop de demandes de vérification. Merci de patienter quelques secondes puis réessayer.";
  }

  if (value.includes("unauthorized") || value.includes("forbidden")) {
    return "Session en cours d'initialisation. Réessaie dans quelques secondes.";
  }

  if (!rawError) {
    return "Impossible d'envoyer le lien de vérification pour le moment.";
  }

  return rawError;
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
  const [mode, setMode] = useState<"signin" | "otp" | "reset">(initialStep);
  const [loading, setLoading] = useState(false);
  const [sendingOtpLink, setSendingOtpLink] = useState(false);
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
      const reason = currentUrl.searchParams.get("reason");
      const state = currentUrl.searchParams.get("state");
      const hashType = hashParams.get("type");
      const tokenHash = currentUrl.searchParams.get("token_hash");
      const token = currentUrl.searchParams.get("token") ?? hashParams.get("token");
      const emailParam = currentUrl.searchParams.get("email") ?? hashParams.get("email");
      const code = currentUrl.searchParams.get("code");
      const callbackError = currentUrl.searchParams.get("auth_error");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const searchOtpType = searchType === "recovery" || searchType === "invite" ? searchType : null;
      const hashOtpType = hashType === "recovery" || hashType === "invite" ? hashType : null;
      const searchMagicType = searchType === "magiclink" || searchType === "email" ? searchType : null;
      const hashMagicType = hashType === "magiclink" || hashType === "email" ? hashType : null;
      const magicType = searchMagicType ?? hashMagicType ?? (reason === "2fa" ? "magiclink" : null);
      const magicTypeValue =
        magicType === "email" ? "email" : magicType === "magiclink" ? "magiclink" : null;
      const isTwoFactorReturn = reason === "2fa" || Boolean(searchMagicType) || Boolean(hashMagicType);
      const otpType = searchOtpType ?? hashOtpType;
      const isTwoFactorMagicLink = hashType === "magiclink" || hashType === "email";
      const isTwoFactorCode =
        Boolean(code) && (reason === "2fa" || searchType === "magiclink" || searchType === "email");

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

      if (isTwoFactorReturn) {
        if (state) {
          const verifyResponse = await fetch("/api/auth/2fa/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ state }),
          });
          const verifyJson = await verifyResponse.json().catch(() => ({}));

          if (isCancelled) return;

          if (!verifyResponse.ok) {
            setMode("otp");
            setError(
              verifyJson.error ||
                "Impossible de finaliser la vérification. Reconnecte-toi puis demande un nouveau lien."
            );
            return;
          }

          const clean = new URL(window.location.href);
          clean.searchParams.delete("code");
          clean.searchParams.delete("token");
          clean.searchParams.delete("token_hash");
          clean.searchParams.delete("type");
          clean.searchParams.delete("reason");
          clean.searchParams.delete("state");
          clean.hash = "";
          window.history.replaceState({}, "", `${clean.pathname}${clean.search}`);
          router.replace(nextPath);
          return;
        }

        let sessionError: { message: string } | null = null;
        let hasSession = false;

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          sessionError = error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          sessionError = error;
        } else if (tokenHash && magicTypeValue) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: magicTypeValue,
          });
          sessionError = error;
        } else if (token && emailParam) {
          const { error } = await supabase.auth.verifyOtp({
            token,
            email: emailParam,
            type: "email",
          });
          sessionError = error;
        }

        if (!code && !accessToken && !refreshToken && !tokenHash && !(token && emailParam)) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          hasSession = Boolean(session);
        }

        if (isCancelled) return;

        if (sessionError || (!code && !accessToken && !refreshToken && !tokenHash && !(token && emailParam) && !hasSession)) {
          setError("Lien de vérification invalide ou expiré. Reconnecte-toi pour recevoir un nouveau lien.");
          setMode("signin");
          return;
        }

        const verifyResponse = await fetch("/api/auth/2fa/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const verifyJson = await verifyResponse.json().catch(() => ({}));

        if (isCancelled) return;

        if (!verifyResponse.ok) {
          setMode("otp");
          setError(
            verifyJson.error ||
              "Impossible de finaliser la vérification. Reconnecte-toi puis demande un nouveau lien."
          );
          return;
        }

        const clean = new URL(window.location.href);
        clean.searchParams.delete("code");
        clean.searchParams.delete("token");
        clean.searchParams.delete("token_hash");
        clean.searchParams.delete("type");
        clean.searchParams.delete("reason");
        clean.searchParams.delete("state");
        clean.hash = "";
        window.history.replaceState({}, "", `${clean.pathname}${clean.search}`);
        router.replace(nextPath);
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

      if (isTwoFactorCode && code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (isCancelled) return;

        if (exchangeError) {
          setError("Lien de vérification invalide ou expiré. Reconnecte-toi pour recevoir un nouveau lien.");
          setMode("signin");
          return;
        }

        const verifyResponse = await fetch("/api/auth/2fa/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const verifyJson = await verifyResponse.json().catch(() => ({}));

        if (isCancelled) return;

        if (!verifyResponse.ok) {
          setMode("otp");
          setError(
            verifyJson.error ||
              "Impossible de finaliser la vérification. Reconnecte-toi puis demande un nouveau lien."
          );
          return;
        }

        const clean = new URL(window.location.href);
        clean.searchParams.delete("code");
        clean.searchParams.delete("reason");
        clean.searchParams.delete("type");
        clean.hash = "";
        window.history.replaceState({}, "", `${clean.pathname}${clean.search}`);
        router.replace(nextPath);
        return;
      }

      if (accessToken && refreshToken && isTwoFactorMagicLink) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (isCancelled) return;

        if (sessionError) {
          setError("Lien de vérification invalide ou expiré. Reconnecte-toi pour recevoir un nouveau lien.");
          setMode("signin");
          return;
        }

        const verifyResponse = await fetch("/api/auth/2fa/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const verifyJson = await verifyResponse.json().catch(() => ({}));

        if (isCancelled) return;

        if (!verifyResponse.ok) {
          setMode("otp");
          setError(
            verifyJson.error ||
              "Impossible de finaliser la vérification. Reconnecte-toi puis demande un nouveau lien."
          );
          return;
        }

        cleanRecoveryUrl();
        router.replace(nextPath);
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (isCancelled) return;

        if (!exchangeError && searchOtpType) {
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

    if (mode === "otp") {
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

      const {
        data: { session },
      } = await supabase.auth.getSession();

      let challengeError: string | null = null;
      let challengeSucceeded = false;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const challengeResponse = await fetch("/api/auth/2fa/challenge", {
          method: "POST",
          headers: session?.access_token
            ? {
                Authorization: `Bearer ${session.access_token}`,
              }
            : undefined,
        });
        const challengeJson = await challengeResponse.json().catch(() => ({}));

        if (challengeResponse.ok) {
          challengeSucceeded = true;
          break;
        }

        challengeError = mapChallengeError(challengeJson.error);

        if ((challengeResponse.status === 401 || challengeResponse.status === 403) && attempt < 2) {
          await wait(700 * (attempt + 1));
          continue;
        }

        if (challengeResponse.status === 429 && attempt < 2) {
          await wait(1200 * (attempt + 1));
          continue;
        }

        break;
      }

      if (!challengeSucceeded) {
        setMode("otp");
        setError(challengeError || "Impossible d'envoyer le lien de vérification.");
        setLoading(false);
        return;
      }

      setMode("otp");
      setMessage("Un lien de vérification a été envoyé par email. Clique sur ce lien pour accéder au dashboard.");
      setLoading(false);
      return;
    }
  }

  async function resendOtpMagicLink() {
    setSendingOtpLink(true);
    setError(null);
    setMessage(null);

    const challengeResponse = await fetch("/api/auth/2fa/challenge", {
      method: "POST",
    });
    const challengeJson = await challengeResponse.json().catch(() => ({}));

    if (!challengeResponse.ok) {
      setError(challengeJson.error || "Impossible d'envoyer le lien de vérification.");
      setSendingOtpLink(false);
      return;
    }

    setMessage("Nouveau lien envoyé. Vérifie ta boîte mail puis clique sur le lien.");
    setSendingOtpLink(false);
  }

  async function handleForgotPassword() {
    setError(null);
    setMessage(null);

    if (!email.trim()) {
      setError("Renseigne ton email puis clique sur " + '"Mot de passe oublié"' + ".");
      return;
    }

    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", "/login?step=reset");
    callbackUrl.searchParams.set("reason", "recovery");

    const redirectTo = callbackUrl.toString();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    if (resetError) {
      const errorMessage = resetError.message.toLowerCase();
      if (errorMessage.includes("redirect") || errorMessage.includes("allowed")) {
        setError(
          "Impossible d'envoyer l'email: URL de redirection non autorisée. Ajoute " +
            `${window.location.origin}/auth/callback` +
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

          {mode === "otp" ? (
            <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--muted)]">
              Un lien de vérification a été envoyé par email. Clique sur ce lien pour finaliser la connexion.
            </div>
          ) : null}

          {mode !== "otp" ? (
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
          ) : null}

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

          {mode !== "otp" ? (
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
          ) : (
            <button
              type="button"
              onClick={resendOtpMagicLink}
              disabled={sendingOtpLink}
              className="premium-btn w-full px-4 py-2.5 text-sm disabled:opacity-60"
            >
              {sendingOtpLink ? "Envoi..." : "Renvoyer le lien"}
            </button>
          )}
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

          {mode === "otp" ? (
            <button
              type="button"
              className="text-[var(--muted)] underline underline-offset-4"
              onClick={async () => {
                await supabase.auth.signOut();
                setMode("signin");
                setError(null);
                setMessage(null);
              }}
            >
              Revenir à la connexion
            </button>
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

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { badRequest, requireAuthenticatedUser } from "@/lib/api/auth";

export async function POST(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireAuthenticatedUser({
    requireTwoFactor: false,
  });
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const cookieStore = await cookies();
  const hasPendingChallenge = cookieStore.get("maalka_2fa_pending")?.value === "1";
  if (!hasPendingChallenge) {
    return badRequest("Aucune vérification en attente. Reconnecte-toi pour recevoir un nouveau code.");
  }

  if (!user.email) {
    return badRequest("Aucune adresse email trouvée pour ce compte.");
  }

  const payload = await request.json().catch(() => null);
  const code = typeof payload?.code === "string" ? payload.code.trim() : "";

  if (!code) {
    return badRequest("Le code de vérification est obligatoire.");
  }

  const { error } = await supabase.auth.verifyOtp({
    email: user.email,
    token: code,
    type: "email",
  });

  if (error) {
    return badRequest("Code invalide ou expiré. Merci de réessayer.");
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("maalka_2fa_verified", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  response.cookies.delete("maalka_2fa_pending");

  return response;
}

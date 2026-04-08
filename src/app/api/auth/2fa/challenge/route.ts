import { NextResponse } from "next/server";

import { badRequest, requireAuthenticatedUser, serverErrorFrom } from "@/lib/api/auth";

export async function POST(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireAuthenticatedUser({
    requireTwoFactor: false,
  });

  let currentUser = user;
  if (!currentUser) {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (token) {
      const {
        data: { user: bearerUser },
      } = await supabase.auth.getUser(token);
      currentUser = bearerUser ?? null;
    }
  }

  if (!currentUser) {
    return (
      unauthorizedResponse ??
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
  }

  if (!currentUser.email) {
    return badRequest("Aucune adresse email trouvée pour ce compte.");
  }

  const origin = new URL(request.url).origin;
  const redirectTo = `${origin}/auth/callback?next=/dashboard&reason=2fa`;

  const { error } = await supabase.auth.signInWithOtp({
    email: currentUser.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    const rawMessage = error.message.toLowerCase();
    if (
      rawMessage.includes("too many") ||
      rawMessage.includes("rate") ||
      rawMessage.includes("security purposes") ||
      rawMessage.includes("frequency")
    ) {
      return NextResponse.json(
        { error: "Trop de demandes de vérification. Merci de patienter quelques secondes." },
        { status: 429 }
      );
    }

    return serverErrorFrom(error.message);
  }

  const response = NextResponse.json({
    success: true,
    message: "Code de vérification envoyé par email. Tu peux entrer le code ou cliquer le lien reçu.",
  });
  response.cookies.delete("maalka_2fa_verified");
  response.cookies.set("maalka_2fa_pending", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/")) return "/dashboard";
  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const requestedNextPath = safeNextPath(requestUrl.searchParams.get("next"));
  const reason = requestUrl.searchParams.get("reason");
  const isPasswordSetupFlow =
    reason === "recovery" || reason === "invite" || type === "recovery" || type === "invite";

  const nextPath = isPasswordSetupFlow && !requestedNextPath.includes("step=")
    ? "/login?step=reset"
    : requestedNextPath;

  const supabase = await createSupabaseServerClient();
  let authError: string | null = null;

  if (isPasswordSetupFlow) {
    await supabase.auth.signOut();
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      authError = error.message;
    }
  } else if (tokenHash && (type === "recovery" || type === "invite")) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error) {
      authError = error.message;
    }
  } else if (reason === "recovery" || reason === "invite") {
    authError =
      reason === "invite"
        ? "Lien d'invitation incomplet."
        : "Lien de réinitialisation incomplet.";
  }

  const redirectUrl = new URL(nextPath, requestUrl.origin);
  if (authError) {
    redirectUrl.searchParams.set("auth_error", authError);
  }
  const response = NextResponse.redirect(redirectUrl);

  if (reason === "2fa") {
    response.cookies.set("maalka_2fa_verified", "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    response.cookies.delete("maalka_2fa_pending");
  }

  return response;
}

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

  // Password setup links can use PKCE code flow. The browser client must complete the exchange.
  if (isPasswordSetupFlow) {
    const redirectUrl = new URL(nextPath, requestUrl.origin);

    if (code) {
      redirectUrl.searchParams.set("code", code);
      if (type === "recovery" || type === "invite") {
        redirectUrl.searchParams.set("type", type);
      } else if (reason === "recovery" || reason === "invite") {
        redirectUrl.searchParams.set("type", reason);
      }
    }

    if (tokenHash && (type === "recovery" || type === "invite")) {
      redirectUrl.searchParams.set("token_hash", tokenHash);
      redirectUrl.searchParams.set("type", type);
    }

    if (!code && !tokenHash && (reason === "recovery" || reason === "invite")) {
      redirectUrl.searchParams.set(
        "auth_error",
        reason === "invite" ? "Lien d'invitation incomplet." : "Lien de réinitialisation incomplet."
      );
    }

    return NextResponse.redirect(redirectUrl);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      authError = error.message;
    }
  }

  const redirectUrl = new URL(nextPath, requestUrl.origin);
  if (authError) {
    redirectUrl.searchParams.set("auth_error", authError);
  }
  return NextResponse.redirect(redirectUrl);
}

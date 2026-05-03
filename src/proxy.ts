import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  const sessionMaxAge = 60 * 60 * 24 * 30;
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, { ...options, maxAge: sessionMaxAge });
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const loginStep = request.nextUrl.searchParams.get("step");
  const isLoginPage = pathname === "/login";
  const isProtectedPage = pathname.startsWith("/dashboard");
  const isTwoFactorVerified = request.cookies.get("maalka_2fa_verified")?.value === "1";
  const hasRecoveryParams =
    request.nextUrl.searchParams.get("type") === "recovery" ||
    request.nextUrl.searchParams.get("type") === "invite" ||
    request.nextUrl.searchParams.has("token_hash") ||
    request.nextUrl.searchParams.has("code");

  const clearTwoFactorCookies = () => {
    response.cookies.delete("maalka_2fa_verified");
    response.cookies.delete("maalka_2fa_pending");
  };

  if (!user && isProtectedPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (!user) {
    clearTwoFactorCookies();
  }

  if (user && isProtectedPage && !isTwoFactorVerified) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    url.searchParams.set("step", "otp");
    return NextResponse.redirect(url);
  }

  const allowLoginStep = loginStep === "reset" || loginStep === "otp";

  if (user && isLoginPage && isTwoFactorVerified && !hasRecoveryParams && !allowLoginStep) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/login", "/dashboard/:path*"],
};

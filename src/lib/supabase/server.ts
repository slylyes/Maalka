import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseEnv } from "@/lib/supabase/env";

export async function createSupabaseServerClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  const cookieStore = await cookies();
  const sessionMaxAge = 60 * 60 * 24 * 7;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    // On a supprimé la section auth: { flowType: "implicit" }
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, { ...options, maxAge: sessionMaxAge });
          });
        } catch {
          // no-op in Server Components when set is unavailable
        }
      },
    },
  });
}
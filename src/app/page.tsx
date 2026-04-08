"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    const hashParams = new URLSearchParams(
      window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash
    );
    const hashType = hashParams.get("type");

    if (hashType === "invite" || hashType === "recovery") {
      window.location.replace(`/login?step=reset${window.location.hash}`);
      return;
    }

    async function routeFromSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      router.replace(user ? "/dashboard" : "/login");
    }

    void routeFromSession();
  }, [router, supabase]);

  return <main className="mx-auto flex min-h-full w-full max-w-md flex-1 items-center justify-center px-6 py-12 text-sm text-[var(--muted)]">Redirection...</main>;
}

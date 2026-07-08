import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardNavLinks } from "@/app/dashboard/nav-links";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function signOutAction() {
  "use server";

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-5 sm:px-6 sm:py-7">
      <header className="premium-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="shrink-0">
              <Image
                src="/maalka_logo.png"
                alt="Maalka"
                width={190}
                height={82}
                className="h-16 w-auto sm:h-20"
                priority
              />
            </Link>
            <div>
              <h1 className="text-2xl font-light tracking-wide text-[var(--foreground)] sm:text-3xl">
                Espace de gestion
              </h1>
              <p className="text-sm text-[var(--muted)]">Connecté en tant que {user.email}</p>
            </div>
          </div>
          <form action={signOutAction}>
            <button
              className="w-full rounded-xl border border-[var(--border-soft)] bg-white px-4 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-soft)] sm:w-auto"
              type="submit"
            >
              Se déconnecter
            </button>
          </form>
        </div>

        <DashboardNavLinks />
      </header>

      {children}
    </main>
  );
}

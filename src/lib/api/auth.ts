import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuthGuardOptions = {
  requireTwoFactor?: boolean;
};

export async function requireAuthenticatedUser(options: AuthGuardOptions = {}) {
  const requireTwoFactor = options.requireTwoFactor ?? false;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      supabase,
      user: null,
      unauthorizedResponse: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  if (requireTwoFactor) {
    const cookieStore = await cookies();
    const isTwoFactorVerified = cookieStore.get("maalka_2fa_verified")?.value === "1";

    if (!isTwoFactorVerified) {
      return {
        supabase,
        user: null,
        unauthorizedResponse: NextResponse.json(
          { error: "Two-factor authentication required" },
          { status: 403 }
        ),
      };
    }
  }

  return {
    supabase,
    user,
    unauthorizedResponse: null,
  };
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(message = "Internal server error") {
  return NextResponse.json({ error: message }, { status: 500 });
}

export function friendlyError(message: string) {
  const value = message.toLowerCase();

  if (value.includes("clients_email_format_chk") || value.includes("email")) {
    return "Email invalide. Laisse le champ vide ou renseigne une adresse email valide.";
  }

  if (value.includes("reservations_no_overlap_for_unavailable_status") || value.includes("conflicting key")) {
    return "Cette robe est déjà indisponible sur cette période (réservée, en location ou en préparation).";
  }

  if (value.includes("reservation_deposit_chk")) {
    return "L'acompte ne peut pas dépasser le prix total.";
  }

  if (value.includes("reservation_dates_chk")) {
    return "La date de fin doit être supérieure ou égale à la date de début.";
  }

  if (value.includes("duplicate") || value.includes("unique")) {
    return "Cette information existe déjà. Merci de vérifier les champs saisis.";
  }

  if (value.includes("foreign key") || value.includes("update or delete on table")) {
    return "Suppression impossible: cet élément est lié à d'autres données (ex: réservation existante).";
  }

  return "Une erreur est survenue. Merci de réessayer.";
}

export function serverErrorFrom(message: string) {
  return serverError(friendlyError(message));
}

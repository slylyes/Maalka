import { NextResponse } from "next/server";

import { badRequest, requireAuthenticatedUser, serverErrorFrom } from "@/lib/api/auth";
import { isValidDate } from "@/lib/format";

const VALID_CATEGORIES = new Set(["salaires", "achat_robes", "charges", "autre"]);

export async function GET(request: Request) {
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase
    .from("expenses")
    .select("id, date, amount, category, dress_category, description, created_at")
    .order("date", { ascending: false });

  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);

  const { data, error } = await query;
  if (error) return serverErrorFrom(error.message);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") return badRequest("Requête invalide.");

  const { date, amount, category, dress_category, description } = payload;

  if (!date || typeof date !== "string") return badRequest("La date est obligatoire.");
  if (!isValidDate(date)) return badRequest("La date doit être au format AAAA-MM-JJ.");
  if (typeof amount !== "number" || amount <= 0) return badRequest("Le montant doit être un nombre positif.");
  if (!category || !VALID_CATEGORIES.has(category)) return badRequest("Catégorie invalide.");

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      date,
      amount,
      category,
      dress_category:
        category === "achat_robes" && typeof dress_category === "string" && dress_category.trim()
          ? dress_category.trim()
          : null,
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      created_by: user.id,
    })
    .select("id, date, amount, category, dress_category, description, created_at")
    .single();

  if (error) return serverErrorFrom(error.message);
  return NextResponse.json({ data }, { status: 201 });
}

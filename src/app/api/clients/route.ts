import { NextResponse } from "next/server";

import { badRequest, requireAuthenticatedUser, serverErrorFrom } from "@/lib/api/auth";

export async function GET() {
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const { data, error } = await supabase
    .from("clients")
    .select("id, first_name, last_name, phone, email, address, notes, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) return serverErrorFrom(error.message);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const payload = await request.json().catch(() => null);

  if (!payload?.first_name || typeof payload.first_name !== "string") {
    return badRequest("Le prénom est obligatoire.");
  }

  if (!payload?.last_name || typeof payload.last_name !== "string") {
    return badRequest("Le nom est obligatoire.");
  }

  if (!payload?.phone || typeof payload.phone !== "string") {
    return badRequest("Le téléphone est obligatoire.");
  }

  const normalizedEmail = typeof payload.email === "string" ? payload.email.trim() : "";

  const { data, error } = await supabase
    .from("clients")
    .insert({
      first_name: payload.first_name.trim(),
      last_name: payload.last_name.trim(),
      phone: payload.phone.trim(),
      email: normalizedEmail.length > 0 ? normalizedEmail : null,
      address: typeof payload.address === "string" ? payload.address.trim() : null,
      notes: typeof payload.notes === "string" ? payload.notes : null,
    })
    .select("id, first_name, last_name, phone, email, address, notes, created_at, updated_at")
    .single();

  if (error) return serverErrorFrom(error.message);
  return NextResponse.json({ data }, { status: 201 });
}

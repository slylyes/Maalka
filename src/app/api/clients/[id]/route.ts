import { NextResponse } from "next/server";

import { badRequest, requireAuthenticatedUser, serverErrorFrom } from "@/lib/api/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const { data, error } = await supabase
    .from("clients")
    .select("id, first_name, last_name, phone, email, address, notes, created_at, updated_at")
    .eq("id", id)
    .single();

  if (error) return serverErrorFrom(error.message);
  return NextResponse.json({ data });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return badRequest("Requête invalide.");
  }

  const updatePayload: Record<string, unknown> = {};

  if (typeof payload.first_name === "string") updatePayload.first_name = payload.first_name.trim();
  if (typeof payload.last_name === "string") updatePayload.last_name = payload.last_name.trim();
  if (typeof payload.phone === "string") updatePayload.phone = payload.phone.trim();
  if (typeof payload.email === "string") {
    const normalizedEmail = payload.email.trim();
    updatePayload.email = normalizedEmail.length > 0 ? normalizedEmail : null;
  }
  if (typeof payload.address === "string") updatePayload.address = payload.address.trim();
  if (typeof payload.notes === "string") updatePayload.notes = payload.notes;

  if (Object.keys(updatePayload).length === 0) {
    return badRequest("Aucun champ valide à mettre à jour.");
  }

  const { data, error } = await supabase
    .from("clients")
    .update(updatePayload)
    .eq("id", id)
    .select("id, first_name, last_name, phone, email, address, notes, created_at, updated_at")
    .single();

  if (error) return serverErrorFrom(error.message);
  return NextResponse.json({ data });
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return serverErrorFrom(error.message);

  return NextResponse.json({ success: true });
}

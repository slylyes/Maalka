import { NextResponse } from "next/server";

import { badRequest, requireAuthenticatedUser, serverErrorFrom } from "@/lib/api/auth";

type Params = { params: Promise<{ id: string }> };

const blockingStatuses = ["reserved", "rented", "preparing"] as const;

async function syncDressAvailability(supabase: Awaited<ReturnType<typeof requireAuthenticatedUser>>["supabase"], dressId: string) {
  const today = new Date().toISOString().slice(0, 10);

  const { count, error: countError } = await supabase
    .from("reservations")
    .select("id", { head: true, count: "exact" })
    .eq("dress_id", dressId)
    .in("status", [...blockingStatuses])
    .lte("start_date", today)
    .gte("end_date", today);

  if (countError) {
    return { error: countError.message };
  }

  const nextStatus = (count ?? 0) > 0 ? "reserved" : "available";

  const { error: updateError } = await supabase
    .from("dresses")
    .update({ status: nextStatus })
    .eq("id", dressId);

  if (updateError) {
    return { error: updateError.message };
  }

  return { error: null };
}

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, contract_number, dress_id, client_id, start_date, end_date, status, total_price, deposit_paid, balance_due, caution_amount, caution_status, pickup_datetime, return_datetime, notes, created_at, updated_at, dresses(reference,name), clients(first_name,last_name,phone,email,address)"
    )
    .eq("id", id)
    .single();

  if (error) return serverErrorFrom(error.message);
  return NextResponse.json({ data });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const { data: currentReservation, error: currentError } = await supabase
    .from("reservations")
    .select("id, dress_id")
    .eq("id", id)
    .single();

  if (currentError || !currentReservation) {
    return serverErrorFrom(currentError?.message ?? "Réservation introuvable.");
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return badRequest("Requête invalide.");
  }

  const updatePayload: Record<string, unknown> = {};

  if (typeof payload.dress_id === "string") updatePayload.dress_id = payload.dress_id;
  if (typeof payload.client_id === "string") updatePayload.client_id = payload.client_id;
  if (typeof payload.start_date === "string") updatePayload.start_date = payload.start_date;
  if (typeof payload.end_date === "string") updatePayload.end_date = payload.end_date;
  if (typeof payload.status === "string") updatePayload.status = payload.status;
  if (typeof payload.total_price === "number" && payload.total_price >= 0) {
    updatePayload.total_price = payload.total_price;
  }
  if (typeof payload.deposit_paid === "number" && payload.deposit_paid >= 0) {
    updatePayload.deposit_paid = payload.deposit_paid;
  }
  if (typeof payload.caution_amount === "number" && payload.caution_amount >= 0) {
    updatePayload.caution_amount = payload.caution_amount;
  }
  if (typeof payload.caution_status === "string") updatePayload.caution_status = payload.caution_status;
  if (typeof payload.pickup_datetime === "string") updatePayload.pickup_datetime = payload.pickup_datetime;
  if (typeof payload.return_datetime === "string") updatePayload.return_datetime = payload.return_datetime;
  if (typeof payload.notes === "string") updatePayload.notes = payload.notes;

  if (Object.keys(updatePayload).length === 0) {
    return badRequest("Aucun champ valide à mettre à jour.");
  }

  const { data, error } = await supabase
    .from("reservations")
    .update(updatePayload)
    .eq("id", id)
    .select(
      "id, contract_number, dress_id, client_id, start_date, end_date, status, total_price, deposit_paid, balance_due, caution_amount, caution_status, pickup_datetime, return_datetime, notes, created_at, updated_at"
    )
    .single();

  if (error) return serverErrorFrom(error.message);

  const dressIdsToSync = new Set<string>([currentReservation.dress_id, data.dress_id]);
  for (const dressId of dressIdsToSync) {
    const syncResult = await syncDressAvailability(supabase, dressId);
    if (syncResult.error) return serverErrorFrom(syncResult.error);
  }

  return NextResponse.json({ data });
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const { data: currentReservation, error: currentError } = await supabase
    .from("reservations")
    .select("id, dress_id")
    .eq("id", id)
    .single();

  if (currentError || !currentReservation) {
    return serverErrorFrom(currentError?.message ?? "Réservation introuvable.");
  }

  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if (error) return serverErrorFrom(error.message);

  const syncResult = await syncDressAvailability(supabase, currentReservation.dress_id);
  if (syncResult.error) return serverErrorFrom(syncResult.error);

  return NextResponse.json({ success: true });
}

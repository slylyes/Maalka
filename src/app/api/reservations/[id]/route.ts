import { NextResponse } from "next/server";

import { badRequest, requireAuthenticatedUser, serverErrorFrom } from "@/lib/api/auth";

type Params = { params: Promise<{ id: string }> };

const blockingStatuses = ["reserved", "rented", "preparing"] as const;

async function syncDressAvailability(supabase: Awaited<ReturnType<typeof requireAuthenticatedUser>>["supabase"], dressId: string) {
  const today = new Date().toISOString().slice(0, 10);

  const { count, error: countError } = await supabase
    .from("reservation_dresses")
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
      "id, contract_number, client_id, start_date, end_date, status, total_price, deposit_paid, balance_due, caution_amount, caution_status, pickup_datetime, return_datetime, notes, created_at, updated_at, reservation_dresses(dress_id, price, base_price, discount_amount, dresses(reference,name)), clients(first_name,last_name,phone,email,address)"
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

  const { error: currentError } = await supabase
    .from("reservations")
    .select("id")
    .eq("id", id)
    .single();

  if (currentError) {
    return serverErrorFrom(currentError?.message ?? "Réservation introuvable.");
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return badRequest("Requête invalide.");
  }

  const updatePayload: Record<string, unknown> = {};

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

  // Handle dress list update if dress_ids provided
  const newDressIds: string[] | null = Array.isArray(payload.dress_ids)
    ? payload.dress_ids.filter((v: unknown) => typeof v === "string")
    : null;

  if (newDressIds !== null) {
    if (newDressIds.length === 0) {
      return badRequest("La réservation doit contenir au moins une robe.");
    }

    const { data: dressRows, error: dressError } = await supabase
      .from("dresses")
      .select("id, price")
      .in("id", newDressIds);

    if (dressError || !dressRows || dressRows.length !== newDressIds.length) {
      return badRequest("Certaines robes sélectionnées sont introuvables.");
    }

    const discountAmount =
      typeof payload.discount_amount === "number" && payload.discount_amount >= 0
        ? payload.discount_amount
        : 0;
    const baseTotal = dressRows.reduce((s, d) => s + Number(d.price ?? 0), 0);
    const totalPrice = Math.max(baseTotal - discountAmount, 0);

    if (discountAmount > baseTotal) {
      return badRequest("La remise ne peut pas dépasser le prix total.");
    }

    updatePayload.total_price = totalPrice;

    // Allocate discount proportionally across dresses
    const basePrices = newDressIds.map((did) => {
      const row = dressRows.find((d) => d.id === did);
      return Number(row?.price ?? 0);
    });
    const allocatedDiscounts: number[] = basePrices.map((price, i) => {
      if (discountAmount <= 0) return 0;
      if (i === basePrices.length - 1) {
        const allocated = basePrices.slice(0, i).reduce((s, p) => {
          if (baseTotal <= 0) return s;
          return s + Math.round((p / baseTotal) * discountAmount * 100) / 100;
        }, 0);
        return Math.max(discountAmount - allocated, 0);
      }
      if (baseTotal <= 0) return 0;
      return Math.round((price / baseTotal) * discountAmount * 100) / 100;
    });

    const effectiveStart = typeof updatePayload.start_date === "string"
      ? updatePayload.start_date
      : typeof payload.start_date === "string" ? payload.start_date : null;
    const effectiveEnd = typeof updatePayload.end_date === "string"
      ? updatePayload.end_date
      : typeof payload.end_date === "string" ? payload.end_date : null;
    const effectiveStatus = typeof updatePayload.status === "string"
      ? updatePayload.status
      : typeof payload.status === "string" ? payload.status : null;

    // Get current dress ids to know which ones to delete
    const { data: existingRows, error: existingError } = await supabase
      .from("reservation_dresses")
      .select("dress_id")
      .eq("reservation_id", id);

    if (existingError) return serverErrorFrom(existingError.message);

    const existingDressIds = new Set((existingRows ?? []).map((r) => r.dress_id));
    const newDressIdSet = new Set(newDressIds);

    // Delete removed dresses
    const toDelete = [...existingDressIds].filter((did) => !newDressIdSet.has(did));
    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("reservation_dresses")
        .delete()
        .eq("reservation_id", id)
        .in("dress_id", toDelete);
      if (deleteError) return serverErrorFrom(deleteError.message);
    }

    // Upsert all dresses in new list
    const upsertRows = newDressIds.map((did, idx) => {
      const basePrice = basePrices[idx] ?? 0;
      const allocated = allocatedDiscounts[idx] ?? 0;
      return {
        reservation_id: id,
        dress_id: did,
        ...(effectiveStart ? { start_date: effectiveStart } : {}),
        ...(effectiveEnd ? { end_date: effectiveEnd } : {}),
        ...(effectiveStatus ? { status: effectiveStatus } : {}),
        base_price: basePrice,
        discount_amount: allocated,
        price: Math.max(basePrice - allocated, 0),
      };
    });

    const { error: upsertError } = await supabase
      .from("reservation_dresses")
      .upsert(upsertRows, { onConflict: "reservation_id,dress_id" });

    if (upsertError) return serverErrorFrom(upsertError.message);
  }

  const { data, error } = await supabase
    .from("reservations")
    .update(updatePayload)
    .eq("id", id)
    .select(
      "id, contract_number, client_id, start_date, end_date, status, total_price, deposit_paid, balance_due, caution_amount, caution_status, pickup_datetime, return_datetime, notes, created_at, updated_at"
    )
    .single();

  if (error) return serverErrorFrom(error.message);

  // Propagate date/status changes to existing reservation_dresses (when dress_ids not provided)
  if (newDressIds === null) {
    const dressUpdatePayload: Record<string, unknown> = {};
    if (typeof updatePayload.start_date === "string") dressUpdatePayload.start_date = updatePayload.start_date;
    if (typeof updatePayload.end_date === "string") dressUpdatePayload.end_date = updatePayload.end_date;
    if (typeof updatePayload.status === "string") dressUpdatePayload.status = updatePayload.status;

    if (Object.keys(dressUpdatePayload).length > 0) {
      const { error: dressUpdateError } = await supabase
        .from("reservation_dresses")
        .update(dressUpdatePayload)
        .eq("reservation_id", id);

      if (dressUpdateError) return serverErrorFrom(dressUpdateError.message);
    }
  }

  const { data: linkedDressRows, error: linkedError } = await supabase
    .from("reservation_dresses")
    .select("dress_id")
    .eq("reservation_id", id);

  if (linkedError) return serverErrorFrom(linkedError.message);

  const dressIdsToSync = new Set<string>((linkedDressRows ?? []).map((row) => row.dress_id));
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

  const { error: currentError } = await supabase
    .from("reservations")
    .select("id")
    .eq("id", id)
    .single();

  if (currentError) {
    return serverErrorFrom(currentError?.message ?? "Réservation introuvable.");
  }

  const { data: linkedDressRows, error: linkedError } = await supabase
    .from("reservation_dresses")
    .select("dress_id")
    .eq("reservation_id", id);

  if (linkedError) return serverErrorFrom(linkedError.message);

  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if (error) return serverErrorFrom(error.message);

  const dressIdsToSync = new Set<string>((linkedDressRows ?? []).map((row) => row.dress_id));
  for (const dressId of dressIdsToSync) {
    const syncResult = await syncDressAvailability(supabase, dressId);
    if (syncResult.error) return serverErrorFrom(syncResult.error);
  }

  return NextResponse.json({ success: true });
}

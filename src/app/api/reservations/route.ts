import { NextResponse } from "next/server";

import { badRequest, requireAuthenticatedUser, serverErrorFrom } from "@/lib/api/auth";

const allowedCautionStatuses = new Set(["pending", "received", "not_required"]);

function formatContractNumber(reference: string, date: Date, suffix: number) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  const normalizedRef = reference.replace(/\s+/g, "").toUpperCase();
  const base = `${normalizedRef}-${dd}${mm}${yyyy}`;
  return suffix <= 0 ? base : `${base}-${suffix + 1}`;
}

function parseStartDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

const blockingStatuses = ["reserved", "rented", "preparing"] as const;

async function syncDressAvailability(
  supabase: Awaited<ReturnType<typeof requireAuthenticatedUser>>["supabase"],
  dressId: string
) {
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
    .eq("id", dressId)
    .in("status", ["available", "reserved"]);

  if (updateError) {
    return { error: updateError.message };
  }

  return { error: null };
}

export async function GET() {
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, contract_number, client_id, start_date, end_date, status, total_price, deposit_paid, balance_due, caution_amount, caution_status, pickup_datetime, return_datetime, notes, created_at, updated_at, reservation_dresses(dress_id, price, base_price, discount_amount, dresses(reference,name)), clients(first_name,last_name,phone,email)"
    )
    .order("created_at", { ascending: false });

  if (error) return serverErrorFrom(error.message);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const payload = await request.json().catch(() => null);

  const dressIdsFromPayload = Array.isArray(payload?.dress_ids)
    ? payload.dress_ids.filter((value: unknown) => typeof value === "string")
    : [];
  const dressIdFromPayload = typeof payload?.dress_id === "string" ? [payload.dress_id] : [];
  const uniqueDressIds = Array.from(new Set([...dressIdsFromPayload, ...dressIdFromPayload]));

  if (uniqueDressIds.length === 0) {
    return badRequest("La robe est obligatoire.");
  }

  if (!payload?.client_id || typeof payload.client_id !== "string") {
    return badRequest("Le client est obligatoire.");
  }

  if (!payload?.start_date || typeof payload.start_date !== "string") {
    return badRequest("La date de début est obligatoire.");
  }

  if (!payload?.end_date || typeof payload.end_date !== "string") {
    return badRequest("La date de fin est obligatoire.");
  }

  if (
    payload.caution_status &&
    (typeof payload.caution_status !== "string" || !allowedCautionStatuses.has(payload.caution_status))
  ) {
    return badRequest("Le statut de caution doit être: en attente, reçue, ou pas de caution.");
  }

  const startDate = parseStartDate(payload.start_date);
  const { data: dressRows, error: dressError } = await supabase
    .from("dresses")
    .select("id, price, discount_amount, reference, name")
    .in("id", uniqueDressIds);

  if (dressError || !dressRows || dressRows.length === 0) {
    return badRequest("Robe introuvable. Merci de sélectionner une robe valide.");
  }

  if (dressRows.length !== uniqueDressIds.length) {
    return badRequest("Certaines robes sélectionnées sont introuvables.");
  }

  const depositPaid =
    typeof payload.deposit_paid === "number" && payload.deposit_paid >= 0
      ? payload.deposit_paid
      : 0;
  const cautionAmount =
    typeof payload.caution_amount === "number" && payload.caution_amount >= 0
      ? payload.caution_amount
      : 0;
  const cautionStatus = typeof payload.caution_status === "string" ? payload.caution_status : "pending";
  const pickupDatetime = typeof payload.pickup_datetime === "string" ? payload.pickup_datetime : null;
  const returnDatetime = typeof payload.return_datetime === "string" ? payload.return_datetime : null;
  const notes = typeof payload.notes === "string" ? payload.notes : null;

  const dressMap = new Map(dressRows.map((dress) => [dress.id, dress]));
  const orderedDressRows = uniqueDressIds
    .map((id) => dressMap.get(id))
    .filter((dress): dress is (typeof dressRows)[number] => Boolean(dress));

  const firstDress = orderedDressRows[0];
  if (!firstDress) {
    return badRequest("Impossible de déterminer la première robe sélectionnée.");
  }

  const totalPrice = orderedDressRows.reduce((sum, dress) => {
    const discountedPrice = Math.max(
      Number(dress.price) - Number(dress.discount_amount ?? 0),
      0
    );
    return sum + discountedPrice;
  }, 0);

  if (depositPaid > totalPrice) {
    return badRequest("L'acompte dépasse le prix total de la réservation.");
  }

  const firstContractNumber = formatContractNumber(firstDress.reference, startDate, 0);
  const { count: existingCount, error: countError } = await supabase
    .from("reservations")
    .select("id", { head: true, count: "exact" })
    .ilike("contract_number", `${firstContractNumber}%`);

  if (countError) return serverErrorFrom(countError.message);

  const contractNumber = formatContractNumber(firstDress.reference, startDate, existingCount ?? 0);

  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .insert({
      contract_number: contractNumber,
      dress_id: firstDress.id,
      client_id: payload.client_id,
      start_date: payload.start_date,
      end_date: payload.end_date,
      status: "reserved",
      total_price: totalPrice,
      deposit_paid: depositPaid,
      caution_amount: cautionAmount,
      caution_status: cautionStatus,
      pickup_datetime: pickupDatetime,
      return_datetime: returnDatetime,
      notes,
      created_by: user.id,
    })
    .select(
      "id, contract_number, client_id, start_date, end_date, status, total_price, deposit_paid, balance_due, caution_amount, caution_status, pickup_datetime, return_datetime, notes, created_at, updated_at"
    )
    .single();

  if (reservationError || !reservation) return serverErrorFrom(reservationError?.message ?? "Erreur serveur");

  const dressItems = orderedDressRows.map((dress) => {
    const discountedPrice = Math.max(
      Number(dress.price) - Number(dress.discount_amount ?? 0),
      0
    );

    return {
      reservation_id: reservation.id,
      dress_id: dress.id,
      start_date: payload.start_date,
      end_date: payload.end_date,
      status: reservation.status,
      price: discountedPrice,
      base_price: Number(dress.price),
      discount_amount: Number(dress.discount_amount ?? 0),
    };
  });

  const { error: itemsError } = await supabase
    .from("reservation_dresses")
    .insert(dressItems);

  if (itemsError) {
    await supabase.from("reservations").delete().eq("id", reservation.id);
    return serverErrorFrom(itemsError.message);
  }

  const syncResults = await Promise.all(
    uniqueDressIds.map((dressId) => syncDressAvailability(supabase, dressId))
  );
  const syncError = syncResults.find((result) => result.error)?.error;
  if (syncError) return serverErrorFrom(syncError);

  return NextResponse.json({ data: reservation }, { status: 201 });
}
